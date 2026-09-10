import json
import sys
import tempfile
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from devtools.promptfoo.capture_case import main as capture_case_main
import devtools.promptfoo.capture_case as capture_case_module
from devtools.promptfoo.common import build_case_drift_summary
from devtools.promptfoo.common import read_fixture_rows
from devtools.promptfoo.common import resolve_case_artifact_path
from devtools.promptfoo.common import write_fixture_rows
import devtools.promptfoo.tests as promptfoo_tests


def _build_saved_payload(job_root: Path, *, translated_text: str = "") -> dict[str, object]:
    return {
        "job_root": str(job_root),
        "job_id": job_root.name,
        "page_idx": 0,
        "page_number": 1,
        "page_path": str(job_root / "translated" / "page-001.json"),
        "source_text": "Geometry Optimization and Energy Calculation.",
        "translated_text": translated_text,
        "item": {
            "item_id": "p001-b001",
            "page_idx": 0,
            "block_idx": 1,
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "structure_role": "body",
            "policy_translate": True,
            "asset_id": "",
            "reading_order": 1,
            "raw_block_type": "text",
            "normalized_sub_type": "",
            "math_mode": "direct_typst",
            "source_text": "Geometry Optimization and Energy Calculation.",
            "translated_text": translated_text,
            "classification_label": "skip_model_keep_origin",
            "should_translate": False,
            "skip_reason": "skip_model_keep_origin",
            "final_status": "kept_origin",
            "translation_diagnostics": {},
        },
    }


def _write_fake_job(job_root: Path) -> None:
    (job_root / "translated").mkdir(parents=True, exist_ok=True)
    (job_root / "specs").mkdir(parents=True, exist_ok=True)
    source_json = job_root / "ocr" / "normalized" / "document.v1.json"
    source_json.parent.mkdir(parents=True, exist_ok=True)
    source_json.write_text('{"pages":[]}', encoding="utf-8")
    source_pdf = job_root / "source" / "input.pdf"
    source_pdf.parent.mkdir(parents=True, exist_ok=True)
    source_pdf.write_bytes(b"%PDF-1.4\n")
    payload_path = job_root / "translated" / "page-001.json"
    payload_path.write_text(
        json.dumps(
            [
                {
                    "item_id": "p001-b001",
                    "page_idx": 0,
                    "block_idx": 1,
                    "block_type": "text",
                    "block_kind": "text",
                    "layout_role": "paragraph",
                    "semantic_role": "body",
                    "structure_role": "body",
                    "policy_translate": True,
                    "asset_id": "",
                    "reading_order": 1,
                    "raw_block_type": "text",
                    "normalized_sub_type": "",
                    "math_mode": "direct_typst",
                    "source_text": "Geometry Optimization and Energy Calculation.",
                    "translated_text": "",
                    "classification_label": "skip_model_keep_origin",
                    "should_translate": False,
                    "skip_reason": "skip_model_keep_origin",
                    "final_status": "kept_origin",
                    "translation_diagnostics": {},
                }
            ],
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    spec_path = job_root / "specs" / "translate.spec.json"
    spec_path.write_text(
        json.dumps(
            {
                "schema_version": "translate.stage.v1",
                "stage": "translate",
                "job": {
                    "job_id": job_root.name,
                    "job_root": str(job_root),
                    "workflow": "translate",
                },
                "inputs": {
                    "source_json": str(source_json),
                    "source_pdf": str(source_pdf),
                    "layout_json": str(source_json),
                },
                "params": {
                    "start_page": 0,
                    "end_page": 0,
                    "batch_size": 1,
                    "workers": 1,
                    "mode": "sci",
                    "math_mode": "direct_typst",
                    "skip_title_translation": False,
                    "classify_batch_size": 4,
                    "rule_profile_name": "general_sci",
                    "custom_rules_text": "",
                    "glossary_id": "",
                    "glossary_name": "",
                    "glossary_resource_entry_count": 0,
                    "glossary_inline_entry_count": 0,
                    "glossary_overridden_entry_count": 0,
                    "glossary_entries": [],
                    "model": "deepseek-chat",
                    "base_url": "https://api.deepseek.com/v1",
                    "credential_ref": "env:RETAIN_TRANSLATION_API_KEY",
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    manifest_path = job_root / "translated" / "translation-manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "schema": "translation_manifest_v1",
                "schema_version": 1,
                "pages": [
                    {
                        "page_index": 0,
                        "page_number": 1,
                        "path": "page-001.json",
                    }
                ],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def test_build_case_drift_summary_detects_strategy_shift() -> None:
    saved_payload = _build_saved_payload(Path("/tmp/job-case"))
    replay_payload = {
        "policy_before": {
            "classification_label": "skip_model_keep_origin",
            "should_translate": False,
            "skip_reason": "skip_model_keep_origin",
            "final_status": "kept_origin",
        },
        "policy_after": {
            "classification_label": "",
            "should_translate": True,
            "skip_reason": "",
            "final_status": "kept_origin",
        },
        "replay_result": {
            "translated_text": "几何优化与能量计算。",
            "final_status": "translated",
        },
        "replay_error": None,
    }

    summary = build_case_drift_summary(saved_payload, replay_payload)

    assert summary["drifted"] is True
    assert summary["saved_should_translate"] is False
    assert summary["replay_should_translate"] is True
    assert summary["replay_result_final_status"] == "translated"
    assert "should_translate_changed" in summary["reason_tags"]
    assert "final_status_changed" in summary["reason_tags"]
    assert "translation_presence_changed" in summary["reason_tags"]


def test_capture_case_writes_fixture_and_case_artifact(monkeypatch) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        job_root = tmp_path / "job-1"
        _write_fake_job(job_root)
        fixtures_path = tmp_path / "fixtures" / "cases.csv"

        replay_payload = {
            "job_root": str(job_root),
            "job_id": "job-1",
            "item_id": "p001-b001",
            "page_idx": 0,
            "page_path": str(job_root / "translated" / "page-001.json"),
            "policy_before": {
                "classification_label": "skip_model_keep_origin",
                "should_translate": False,
                "skip_reason": "skip_model_keep_origin",
                "final_status": "kept_origin",
            },
            "policy_after": {
                "classification_label": "",
                "should_translate": True,
                "skip_reason": "",
                "final_status": "kept_origin",
            },
            "replay_result": {
                "translated_text": "几何优化与能量计算。",
                "final_status": "translated",
            },
            "replay_error": None,
        }

        monkeypatch.setattr(
            capture_case_module,
            "replay_translation_item",
            lambda *_args, **_kwargs: replay_payload,
        )
        monkeypatch.setattr(
            sys,
            "argv",
            [
                "capture_case.py",
                "--job-root",
                str(job_root),
                "--item-id",
                "p001-b001",
                "--description",
                "geometry paragraph drift",
                "--fixtures",
                str(fixtures_path),
            ],
        )

        assert capture_case_main() == 0

        rows = read_fixture_rows(fixtures_path)
        assert len(rows) == 1
        assert rows[0]["item_id"] == "p001-b001"
        assert rows[0]["case_artifact"]

        artifact_path = fixtures_path.parent / str(rows[0]["case_artifact"])
        artifact = json.loads(artifact_path.read_text(encoding="utf-8"))
        assert artifact["schema"] == "translation_case_bundle_v1"
        assert artifact["fixture"]["description"] == "geometry paragraph drift"
        assert artifact["saved"]["snapshot"]["item_id"] == "p001-b001"
        assert artifact["replay_input"]["item_id"] == "p001-b001"
        assert artifact["replay_input"]["spec"]["math_mode"] == "direct_typst"
        assert artifact["replay"]["replay_result"]["final_status"] == "translated"
        assert artifact["drift"]["drifted"] is True


def test_generate_tests_uses_case_artifact_when_job_root_is_missing(monkeypatch) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        fixtures_path = tmp_path / "cases.csv"
        artifact_path = tmp_path / "artifact.json"
        artifact_path.write_text(
            json.dumps(
                {
                    "schema": "translation_case_bundle_v1",
                    "saved": {
                        "snapshot": {
                            "job_root": "missing-job",
                            "job_id": "missing-job",
                            "item_id": "p001-b001",
                            "page_idx": 0,
                            "page_number": 1,
                            "page_path": "translated/page-001.json",
                            "block_idx": 1,
                            "block_type": "text",
                            "math_mode": "direct_typst",
                            "source_text": "Artifact-only source text.",
                            "translated_text": "仅靠 artifact 的翻译。",
                            "classification_label": "translated",
                            "should_translate": True,
                            "skip_reason": "",
                            "final_status": "translated",
                            "translation_diagnostics": {},
                        },
                        "item": {
                            "item_id": "p001-b001",
                            "page_idx": 0,
                            "block_idx": 1,
                            "block_type": "text",
                            "math_mode": "direct_typst",
                            "source_text": "Artifact-only source text.",
                            "translated_text": "仅靠 artifact 的翻译。",
                            "classification_label": "translated",
                            "should_translate": True,
                            "skip_reason": "",
                            "final_status": "translated",
                            "translation_diagnostics": {},
                        },
                    },
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        write_fixture_rows(
            fixtures_path,
            [
                {
                    "enabled": True,
                    "job_root": "missing-job",
                    "item_id": "p001-b001",
                    "description": "artifact only case",
                    "source_excerpt": "Artifact-only source text.",
                    "expected_contains": [],
                    "required_terms": [],
                    "forbidden_substrings": [],
                    "require_cjk": True,
                    "min_cjk_chars": 1,
                    "min_output_chars": 4,
                    "expected_inline_math_count": None,
                    "expected_block_math_count": None,
                    "case_artifact": str(artifact_path),
                    "notes": "",
                }
            ],
        )

        monkeypatch.setenv("PROMPTFOO_TRANSLATION_FIXTURES", str(fixtures_path))

        tests = promptfoo_tests.generate_tests()

        assert len(tests) == 1
        assert tests[0]["description"] == "artifact only case"
        assert tests[0]["vars"]["source_text"] == "Artifact-only source text."
        assert tests[0]["vars"]["saved_text"] == "仅靠 artifact 的翻译。"


def test_repo_promptfoo_fixtures_have_case_artifacts() -> None:
    fixtures_path = REPO_SCRIPTS_ROOT / "devtools" / "promptfoo" / "fixtures" / "cases.csv"
    missing: list[str] = []

    for row in read_fixture_rows(fixtures_path):
        if not row.get("enabled", True):
            continue
        artifact_path = resolve_case_artifact_path(
            str(row["job_root"]),
            str(row["item_id"]),
            str(row.get("case_artifact") or ""),
        )
        if not artifact_path.exists():
            missing.append(f'{row["job_root"]}:{row["item_id"]} -> {artifact_path}')

    assert missing == []
