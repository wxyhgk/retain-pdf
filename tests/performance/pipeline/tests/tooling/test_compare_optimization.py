from support.paths import HERE
import json
import hashlib
import os
import subprocess
import sys
from pathlib import Path

import pytest

from tools.analysis.compare_optimization import evaluate
from retainpdf_pipeline.translate.llm.shared.request_capture import digest, plan_input_digest


def write_plan(root, plan):
    plan = dict(plan)
    plan["input_sha256"] = plan_input_digest(plan)
    capture = root / "private-inputs"
    capture.mkdir(exist_ok=True)
    for old in capture.glob("plan-*.json"):
        old.unlink()
    identity = digest(plan)
    (capture / f"plan-{identity}.json").write_text(json.dumps({"sha256": identity, "payload": plan}))


def read_plan(root):
    return json.loads(next((root / "private-inputs").glob("plan-*.json")).read_text())["payload"]


def run_fixture(root, *, requests=10, tokens=100, elapsed=50, status="translated", checkpoint=False):
    root.mkdir()
    report = {"job_id": "j", "pages": "all", "workers": 8, "model": "qwen3.8-flash", "transport": "rust",
              "status": "succeeded", "wall_seconds": elapsed, "strategy": "baseline",
              "comparison_evidence": {"schema": "translation_benchmark_evidence_v1",
                  **{key: digest(key) for key in ("pdf_sha256", "normalized_document_sha256", "translation_config_sha256", "cache_policy_sha256")}},
              "model_executor": {"configuration_fingerprint": digest("connection"),
                  "metrics": {name: {"sum": value, "unknown_count": 0} for name, value in
                  [("upstream_attempts", requests), ("input_tokens", tokens), ("output_tokens", 20), ("cached_tokens", 10)]}}}
    path = root / "report.json"
    path.write_text(json.dumps(report))
    write_plan(root, {"schema": "translation_dispatch_plan_v1", "workers": 8, "model": report["model"],
                     "mode": "fast", "domain_guidance": "DOMAIN", "context": {"context_mode": "off"},
                     "engine_identity": {"prompt_hash": digest("prompt"), "optimization": "baseline",
                                         "connection_fingerprint": digest("connection")},
                     "batches": [[{"item_id": "i", "source_text": "source", "translation_unit_member_ids": ["i"]}]]})
    pages = root / "data/jobs/j/translated"
    pages.mkdir(parents=True)
    page = pages / "page-001-deepseek.json"
    (pages / "translation-manifest.json").write_text(json.dumps({
        "schema": "translation_manifest_v1", "status": "complete",
        "pages": [{"page_index": 0, "path": page.name}],
    }))
    page.write_text(json.dumps([{"item_id": "i", "source_text": "source",
        "translated_text": "译文", "final_status": status,
        "block_kind": "text", "layout_role": "paragraph", "semantic_role": "body",
        "structure_role": "body", "policy_translate": True, "asset_id": None,
        "reading_order": 0, "raw_block_type": "text", "normalized_sub_type": "plain_text"}]))
    if checkpoint:
        (pages / "translation-checkpoint.v1.json").write_text(json.dumps({
            "schema": "translation_checkpoint_v1", "schema_version": 1,
            "normalized_document_sha256": digest("normalized_document_sha256"),
            "status": "complete", "phase": "committed", "progress": {"pending_item_count": 0},
            "final_manifest": "translation-manifest.json", "pages": [{"page_index": 0,
                "path": page.name, "page_hash": hashlib.sha256(page.read_bytes()).hexdigest()}],
        }))
    return path


def test_comparison_requires_both_integrity_and_performance(tmp_path):
    a = run_fixture(tmp_path / "a")
    b = run_fixture(tmp_path / "b", requests=9, tokens=90)
    assert evaluate(a, b)["accepted"]
    c = run_fixture(tmp_path / "c", requests=9, tokens=90, elapsed=56)
    assert not evaluate(a, c)["accepted"]
    d = run_fixture(tmp_path / "d", requests=9, tokens=90, status="failed")
    assert not evaluate(a, d)["accepted"]


def test_missing_metric_is_not_zero_and_bad_configuration_is_rejected(tmp_path):
    a = run_fixture(tmp_path / "a")
    b = run_fixture(tmp_path / "b", requests=9, tokens=90)
    report = json.loads(b.read_text())
    report["model_executor"]["metrics"]["input_tokens"]["unknown_count"] = 1
    b.write_text(json.dumps(report))
    assert not evaluate(a, b)["accepted"]
    report["workers"] = 4
    b.write_text(json.dumps(report))
    with pytest.raises(ValueError):
        evaluate(a, b)


@pytest.mark.parametrize("checkpoint", [False, True])
def test_comparison_accepts_historical_and_checkpoint_publications(tmp_path, checkpoint):
    a = run_fixture(tmp_path / "a", checkpoint=checkpoint)
    b = run_fixture(tmp_path / "b", requests=9, tokens=90, checkpoint=checkpoint)
    assert evaluate(a, b)["accepted"]


@pytest.mark.parametrize("side", ["baseline", "candidate"])
@pytest.mark.parametrize("mutation", ["invalid_json", "incomplete", "missing_page", "empty_pages",
                                      "hash_mismatch", "checkpoint_in_progress", "missing_contract",
                                      "duplicate_item"])
def test_comparison_rejects_invalid_publication(tmp_path, side, mutation):
    a = run_fixture(tmp_path / "a", checkpoint=True)
    b = run_fixture(tmp_path / "b", requests=9, tokens=90, checkpoint=True)
    root = (a if side == "baseline" else b).parent / "data/jobs/j/translated"
    manifest_path = root / "translation-manifest.json"
    manifest = json.loads(manifest_path.read_text())
    page = root / manifest["pages"][0]["path"]
    if mutation == "invalid_json":
        manifest_path.write_text("{private broken content")
    elif mutation == "incomplete":
        manifest["status"] = "in_progress"
        manifest_path.write_text(json.dumps(manifest))
    elif mutation == "missing_page":
        page.unlink()
    elif mutation == "empty_pages":
        manifest["pages"] = []
        manifest_path.write_text(json.dumps(manifest))
    elif mutation == "hash_mismatch":
        page.write_text(page.read_text() + "\n")
    elif mutation == "checkpoint_in_progress":
        marker = root / "translation-checkpoint.v1.json"
        checkpoint = json.loads(marker.read_text())
        checkpoint["status"] = "in_progress"
        marker.write_text(json.dumps(checkpoint))
    else:
        # Test payload validation independently of the checkpoint hash gate.
        (root / "translation-checkpoint.v1.json").unlink()
        rows = json.loads(page.read_text())
        if mutation == "missing_contract":
            rows[0].pop("semantic_role")
        else:
            rows *= 2
        page.write_text(json.dumps(rows))
    result = evaluate(a, b)
    assert not result["accepted"]
    assert not result["checks"]["integrity_checks_pass"]
    assert f"invalid_translation_artifacts:{side}" in result["errors"]
    assert "private broken content" not in json.dumps(result)


def test_comparison_uses_manifest_pages_not_unlisted_glob_matches(tmp_path):
    a = run_fixture(tmp_path / "a")
    b = run_fixture(tmp_path / "b", requests=9, tokens=90)
    (b.parent / "data/jobs/j/translated/page-999-deepseek.json").write_text("not published")
    assert evaluate(a, b)["accepted"]


def test_standalone_cli_writes_rejected_comparison_without_pythonpath(tmp_path):
    a = run_fixture(tmp_path / "a")
    b = run_fixture(tmp_path / "b", requests=9, tokens=90)
    (b.parent / "data/jobs/j/translated/translation-manifest.json").write_text("broken")
    output = tmp_path / "comparison.json"
    from support.offline import child_command, child_environment
    env = child_environment(tmp_path)
    env.pop("PYTHONPATH")
    process = subprocess.run(child_command(HERE / "tools/analysis/compare_optimization.py",
                              a, b, "--output", output),
                             cwd=tmp_path, env=env, capture_output=True, text=True, timeout=20)
    assert process.returncode == 0, process.stderr
    result = json.loads(process.stdout)
    assert result == json.loads(output.read_text())
    assert not result["accepted"]
    assert "invalid_translation_artifacts:candidate" in result["errors"]


def test_prompt_code_change_is_allowed_but_only_hashes_are_reported(tmp_path):
    a = run_fixture(tmp_path / "a")
    b = run_fixture(tmp_path / "b", requests=9, tokens=90)
    plan = read_plan(b.parent)
    plan["engine_identity"]["prompt_hash"] = "PRIVATE unexpected identity text"
    write_plan(b.parent, plan)
    result = evaluate(a, b)
    assert result["accepted"]
    assert result["configuration"]["differences"] == ["engine_identity_sha256"]
    assert "PRIVATE" not in json.dumps(result)


@pytest.mark.parametrize("field", ["pdf_sha256", "normalized_document_sha256", "translation_config_sha256", "cache_policy_sha256"])
def test_same_model_and_workers_cannot_hide_changed_report_inputs(tmp_path, field):
    a = run_fixture(tmp_path / "a")
    b = run_fixture(tmp_path / "b", requests=9, tokens=90)
    report = json.loads(b.read_text())
    report["comparison_evidence"][field] = digest("different")
    b.write_text(json.dumps(report))
    result = evaluate(a, b)
    assert not result["accepted"]
    assert result["checks"]["integrity_checks_pass"]
    assert result["configuration"]["status"] == "different_inputs"
    assert field in result["configuration"]["disallowed_differences"]


@pytest.mark.parametrize("mutation", ["source", "group", "context", "domain", "batch_layout", "order"])
def test_fixed_dispatch_comparison_rejects_plan_changes(tmp_path, mutation):
    a = run_fixture(tmp_path / "a")
    b = run_fixture(tmp_path / "b", requests=9, tokens=90)
    # Both reports begin with a valid two-member plan. The output artifacts are
    # deliberately identical so the configuration gate must detect the change.
    plan = read_plan(a.parent)
    plan["batches"][0].append({"item_id": "j", "source_text": "second"})
    write_plan(a.parent, plan)
    if mutation == "source":
        plan["batches"][0][0]["source_text"] = "PRIVATE other source"
    elif mutation == "group":
        plan["batches"][0][0]["translation_unit_member_ids"] = ["i", "j"]
    elif mutation == "context":
        plan["context"]["context_mode"] = "window"
    elif mutation == "domain":
        plan["domain_guidance"] = "PRIVATE other domain"
    elif mutation == "batch_layout":
        plan["batches"] = [[item] for item in plan["batches"][0]]
    else:
        plan["batches"][0].reverse()
    write_plan(b.parent, plan)
    result = evaluate(a, b)
    assert not result["accepted"]
    assert "dispatch_input_sha256" in result["configuration"]["disallowed_differences"]
    assert "PRIVATE" not in json.dumps(result)


@pytest.mark.parametrize("mutation,issue", [
    ("legacy_report", "missing_or_invalid_report_evidence"),
    ("no_capture", "missing_or_invalid_capture"),
    ("capture_tampered", "missing_or_invalid_capture"),
    ("no_connection", "missing_or_invalid_connection_fingerprint"),
    ("plan_connection", "plan_connection_mismatch"),
    ("plan_workers", "plan_report_configuration_mismatch"),
    ("strategy", "plan_strategy_mismatch"),
    ("no_strategy", "missing_or_invalid_strategy"),
    ("checkpoint_source", "checkpoint_source_mismatch"),
])
def test_missing_or_inconsistent_evidence_is_not_assumed_equivalent(tmp_path, mutation, issue):
    a = run_fixture(tmp_path / "a", checkpoint=True)
    b = run_fixture(tmp_path / "b", requests=9, tokens=90, checkpoint=True)
    report = json.loads(b.read_text())
    plan = read_plan(b.parent)
    if mutation == "legacy_report":
        report.pop("comparison_evidence")
    elif mutation == "no_capture":
        next((b.parent / "private-inputs").glob("plan-*.json")).unlink()
    elif mutation == "capture_tampered":
        path = next((b.parent / "private-inputs").glob("plan-*.json"))
        envelope = json.loads(path.read_text())
        envelope["payload"]["domain_guidance"] = "PRIVATE tampering"
        path.write_text(json.dumps(envelope))
    elif mutation == "no_connection":
        report["model_executor"].pop("configuration_fingerprint")
    elif mutation == "plan_connection":
        plan["engine_identity"]["connection_fingerprint"] = digest("different")
        write_plan(b.parent, plan)
    elif mutation == "plan_workers":
        plan["workers"] = 1
        write_plan(b.parent, plan)
    elif mutation == "strategy":
        report["strategy"] = "page_local_v1"
    elif mutation == "no_strategy":
        report.pop("strategy")
    else:
        path = b.parent / "data/jobs/j/translated/translation-checkpoint.v1.json"
        checkpoint = json.loads(path.read_text())
        checkpoint["normalized_document_sha256"] = digest("different")
        path.write_text(json.dumps(checkpoint))
    b.write_text(json.dumps(report))
    result = evaluate(a, b)
    assert not result["accepted"]
    assert result["checks"]["integrity_checks_pass"]
    assert result["configuration"]["status"] == "insufficient_evidence"
    assert issue in result["configuration"]["evidence"]["candidate"]["issues"]
    assert "PRIVATE" not in json.dumps(result)


def test_consistent_strategy_and_connection_changes_still_reject_attribution(tmp_path):
    a = run_fixture(tmp_path / "a")
    b = run_fixture(tmp_path / "b", requests=9, tokens=90)
    report = json.loads(b.read_text())
    report["strategy"] = "page_local_v1"
    report["model_executor"]["configuration_fingerprint"] = digest("other connection")
    b.write_text(json.dumps(report))
    plan = read_plan(b.parent)
    plan["engine_identity"].update(optimization="page_local_v1", connection_fingerprint=digest("other connection"))
    write_plan(b.parent, plan)
    result = evaluate(a, b)
    assert not result["accepted"]
    assert result["configuration"]["status"] == "different_inputs"
    assert set(result["configuration"]["disallowed_differences"]) == {"strategy", "connection_sha256"}


def test_request_capture_connection_must_match_executor_profile(tmp_path):
    a = run_fixture(tmp_path / "a")
    b = run_fixture(tmp_path / "b", requests=9, tokens=90)
    capture = b.parent / "private-inputs"
    plan_hash = json.loads(next(capture.glob("plan-*.json")).read_text())["sha256"]
    request = {"schema": "translation_request_input_v1", "operation_id": "op.primary", "plan_sha256": plan_hash,
               "connection_fingerprint": digest("wrong connection"), "messages": [{"content": "PRIVATE source"}]}
    (capture / f"request-{digest(request['operation_id'])}.json").write_text(json.dumps({
        "sha256": digest(request), "payload": request}))
    result = evaluate(a, b)
    assert not result["comparable"]
    assert "request_connection_mismatch" in result["configuration"]["evidence"]["candidate"]["issues"]
    assert "PRIVATE" not in json.dumps(result)


def test_two_old_reports_remain_inspectable_without_comparability_claim(tmp_path):
    a = run_fixture(tmp_path / "a")
    b = run_fixture(tmp_path / "b", requests=9, tokens=90)
    for path in (a, b):
        report = json.loads(path.read_text())
        report.pop("comparison_evidence")
        path.write_text(json.dumps(report))
    result = evaluate(a, b)
    assert result["checks"]["integrity_checks_pass"]
    assert result["checks"]["requests_reduced"]
    assert not result["comparable"]
    assert not result["accepted"]
