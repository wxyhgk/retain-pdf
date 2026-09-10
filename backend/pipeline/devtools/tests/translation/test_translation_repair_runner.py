import copy
import json
import sys
import tempfile
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from devtools.translation_repair_runner import TRANSLATION_REPAIR_PLAN_SCHEMA
from devtools.translation_repair_runner import TRANSLATION_REPAIR_PREVIEW_SCHEMA
from devtools.translation_repair_runner import build_translation_repair_plan
from devtools.translation_repair_runner import build_translation_repair_preview
from devtools.translation_repair_runner import load_translation_repair_inputs
from retainpdf_pipeline.translate.artifacts.review import TRANSLATION_REVIEW_FILE_NAME


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _strict_item(item_id: str, source_text: str, translated_text: str, *, block_idx: int) -> dict:
    return {
        "item_id": item_id,
        "page_idx": 0,
        "block_idx": block_idx,
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "translation_unit_protected_source_text": source_text,
        "translation_unit_source_text": source_text,
        "source_text": source_text,
        "translated_text": translated_text,
        "translation_unit_protected_translated_text": translated_text,
        "final_status": "translated",
        "math_mode": "placeholder",
        "block_kind": "text",
        "layout_role": "body",
        "semantic_role": "body",
        "structure_role": "body",
        "policy_translate": True,
        "asset_id": "",
        "reading_order": block_idx,
        "raw_block_type": "text",
        "normalized_sub_type": "",
    }


def _write_fake_job(job_root: Path) -> list[dict]:
    job_root.mkdir(parents=True, exist_ok=True)
    source_pdf = job_root / "source.pdf"
    source_json = job_root / "source.json"
    source_pdf.write_bytes(b"%PDF-1.4\n")
    _write_json(source_json, {})
    _write_json(
        job_root / "specs" / "translate.spec.json",
        {
            "schema_version": "translate.stage.v1",
            "stage": "translate",
            "job": {
                "job_id": "job-repair-test",
                "job_root": str(job_root),
                "workflow": "book",
            },
            "inputs": {
                "source_json": str(source_json),
                "source_pdf": str(source_pdf),
                "layout_json": None,
            },
            "params": {
                "start_page": 0,
                "end_page": 0,
                "batch_size": 1,
                "workers": 1,
                "mode": "sci",
                "math_mode": "placeholder",
                "skip_title_translation": False,
                "classify_batch_size": 12,
                "rule_profile_name": "general_sci",
                "custom_rules_text": "",
                "glossary_entries": [
                    {"source": "SCF", "target": "自洽场", "level": "preferred"},
                    {"source": "Hartree-Fock", "target": "Hartree-Fock", "level": "preserve"},
                ],
                "model": "demo-model",
                "base_url": "https://example.com/v1",
                "credential_ref": "",
            },
        },
    )
    items = [
        _strict_item(
            "p001-b001",
            "The SCF cycle preserves <f1-abc/>.",
            "SCF cycle preserves <f1-abc/>.",
            block_idx=1,
        ),
        _strict_item(
            "p001-b002",
            "The final energy <f2-def/> is reported.",
            "最终能量 <f9-bad/> 被报告。",
            block_idx=2,
        ),
    ]
    _write_json(job_root / "translated" / "page-0001.json", items)
    _write_json(
        job_root / "translated" / "translation-manifest.json",
        {
            "schema": "translation_manifest_v1",
            "schema_version": 1,
            "pages": [{"page_index": 0, "page_number": 1, "path": "page-0001.json"}],
        },
    )
    _write_json(
        job_root / "artifacts" / TRANSLATION_REVIEW_FILE_NAME,
        {
            "schema": "translation_review_v1",
            "schema_version": 1,
            "reviewed_item_count": 2,
            "issue_count": 3,
            "issues": [
                {
                    "item_id": "p001-b001",
                    "kind": "english_residue",
                    "severity": "error",
                    "message": "english",
                    "retryable": True,
                    "page_idx": 0,
                    "page_number": 1,
                    "block_idx": 1,
                },
                {
                    "item_id": "p001-b001",
                    "kind": "glossary_term_missing",
                    "severity": "warning",
                    "message": "missing glossary",
                    "retryable": False,
                    "page_idx": 0,
                    "page_number": 1,
                    "block_idx": 1,
                },
                {
                    "item_id": "p001-b002",
                    "kind": "placeholder_inventory_mismatch",
                    "severity": "error",
                    "message": "placeholder mismatch",
                    "retryable": True,
                    "page_idx": 0,
                    "page_number": 1,
                    "block_idx": 2,
                },
            ],
        },
    )
    return items


def test_repair_runner_builds_plan_without_mutating_translations() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        job_root = Path(tmp) / "job-repair-test"
        original_items = _write_fake_job(job_root)
        before = copy.deepcopy(json.loads((job_root / "translated" / "page-0001.json").read_text(encoding="utf-8")))

        inputs = load_translation_repair_inputs(job_root)
        plan = build_translation_repair_plan(inputs)
        after = json.loads((job_root / "translated" / "page-0001.json").read_text(encoding="utf-8"))

    assert after == before == original_items
    assert plan["schema"] == TRANSLATION_REPAIR_PLAN_SCHEMA
    assert plan["repairable_item_count"] == 1
    first = plan["items"][0]
    second = plan["items"][1]
    assert first["item_id"] == "p001-b001"
    assert first["repairable"]
    assert first["repairable_issue_kinds"] == ["english_residue", "glossary_term_missing"]
    assert first["task_metadata"]["source_placeholders"] == ["<f1-abc/>"]
    assert second["item_id"] == "p001-b002"
    assert not second["repairable"]
    assert second["skip_reason"] == "no_repairable_issues"


def test_repair_runner_preview_uses_injected_llm_without_mutation() -> None:
    captured: dict[str, object] = {}

    def _fake_request(messages, **kwargs):
        captured["messages"] = messages
        captured["kwargs"] = kwargs
        return json.dumps(
            {
                "repaired_text": "自洽场循环保留 <f1-abc/>。",
                "applied_issue_kinds": ["english_residue", "glossary_term_missing"],
                "confidence": 0.88,
                "needs_manual_review": False,
                "notes": "",
            },
            ensure_ascii=False,
        )

    with tempfile.TemporaryDirectory() as tmp:
        job_root = Path(tmp) / "job-repair-test"
        _write_fake_job(job_root)
        before = json.loads((job_root / "translated" / "page-0001.json").read_text(encoding="utf-8"))

        inputs = load_translation_repair_inputs(job_root)
        plan = build_translation_repair_plan(inputs)
        preview = build_translation_repair_preview(
            inputs,
            plan,
            request_chat_content_fn=_fake_request,
        )
        after = json.loads((job_root / "translated" / "page-0001.json").read_text(encoding="utf-8"))

    assert after == before
    assert preview["schema"] == TRANSLATION_REPAIR_PREVIEW_SCHEMA
    assert preview["preview_item_count"] == 1
    assert preview["items"][0]["repair_result"]["repaired_text"] == "自洽场循环保留 <f1-abc/>。"
    assert captured["kwargs"]["model"] == "demo-model"
    assert captured["kwargs"]["base_url"] == "https://example.com/v1"
