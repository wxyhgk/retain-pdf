import json
import sys
import tempfile
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.artifacts.review import write_translation_review
from retainpdf_pipeline.translate.artifacts.status import blocking_review_error_items
from retainpdf_pipeline.translate.services.agents.review_artifact import build_translation_review
from retainpdf_pipeline.translate.llm.shared.control_context import GlossaryEntry
from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context


def _item(item_id: str, source_text: str, translated_text: str) -> dict:
    return {
        "item_id": item_id,
        "page_idx": 0,
        "block_idx": 1,
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "translation_unit_protected_source_text": source_text,
        "source_text": source_text,
        "translated_text": translated_text,
        "final_status": "translated",
    }


def test_build_translation_review_collects_issue_summary() -> None:
    context = build_translation_control_context(
        glossary_entries=[GlossaryEntry(source="SCF", target="自洽场", level="preferred")]
    )
    payload = {
        0: [
            _item(
                "p001-b001",
                "The SCF cycle is converged before the energy is evaluated.",
                "该循环在计算能量前收敛。",
            )
        ]
    }

    review = build_translation_review(translated_pages_map=payload, translation_context=context)

    assert review["schema"] == "translation_review_v1"
    assert review["reviewed_item_count"] == 1
    assert review["issue_count"] == 1
    assert review["issue_summary"]["glossary_term_missing"] == 1
    assert review["issues"][0]["page_number"] == 1
    assert review["issues"][0]["block_idx"] == 1
    assert blocking_review_error_items(review) == []


def test_review_error_items_are_diagnostic_not_export_gate() -> None:
    payload = {
        0: [
            _item(
                "p001-b003",
                "The final energy <f1-abc/> is reported for the system.",
                "最终能量 <f2-def/> 被报告。",
            )
        ]
    }

    review = build_translation_review(translated_pages_map=payload)
    blocked = blocking_review_error_items(review)

    assert len(blocked) == 2
    assert blocked[0]["item_id"] == "p001-b003"


def test_review_error_items_ignore_policy_keep_origin_issue() -> None:
    review = {
        "issues": [
            {
                "item_id": "p182-b016",
                "page_idx": 181,
                "kind": "empty_translation",
                "severity": "error",
                "message": "Translation output is empty",
                "policy_state": {
                    "item_id": "p182-b016",
                    "block_type": "text",
                    "raw_block_type": "text",
                    "classification_label": "skip_model_keep_origin",
                    "should_translate": False,
                    "skip_reason": "skip_model_keep_origin",
                    "final_status": "kept_origin",
                },
            }
        ]
    }

    assert blocking_review_error_items(review) == []


def test_write_translation_review_round_trips_json() -> None:
    payload = {
        0: [
            _item(
                "p001-b002",
                "The final energy <f1-abc/> is reported for the system.",
                "最终能量 <f2-def/> 被报告。",
            )
        ]
    }
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "translation_review.json"

        review = write_translation_review(path, build_translation_review(translated_pages_map=payload))
        loaded = json.loads(path.read_text(encoding="utf-8"))

    assert loaded == review
    assert loaded["issue_summary"]["unexpected_placeholder"] == 1
    assert loaded["issue_summary"]["placeholder_inventory_mismatch"] == 1
