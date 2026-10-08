"""译后精修（第二期）：挑错只定位、改动收不收由确定性检查决定、不通过就保留原译。

全部用 mock 模型（chat_fn），不调真实 LLM。
"""
from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from pathlib import Path

import pytest

from retainpdf_pipeline.foundation.shared.stage_specs import RenderStageRefineParams
from retainpdf_pipeline.foundation.shared.stage_specs import RenderStageSpec
from retainpdf_pipeline.services.pipeline_shared.events import PipelineEventWriter
from retainpdf_pipeline.services.pipeline_shared.events import pipeline_event_writer_scope
from retainpdf_pipeline.translate.public import run_refine_for_render
from retainpdf_pipeline.translate.services.refine.config import refine_config_from_mapping
from retainpdf_pipeline.translate.services.refine.edits import EditRejected
from retainpdf_pipeline.translate.services.refine.edits import apply_edits
from retainpdf_pipeline.translate.services.refine.llm import ChatResult
from retainpdf_pipeline.translate.workflow.checkpoint.contract import project_progress
from retainpdf_pipeline.translate.workflow.checkpoint.store import CheckpointStore


_CONTRACT = {
    "block_kind": "text",
    "layout_role": "paragraph",
    "semantic_role": "body",
    "structure_role": "body",
    "policy_translate": True,
    "asset_id": "",
    "raw_block_type": "text",
    "normalized_sub_type": "",
    "math_mode": "direct_typst",
    "formula_map": [],
    "protected_map": [],
}

B001_SOURCE = (
    "The harmonic oscillator is a model system for molecular vibrations. "
    "Its energy levels are equally spaced and never cross each other."
)
B001_TEXT = "谐振子是分子振动的模型体系。"
B002_TEXT = "在 289 K 时键长为 1.21 Å。"
B003_TEXT = "每个量子的能量为 $E = h\\nu$。"


def _single(item_id: str, page_idx: int, order: int, source: str, translated: str) -> dict:
    return {
        **_CONTRACT,
        "item_id": item_id,
        "page_idx": page_idx,
        "block_idx": order,
        "reading_order": order,
        "bbox": [72, 100 + order * 40, 520, 130 + order * 40],
        "source_text": source,
        "protected_source_text": source,
        "should_translate": True,
        "translation_unit_id": item_id,
        "translation_unit_kind": "single",
        "translation_unit_member_ids": [item_id],
        "translation_unit_protected_source_text": source,
        "translation_unit_protected_translated_text": translated,
        "translation_unit_translated_text": translated,
        "protected_translated_text": translated,
        "translated_text": translated,
        "final_status": "translated",
        "translation_diagnostics": {"final_status": "translated"},
    }


def _pages() -> dict[int, list[dict]]:
    return {
        0: [
            _single("p001-b001", 0, 1, B001_SOURCE, B001_TEXT),
            _single("p001-b002", 0, 2, "The bond length is 1.21 Å at 298 K.", B002_TEXT),
            _single("p001-b003", 0, 3, "The energy is $E = h\\nu$ for each quantum.", B003_TEXT),
        ],
        1: [
            _single("p002-b001", 1, 1, "The energy of the system is conserved.", "系统的能量守恒。"),
        ],
    }


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _build_job(root: Path) -> Path:
    translated = root / "translated"
    pages = _pages()
    paths = {idx: translated / f"page-{idx + 1:03d}-deepseek.json" for idx in pages}
    for idx, items in pages.items():
        _write_json(paths[idx], items)
    _write_json(translated / "translation-manifest.json", {
        "schema": "translation_manifest_v1",
        "schema_version": 1,
        "status": "complete",
        "pages": [
            {"page_index": idx, "page_number": idx + 1, "path": paths[idx].name}
            for idx in sorted(pages)
        ],
    })
    checkpoint_pages, progress = project_progress(
        output_dir=translated, page_payloads=deepcopy(pages), translation_paths=paths,
    )
    checkpoint = {
        "schema": "translation_checkpoint_v1",
        "schema_version": 1,
        "status": "complete",
        "phase": "committed",
        "attempt_id": "attempt-1",
        "created_at": "2026-10-01T00:00:00Z",
        "updated_at": "2026-10-01T00:00:00Z",
        "generation": 3,
        "normalized_document_sha256": "b" * 64,
        "parameters_sha256": "a" * 64,
        "fingerprint": "c" * 64,
        "pages": checkpoint_pages,
        "progress": progress,
        "committed_pages": [],
        "final_manifest": "translation-manifest.json",
    }
    store = CheckpointStore(translated / "translation-checkpoint.v1.json")
    store.acquire()
    try:
        store.snapshot_pages(checkpoint)
        store.save(checkpoint)
    finally:
        store.close()
    _write_json(root / "specs" / "translate.spec.json", {"params": {"glossary_entries": []}})
    return translated


def _snapshot(directory: Path) -> dict[str, bytes]:
    return {
        path.relative_to(directory).as_posix(): path.read_bytes()
        for path in sorted(directory.rglob("*"))
        if path.is_file() and path.name != ".translation-checkpoint.lock"
    }


def _item(translated: Path, item_id: str) -> dict:
    for path in sorted(translated.glob("page-*.json")):
        for item in json.loads(path.read_text(encoding="utf-8")):
            if item["item_id"] == item_id:
                return item
    raise AssertionError(item_id)


def _revisions(translated: Path) -> list[dict]:
    path = translated / "revisions.v1.jsonl"
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def _assert_checkpoint_consistent(translated: Path) -> None:
    checkpoint = json.loads((translated / "translation-checkpoint.v1.json").read_text(encoding="utf-8"))
    for page in checkpoint["pages"]:
        digest = hashlib.sha256((translated / page["path"]).read_bytes()).hexdigest()
        assert digest == page["page_hash"]


class MockModel:
    """按 purpose 返回脚本化的响应，并记下每次请求。"""

    def __init__(self, *, review=None, fix=None, usage=None) -> None:
        self.review = review if review is not None else [{"findings": []}]
        self.fix = fix if fix is not None else [{"fixes": []}]
        self.usage = usage
        self.calls: list[tuple[str, list[dict]]] = []

    def __call__(self, messages, *, purpose, response_format=None):
        self.calls.append((purpose, messages))
        script = self.review if purpose == "review" else self.fix
        index = sum(1 for call_purpose, _ in self.calls if call_purpose == purpose) - 1
        response = script[min(index, len(script) - 1)]
        if isinstance(response, Exception):
            raise response
        content = response if isinstance(response, str) else json.dumps(response, ensure_ascii=False)
        return ChatResult(content=content, usage=self.usage)

    def purposes(self) -> list[str]:
        return [purpose for purpose, _ in self.calls]

    def review_items(self) -> list[str]:
        ids = []
        for purpose, messages in self.calls:
            if purpose == "review":
                ids.extend(item["item_id"] for item in json.loads(messages[-1]["content"])["items"])
        return ids


def _config(**overrides) -> dict:
    return {"mode": "review_and_fix", "trigger": "manual", "model": "mock-model", **overrides}


def _run(tmp_path: Path, model: MockModel, **overrides) -> tuple[dict, Path]:
    translated = _build_job(tmp_path)
    report = run_refine_for_render(tmp_path, translated, _config(**overrides), chat_fn=model)
    assert report is not None
    return report, translated


def _fix(item_id: str, *edits: dict, note: str = "") -> dict:
    return {"fixes": [{"item_id": item_id, "edits": list(edits), "note": note}]}


def _fix_by_id(report: dict, item_id: str) -> dict:
    return next(fix for fix in report["fixes"] if fix["item_id"] == item_id)


# ---- 挑错 ------------------------------------------------------------------------


def test_no_error_review_returns_empty_list_and_touches_nothing(tmp_path: Path) -> None:
    translated = _build_job(tmp_path)
    before = _snapshot(translated)
    model = MockModel(review=[{"findings": []}])

    report = run_refine_for_render(tmp_path, translated, _config(start_page=2, end_page=2), chat_fn=model)

    assert report["status"] == "completed"
    assert report["review"]["findings"] == []
    assert report["review"]["summary"]["finding_count"] == 0
    assert report["fixes"] == []
    assert model.purposes() == ["review"]
    assert model.review_items() == ["p002-b001"]
    assert _snapshot(translated) == before
    written = json.loads((tmp_path / "artifacts" / "refine_report.v1.json").read_text(encoding="utf-8"))
    assert written["schema"] == "refine_report_v1"
    assert written["scope"] == {"start_page": 2, "end_page": 2, "page_base": 1}


def test_review_prompt_carries_rules_few_shots_and_qa_flags(tmp_path: Path) -> None:
    model = MockModel(review=[{"findings": []}])
    _run(tmp_path, model, mode="review_only")

    system = model.calls[0][1][0]["content"]
    assert "占位符和公式不算漏译" in system
    assert '{"findings": []}' in system
    assert system.count("示例") >= 3
    user = json.loads(model.calls[0][1][1]["content"])
    flagged = {item["item_id"]: item.get("qa_flags", []) for item in user["items"]}
    assert {flag["check"] for flag in flagged["p001-b002"]} == {"numbers"}


def test_findings_whose_target_span_is_not_in_the_translation_are_discarded(tmp_path: Path) -> None:
    model = MockModel(review=[{"findings": [
        {"item_id": "p001-b003", "category": "mistranslation", "severity": "major",
         "target_span": "并不存在的片段", "source_span": "x", "explanation": "e", "suggestion": "s"},
        {"item_id": "p001-b003", "category": "style", "severity": "major",
         "target_span": "能量", "explanation": "not an accuracy category"},
        {"item_id": "p999-b001", "category": "omission", "severity": "major", "target_span": "能量"},
    ]}])
    report, _translated = _run(tmp_path, model, mode="review_only")

    review = report["review"]
    assert review["raw_finding_count"] == 3
    assert review["discarded"] == {"invalid_finding": 1, "target_span_not_found": 1, "unknown_item": 1}
    assert [f for f in review["findings"] if f["origin"] == "review"] == []


def test_qa_major_and_critical_violations_join_the_fix_list(tmp_path: Path) -> None:
    report, _translated = _run(tmp_path, MockModel(), mode="review_only")

    qa_rows = [f for f in report["review"]["findings"] if f["origin"] == "qa"]
    assert {(f["item_id"], f["category"]) for f in qa_rows} == {
        ("p001-b001", "omission"),
        ("p001-b002", "number_unit"),
    }
    assert all(f["qa"]["violation_id"].startswith("qa-") for f in qa_rows)
    assert report["review"]["summary"]["by_origin"] == {"review": 0, "qa": 3}


# ---- 定点修改：拒绝 --------------------------------------------------------------


def _b003_finding() -> dict:
    return {"findings": [{
        "item_id": "p001-b003", "category": "mistranslation", "severity": "major",
        "target_span": "每个量子的能量", "source_span": "The energy ... for each quantum",
        "explanation": "语序可接受，但测试用", "suggestion": "",
    }]}


@pytest.mark.parametrize(
    ("edit", "reason"),
    [
        ({"op": "replace", "find": "量", "replace": "量"}, "find_not_unique"),
        ({"op": "replace", "find": "能量为 $E", "replace": "能量是 $E"}, "crosses_protected_token"),
        ({"op": "insert_after", "anchor": "$E = h", "text": "x"}, "crosses_protected_token"),
        ({"op": "replace", "find": "不存在", "replace": "x"}, "find_not_found"),
        ({"op": "replace", "find": "每个量子的", "replace": "每个量子的" * 6}, "length_budget_exceeded"),
        ({"op": "replace", "find": "每个量子的", "replace": "3个量子的"}, "qa_new_violation"),
        ({"op": "replace", "find": "每个量子的", "replace": "每个量子的"}, "unchanged"),
        ({"op": "replace", "find": "每个", "replace": "<f1-abc/>"}, "introduces_placeholder"),
    ],
)
def test_rejected_edits_keep_the_original_translation(tmp_path: Path, edit: dict, reason: str) -> None:
    translated = _build_job(tmp_path)
    before = _item(translated, "p001-b003")
    model = MockModel(review=[_b003_finding()], fix=[_fix("p001-b003", edit)])

    report = run_refine_for_render(tmp_path, translated, _config(start_page=1, end_page=1), chat_fn=model)

    fix = _fix_by_id(report, "p001-b003")
    assert fix["status"] == "rejected"
    assert fix["reject_reason"] == reason
    assert fix["revision_id"] is None
    assert _item(translated, "p001-b003") == before
    assert all(record["item_id"] != "p001-b003" for record in _revisions(translated))
    assert report["fix_summary"]["reject_reasons"][reason] == 1


def test_fit_overflow_blocks_any_growth(tmp_path: Path) -> None:
    translated = _build_job(tmp_path)
    _write_json(tmp_path / "artifacts" / "fit_report.v1.json", {
        "status": "ok",
        "items": [{"item_id": "p001-b003", "page": 1, "overflow": True, "scale": 0.7}],
    })
    model = MockModel(
        review=[_b003_finding()],
        fix=[_fix("p001-b003", {"op": "replace", "find": "每个量子的", "replace": "每一个量子的"})],
    )

    report = run_refine_for_render(tmp_path, translated, _config(start_page=1, end_page=1), chat_fn=model)

    fix = _fix_by_id(report, "p001-b003")
    assert (fix["status"], fix["reject_reason"]) == ("rejected", "fit_no_growth")
    assert fix["length_budget"] == len(B003_TEXT)
    fix_request = json.loads(next(m for p, m in model.calls if p == "fix")[1]["content"])
    requested = {item["item_id"]: item for item in fix_request["items"]}
    assert requested["p001-b003"]["may_grow"] is False
    assert requested["p001-b003"]["max_chars"] == len(B003_TEXT)
    assert requested["p001-b001"]["may_grow"] is True


def test_validation_failure_is_rejected_with_the_same_checks_as_write_back(tmp_path: Path) -> None:
    # 把行内公式的右定界符删掉：写回校验（math_delimiter_unbalanced）必须拦下。
    translated = _build_job(tmp_path)
    before = _item(translated, "p001-b003")
    model = MockModel(
        review=[_b003_finding()],
        fix=[_fix("p001-b003", {"op": "replace", "find": "每个量子的能量为", "replace": "每个量子的能量为 $"})],
    )

    report = run_refine_for_render(tmp_path, translated, _config(start_page=1, end_page=1), chat_fn=model)

    fix = _fix_by_id(report, "p001-b003")
    assert fix["status"] == "rejected"
    assert fix["reject_reason"] == "validation_failed"
    assert "math_delimiter" in fix["reject_detail"]
    assert _item(translated, "p001-b003") == before


def test_model_returning_no_edit_is_skipped(tmp_path: Path) -> None:
    model = MockModel(review=[_b003_finding()], fix=[{"fixes": [{"item_id": "p001-b003", "edits": []}]}])
    report, _translated = _run(tmp_path, model, start_page=1, end_page=1)

    fix = _fix_by_id(report, "p001-b003")
    assert (fix["status"], fix["reject_reason"]) == ("skipped", "model_returned_no_edit")


def test_minor_findings_are_reported_but_not_fixed(tmp_path: Path) -> None:
    finding = _b003_finding()
    finding["findings"][0]["severity"] = "minor"
    model = MockModel(review=[finding])
    report, _translated = _run(tmp_path, model, start_page=1, end_page=1)

    assert all(fix["item_id"] != "p001-b003" for fix in report["fixes"])
    assert report["review"]["summary"]["by_severity"]["minor"] == 1


# ---- 定点修改：采纳 --------------------------------------------------------------


def test_omission_is_filled_with_insert_after_and_written_back(tmp_path: Path) -> None:
    translated = _build_job(tmp_path)
    model = MockModel(
        review=[{"findings": [{
            "item_id": "p001-b001", "category": "omission", "severity": "critical",
            "target_span": B001_TEXT, "source_span": "Its energy levels are equally spaced and never cross each other.",
            "explanation": "漏译第二句", "suggestion": "它的能级等间距且互不交叉。",
        }]}],
        fix=[{"fixes": [
            {"item_id": "p001-b001", "edits": [
                {"op": "insert_after", "anchor": B001_TEXT, "text": "它的能级等间距，而且彼此从不交叉。"}
            ], "note": "补译第二句"},
            {"item_id": "p001-b002", "edits": [{"op": "replace", "find": "289 K", "replace": "298 K"}]},
        ]}],
    )

    report = run_refine_for_render(tmp_path, translated, _config(start_page=1, end_page=1), chat_fn=model)

    fix = _fix_by_id(report, "p001-b001")
    assert fix["status"] == "applied", fix
    expected = B001_TEXT + "它的能级等间距，而且彼此从不交叉。"
    assert fix["after"] == expected
    assert fix["edits"] == [{"op": "insert_after", "anchor": B001_TEXT, "text": "它的能级等间距，而且彼此从不交叉。"}]
    assert _item(translated, "p001-b001")["translated_text"] == expected
    revisions = _revisions(translated)
    record = next(r for r in revisions if r["item_id"] == "p001-b001")
    assert record["source"] == "refine"
    assert record["previous_text"] == B001_TEXT
    assert record["revision_id"] == fix["revision_id"]
    assert "omission" in record["reason"]
    _assert_checkpoint_consistent(translated)

    number_fix = _fix_by_id(report, "p001-b002")
    assert number_fix["status"] == "applied"
    assert _item(translated, "p001-b002")["translated_text"] == "在 298 K 时键长为 1.21 Å。"

    resolved = {(row["item_id"], row["check"]) for row in report["qa_delta"]["resolved"]}
    assert ("p001-b001", "omission") in resolved
    assert ("p001-b002", "numbers") in resolved
    assert report["qa_delta"]["introduced"] == []
    assert report["qa_after"]["by_severity"]["critical"] == 0
    assert report["translation"]["before"]["generation"] == 3
    assert report["translation"]["after"]["generation"] == 5
    assert report["fix_summary"]["applied"] == 2
    assert model.purposes() == ["review", "fix"]


# ---- 模式与开关 ------------------------------------------------------------------


def test_review_only_changes_nothing_but_the_report(tmp_path: Path) -> None:
    translated = _build_job(tmp_path)
    before = _snapshot(translated)
    model = MockModel(review=[_b003_finding()], fix=[_fix("p001-b003", {"op": "replace", "find": "每个", "replace": "各"})])

    report = run_refine_for_render(tmp_path, translated, _config(mode="review_only"), chat_fn=model)

    assert report["mode"] == "review_only"
    assert report["review"]["summary"]["finding_count"] == 4
    assert report["fixes"] == []
    assert model.purposes() == ["review"]
    assert _snapshot(translated) == before
    assert sorted(p.name for p in (tmp_path / "artifacts").iterdir()) == ["refine_report.v1.json"]


def test_mode_off_has_zero_side_effects(tmp_path: Path) -> None:
    translated = _build_job(tmp_path)
    before = _snapshot(tmp_path)
    model = MockModel()

    for config in ({"mode": "off"}, {}, None, {"mode": "bogus"}, {"mode": "OFF", "trigger": "manual"}):
        assert run_refine_for_render(tmp_path, translated, config, chat_fn=model) is None
    # 不存在的目录也不报错：说明 off 时根本没去读。
    assert run_refine_for_render(tmp_path / "missing", tmp_path / "missing" / "translated", {"mode": "off"}) is None

    assert model.calls == []
    assert _snapshot(tmp_path) == before
    assert not (tmp_path / "artifacts").exists()


def test_auto_trigger_skips_when_this_translation_was_already_refined(tmp_path: Path) -> None:
    translated = _build_job(tmp_path)
    first = run_refine_for_render(tmp_path, translated, _config(mode="review_only", trigger="auto"), chat_fn=MockModel())
    assert first is not None
    model = MockModel()

    assert run_refine_for_render(tmp_path, translated, _config(mode="review_only", trigger="auto"), chat_fn=model) is None
    assert model.calls == []
    # manual 总是跑。
    assert run_refine_for_render(tmp_path, translated, _config(mode="review_only", trigger="manual"), chat_fn=model)
    assert model.calls

    # 换了一次翻译（attempt_id 变了）：auto 也要重新跑。
    report_path = tmp_path / "artifacts" / "refine_report.v1.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    report["translation"]["before"]["attempt_id"] = "attempt-0"
    report["translation"] = {"attempt_id": "attempt-0", "fingerprint": "d" * 64}
    report_path.write_text(json.dumps(report), encoding="utf-8")
    assert run_refine_for_render(tmp_path, translated, _config(mode="review_only", trigger="auto"), chat_fn=MockModel())


# ---- 成本上限与失败 ---------------------------------------------------------------


def test_max_items_limits_review_and_is_reported(tmp_path: Path) -> None:
    model = MockModel()
    report, _translated = _run(tmp_path, model, mode="review_only", max_items=2)

    assert model.review_items() == ["p001-b001", "p001-b002"]
    assert report["stopped_reason"] == "max_items"
    assert report["status"] == "stopped"
    assert report["review"]["candidate_item_count"] == 4
    assert report["review"]["reviewed_item_count"] == 2


def test_max_tokens_stops_before_the_next_request(tmp_path: Path) -> None:
    model = MockModel(usage={"prompt_tokens": 900, "completion_tokens": 100, "total_tokens": 1000})
    report, translated = _run(tmp_path, model, max_tokens=50)

    # 第一个请求的预估就已经超预算：一个请求都不发。
    assert model.calls == []
    assert report["stopped_reason"] == "max_tokens"
    assert {fix["reject_reason"] for fix in report["fixes"]} == {"budget_exhausted"}
    assert _revisions(translated) == []


def test_token_usage_is_recorded_per_phase(tmp_path: Path) -> None:
    model = MockModel(
        review=[_b003_finding()],
        fix=[_fix("p001-b003", {"op": "replace", "find": "每个", "replace": "各"})],
        usage={"prompt_tokens": 900, "completion_tokens": 100, "total_tokens": 1000},
    )
    report, _translated = _run(tmp_path, model, start_page=1, end_page=1)

    usage = report["token_usage"]
    assert usage["usage_source"] == "provider"
    assert usage["total_tokens"] == 2000
    assert usage["by_phase"]["review"]["requests"] == 1
    assert usage["by_phase"]["fix"]["requests"] == 1


def test_llm_errors_are_reported_and_never_raised(tmp_path: Path) -> None:
    translated = _build_job(tmp_path)
    before = _snapshot(translated)
    model = MockModel(review=[RuntimeError("upstream 500")], fix=[RuntimeError("upstream 500")])

    report = run_refine_for_render(tmp_path, translated, _config(), chat_fn=model)

    assert report["stopped_reason"] == "llm_error"
    assert {fix["reject_reason"] for fix in report["fixes"]} == {"llm_error"}
    assert any("upstream 500" in error["message"] for error in report["errors"])
    assert _snapshot(translated) == before


def test_unexpected_failure_writes_a_failed_report(tmp_path: Path, monkeypatch) -> None:
    from retainpdf_pipeline.translate.workflow import refine as module

    translated = _build_job(tmp_path)

    def _boom(*args, **kwargs):
        raise OSError("disk went away")

    monkeypatch.setattr(module, "build_translation_qa_for_job", _boom)
    report = run_refine_for_render(tmp_path, translated, _config(), chat_fn=MockModel())

    assert report["status"] == "failed"
    assert report["stopped_reason"] == "error"
    assert "disk went away" in report["errors"][-1]["message"]
    written = json.loads((tmp_path / "artifacts" / "refine_report.v1.json").read_text(encoding="utf-8"))
    assert written["status"] == "failed"


def test_unparseable_review_is_counted_as_failed_batch(tmp_path: Path) -> None:
    report, _translated = _run(tmp_path, MockModel(review=["这不是 JSON"]), mode="review_only")
    assert report["review"]["failed_batch_count"] == 1


# ---- 编辑操作（纯函数）-----------------------------------------------------------


def test_edits_never_touch_placeholders() -> None:
    text = "设 <f1-abc/> 为势能，则 <f2-xyz/> 成立。"
    with pytest.raises(EditRejected) as exc:
        apply_edits(text, [{"op": "replace", "find": "<f1-abc/> 为", "replace": "是"}])
    assert exc.value.reason == "crosses_protected_token"
    with pytest.raises(EditRejected) as exc:
        apply_edits(text, [{"op": "replace", "find": "abc/> 为势能", "replace": "是"}])
    assert exc.value.reason == "crosses_protected_token"
    after, _ = apply_edits(text, [{"op": "replace", "find": "为势能", "replace": "表示势能"}])
    assert after == "设 <f1-abc/> 表示势能，则 <f2-xyz/> 成立。"


# ---- 进度事件 ----------------------------------------------------------------------


def test_progress_events_use_the_render_refining_substage(tmp_path: Path) -> None:
    translated = _build_job(tmp_path)
    writer = PipelineEventWriter(job_id="job-1", job_root=tmp_path, logs_dir=tmp_path / "logs", workflow="book")
    with pipeline_event_writer_scope(writer):
        run_refine_for_render(tmp_path, translated, _config(mode="review_only"), chat_fn=MockModel())

    events = [json.loads(line) for line in (tmp_path / "logs" / "pipeline_events.jsonl").read_text().splitlines()]
    assert events
    assert {event["stage"] for event in events} == {"rendering"}
    assert {event["substage"] for event in events} == {"refining"}
    assert {event["user_stage"] for event in events} == {"render"}
    assert {event["progress_unit"] for event in events} == {"step"}
    assert events[-1]["payload"]["refine_phase"] == "done"
    currents = [event["progress_current"] for event in events if event["event_type"] == "stage_progress"]
    assert currents == sorted(currents)


# ---- spec 解析与 render-only 编排 --------------------------------------------------


def _render_spec(tmp_path: Path, refine: dict | None) -> Path:
    _build_job(tmp_path)
    source_pdf = tmp_path / "source" / "doc.pdf"
    source_pdf.parent.mkdir(parents=True, exist_ok=True)
    source_pdf.write_bytes(b"%PDF-1.4\n")
    params = {"start_page": 0, "end_page": -1, "model": "m", "base_url": "https://example.invalid/v1", "credential_ref": ""}
    if refine is not None:
        params["refine"] = refine
    spec = {
        "schema_version": "render.stage.v1",
        "stage": "render",
        "job": {"job_id": "job-1", "job_root": str(tmp_path), "workflow": "book"},
        "inputs": {"source_pdf": str(source_pdf), "translations_dir": str(tmp_path / "translated")},
        "params": params,
    }
    path = tmp_path / "specs" / "render.spec.json"
    _write_json(path, spec)
    return path


def test_render_spec_without_refine_reads_as_off(tmp_path: Path) -> None:
    spec = RenderStageSpec.load(_render_spec(tmp_path, None))
    assert spec.params.refine == RenderStageRefineParams()
    assert spec.params.refine.mode == "off"
    assert spec.params.refine.enabled is False


def test_render_spec_refine_is_normalized(tmp_path: Path) -> None:
    spec = RenderStageSpec.load(_render_spec(tmp_path, {
        "mode": "Review_And_Fix", "trigger": "manual", "start_page": 3, "end_page": None,
        "max_items": 0, "max_tokens": -5, "reviewer_model": " r ", "reviewer_base_url": "",
        "reviewer_credential_ref": "env:REVIEWER_KEY",
    }))
    refine = spec.params.refine
    assert refine.as_dict() == {
        "mode": "review_and_fix", "trigger": "manual", "start_page": 3, "end_page": None,
        "max_items": 0, "max_tokens": 400000, "reviewer_model": "r", "reviewer_base_url": "",
        "reviewer_credential_ref": "env:REVIEWER_KEY",
    }
    bogus = RenderStageRefineParams.from_payload({"mode": "rewrite_everything", "trigger": "sometimes"})
    assert (bogus.mode, bogus.trigger) == ("off", "auto")
    cfg = refine_config_from_mapping({**refine.as_dict(), "model": "m"})
    assert cfg.page_in_scope(3) and not cfg.page_in_scope(2)


def _patch_render_only(monkeypatch, calls: list[str]) -> None:
    from retainpdf_pipeline.runtime.pipeline import render_only_pipeline as module

    monkeypatch.setattr(module, "render_only_main", lambda: calls.append("render"))
    monkeypatch.setattr(module, "refresh_translation_qa_after_render", lambda *a, **k: calls.append("qa"))

    def _refine(*args, **kwargs):
        calls.append("refine")
        return {"status": "completed"}

    monkeypatch.setattr(module, "run_refine_for_render", _refine)


@pytest.mark.parametrize("refine", [None, {"mode": "off", "trigger": "auto"}])
def test_render_only_main_with_refine_off_is_unchanged(tmp_path: Path, monkeypatch, refine) -> None:
    """refine=off（含旧 spec）：render-only 的调用序列与 79334d56 完全一致——渲染、QA 重算，零精修读写。"""
    from retainpdf_pipeline.runtime.pipeline import render_only_pipeline as module

    spec_path = _render_spec(tmp_path, refine)
    before = _snapshot(tmp_path)
    calls: list[str] = []
    _patch_render_only(monkeypatch, calls)
    monkeypatch.setattr("sys.argv", ["render-only", "--spec", str(spec_path)])

    module.main()

    assert calls == ["render", "qa"]
    assert _snapshot(tmp_path) == before
    assert not (tmp_path / "logs").exists()
    assert not (tmp_path / "artifacts").exists()


def test_render_only_main_refines_before_rendering(tmp_path: Path, monkeypatch) -> None:
    from retainpdf_pipeline.runtime.pipeline import render_only_pipeline as module

    spec_path = _render_spec(tmp_path, {"mode": "review_only", "trigger": "manual"})
    calls: list[str] = []
    _patch_render_only(monkeypatch, calls)
    monkeypatch.setattr("sys.argv", ["render-only", "--spec", str(spec_path)])

    module.main()

    assert calls == ["refine", "render", "qa"]


def test_render_only_refine_failure_does_not_block_rendering(tmp_path: Path, monkeypatch) -> None:
    from retainpdf_pipeline.runtime.pipeline import render_only_pipeline as module

    spec_path = _render_spec(tmp_path, {"mode": "review_and_fix", "trigger": "manual"})
    calls: list[str] = []
    _patch_render_only(monkeypatch, calls)

    def _boom(*args, **kwargs):
        raise RuntimeError("refine exploded")

    monkeypatch.setattr(module, "run_refine_for_render", _boom)
    monkeypatch.setattr("sys.argv", ["render-only", "--spec", str(spec_path)])

    module.main()

    assert calls == ["render", "qa"]


def test_render_spec_refine_runs_end_to_end_with_mock_model(tmp_path: Path) -> None:
    from retainpdf_pipeline.runtime.pipeline.render_only_pipeline import refine_translation_for_render_spec

    spec_path = _render_spec(tmp_path, {"mode": "review_only", "trigger": "manual", "start_page": 2})
    report = refine_translation_for_render_spec(spec_path, chat_fn=MockModel())

    assert report["mode"] == "review_only"
    assert report["models"]["reviewer"] == {"model": "m", "base_url": "https://example.invalid/v1", "inherited": True}
    events = (tmp_path / "logs" / "pipeline_events.jsonl").read_text(encoding="utf-8")
    assert '"substage": "refining"' in events


# ---- 契约 --------------------------------------------------------------------------

_BACKEND_ROOT = Path(__file__).resolve().parents[4]
_SCHEMA_PATH = _BACKEND_ROOT / "contracts" / "refine-report.v1.schema.json"


def _check(schema: dict, value, root: dict, path: str = "$") -> list[str]:
    """够用就好的 JSON Schema 子集校验（本仓库不装 jsonschema）。"""
    if "$ref" in schema:
        target = root
        for part in schema["$ref"][2:].split("/"):
            target = target[part]
        return _check(target, value, root, path)
    if "anyOf" in schema:
        if any(not _check(option, value, root, path) for option in schema["anyOf"]):
            return []
        return [f"{path}: matches no anyOf branch"]
    errors: list[str] = []
    types = schema.get("type")
    if types is not None:
        names = types if isinstance(types, list) else [types]
        checks = {
            "object": lambda v: isinstance(v, dict),
            "array": lambda v: isinstance(v, list),
            "string": lambda v: isinstance(v, str),
            "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
            "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
            "boolean": lambda v: isinstance(v, bool),
            "null": lambda v: v is None,
        }
        if not any(checks[name](value) for name in names):
            return [f"{path}: {value!r} is not {names}"]
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: {value!r} not in enum")
    if "const" in schema and value != schema["const"]:
        errors.append(f"{path}: {value!r} != const")
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                errors.append(f"{path}: missing {key}")
        properties = schema.get("properties", {})
        extra = schema.get("additionalProperties", True)
        for key, item in value.items():
            if key in properties:
                errors.extend(_check(properties[key], item, root, f"{path}.{key}"))
            elif extra is False:
                errors.append(f"{path}: unexpected key {key}")
            elif isinstance(extra, dict):
                errors.extend(_check(extra, item, root, f"{path}.{key}"))
    if isinstance(value, list) and "items" in schema:
        for index, item in enumerate(value):
            errors.extend(_check(schema["items"], item, root, f"{path}[{index}]"))
    return errors


def _assert_matches_contract(report: dict) -> None:
    schema = json.loads(_SCHEMA_PATH.read_text(encoding="utf-8"))
    errors = _check(schema["definitions"]["RefineReport"], report, schema)
    assert errors == []


def test_reports_match_the_contract_schema(tmp_path: Path) -> None:
    model = MockModel(
        review=[{"findings": [
            {"item_id": "p001-b001", "category": "omission", "severity": "critical",
             "target_span": B001_TEXT, "source_span": "Its energy levels are equally spaced.",
             "explanation": "漏译第二句", "suggestion": "它的能级等间距。"},
            {"item_id": "p001-b003", "category": "mistranslation", "severity": "minor",
             "target_span": "能量", "source_span": "energy", "explanation": "e", "suggestion": "s"},
        ]}],
        fix=[{"fixes": [
            {"item_id": "p001-b001", "edits": [{"op": "insert_after", "anchor": B001_TEXT, "text": "它的能级等间距。"}]},
            {"item_id": "p001-b002", "edits": [{"op": "replace", "find": "1", "replace": "2"}]},
        ]}],
    )
    report, _translated = _run(tmp_path, model)
    assert {fix["status"] for fix in report["fixes"]} == {"applied", "rejected"}
    _assert_matches_contract(report)

    review_only, _ = _run(tmp_path / "ro", MockModel(), mode="review_only", max_items=1)
    _assert_matches_contract(review_only)

    failed = run_refine_for_render(tmp_path / "none", tmp_path / "none" / "translated", _config(), chat_fn=MockModel())
    _assert_matches_contract(failed)


def test_contract_mirrors_are_byte_identical() -> None:
    upstream = _BACKEND_ROOT.parent / "contracts" / "refine-report.v1.schema.json"
    if not upstream.is_file():
        pytest.skip("monorepo upstream contracts unavailable")
    assert upstream.read_bytes() == _SCHEMA_PATH.read_bytes()


def test_qa_category_mapping_uses_real_qa_check_names() -> None:
    from retainpdf_pipeline.translate.services.quality.qa.report import CHECK_ORDER
    from retainpdf_pipeline.translate.services.refine.review import CATEGORIES
    from retainpdf_pipeline.translate.services.refine.review import QA_CHECK_CATEGORY

    assert set(QA_CHECK_CATEGORY) <= set(CHECK_ORDER)
    assert set(QA_CHECK_CATEGORY.values()) <= set(CATEGORIES)


def test_missing_credentials_never_call_a_model_and_keep_everything(tmp_path: Path, monkeypatch) -> None:
    from retainpdf_pipeline.translate.services.refine import llm as llm_module

    monkeypatch.delenv("RETAIN_TEST_MISSING_KEY", raising=False)
    monkeypatch.setattr(llm_module, "request_chat_content", lambda *a, **k: pytest.fail("model must not be called"))
    translated = _build_job(tmp_path)
    before = _snapshot(translated)

    report = run_refine_for_render(
        tmp_path, translated, _config(credential_ref="env:RETAIN_TEST_MISSING_KEY"), chat_fn=None
    )

    assert report["stopped_reason"] == "llm_unavailable"
    assert {fix["reject_reason"] for fix in report["fixes"]} == {"llm_unavailable"}
    assert report["token_usage"]["requests"] == 0
    assert _snapshot(translated) == before
    assert "RETAIN_TEST_MISSING_KEY" not in json.dumps(report["models"])


def test_length_budget_allows_growth_only_for_omissions() -> None:
    from retainpdf_pipeline.translate.services.quality.qa.units import build_qa_items
    from retainpdf_pipeline.translate.services.refine.fix import length_budget
    from retainpdf_pipeline.translate.services.refine.review import Finding

    item = next(i for i in build_qa_items(_pages()) if i.item_id == "p001-b001")

    def finding(category: str, span: str, origin: str = "review") -> Finding:
        return Finding("rf-1", item.item_id, 1, category, "major", "x", span, "", "", origin)

    base = len(B001_TEXT)
    assert length_budget(item, [finding("mistranslation", "abc")], no_growth=False) == int(base * 1.1)
    assert length_budget(item, [finding("omission", "x" * 20)], no_growth=False) == int(base * 1.1) + 20
    # QA 漏译疑点没有片段：按整块原文；有挑错片段时不再叠加整块原文。
    assert length_budget(item, [finding("omission", "", "qa")], no_growth=False) == int(base * 1.1) + len(B001_SOURCE)
    assert length_budget(item, [finding("omission", "x" * 20), finding("omission", "", "qa")], no_growth=False) == int(base * 1.1) + 20
    assert length_budget(item, [finding("omission", "x" * 20)], no_growth=True) == base
