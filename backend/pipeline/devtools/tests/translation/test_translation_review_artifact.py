import json
import tempfile
from pathlib import Path


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


def _group_member(
    item_id: str,
    page_idx: int,
    own_source: str,
    own_translation: str,
    unit_source: str,
    unit_translation: str,
) -> dict:
    return {
        "item_id": item_id,
        "page_idx": page_idx,
        "block_idx": 0,
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "source_text": own_source,
        "protected_source_text": own_source,
        "protected_translated_text": own_translation,
        "translated_text": own_translation,
        "translation_unit_id": "__cg__:cg-001-001",
        "translation_unit_member_ids": ["p001-b009", "p002-b000"],
        "translation_unit_protected_source_text": unit_source,
        "translation_unit_protected_translated_text": unit_translation,
        "final_status": "translated",
    }


_GROUP_HEAD = "The total energy is the sum of the kinetic and potential terms, and "
_GROUP_TAIL = (
    "it stays constant during the motion because no external force acts on the system. "
    "This conservation law lets us determine the amplitude from the initial conditions alone."
)


def test_continuation_group_member_is_not_reported_as_truncated() -> None:
    # 真实样本：组的原文按整组取，成员只分到译文的一小截；拿这一截去比整组原文会误报截断。
    unit_source = _GROUP_HEAD + _GROUP_TAIL
    unit_translation = "总能量是动能项与势能项之和，由于没有外力作用于系统，它在运动过程中保持不变。这一守恒律使我们仅凭初始条件即可确定振幅。"
    payload = {
        0: [_group_member("p001-b009", 0, _GROUP_HEAD, "总能量是动能项与势能项之和，", unit_source, unit_translation)],
        1: [_group_member("p002-b000", 1, _GROUP_TAIL, "由于没有外力作用于系统……", unit_source, unit_translation)],
    }

    review = build_translation_review(translated_pages_map=payload)

    assert review["reviewed_item_count"] == 2
    assert review["issue_count"] == 0


def test_truncated_continuation_group_is_reported_once_on_first_member() -> None:
    unit_source = _GROUP_HEAD + _GROUP_TAIL
    payload = {
        0: [_group_member("p001-b009", 0, _GROUP_HEAD, "总能", unit_source, "总能")],
        1: [_group_member("p002-b000", 1, _GROUP_TAIL, "", unit_source, "总能")],
    }

    review = build_translation_review(translated_pages_map=payload)

    truncated = [issue for issue in review["issues"] if issue["kind"] == "truncated_translation"]
    assert [issue["item_id"] for issue in truncated] == ["p001-b009"]
    assert truncated[0]["translation_unit_id"] == "__cg__:cg-001-001"
    assert truncated[0]["translation_unit_member_ids"] == ["p001-b009", "p002-b000"]
