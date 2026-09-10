from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.core.orchestration.units import finalize_orchestration_metadata_by_page


def _item(
    *,
    item_id: str,
    page_idx: int,
    text: str,
    group: str = "",
    prev_id: str = "",
    next_id: str = "",
    provider_group_id: str = "",
) -> dict:
    return {
        "item_id": item_id,
        "page_idx": page_idx,
        "block_idx": 0,
        "source_text": text,
        "protected_source_text": text,
        "formula_map": [],
        "protected_map": [],
        "classification_label": "",
        "should_translate": True,
        "skip_reason": "",
        "continuation_group": group,
        "continuation_candidate_prev_id": prev_id,
        "continuation_candidate_next_id": next_id,
        "ocr_continuation_group_id": provider_group_id,
    }


def test_cross_page_review_join_survives_finalize() -> None:
    # Bug A 回归:review 拼接的跨页组(candidate ids 已清空、无 provider id)
    # 曾被按页 finalize 的孤儿判定当场抹掉 continuation_group。
    prev_item = _item(item_id="p1-tail", page_idx=0, text="The results indicate", group="cg-review-1001")
    next_item = _item(item_id="p2-head", page_idx=1, text="a significant improvement.", group="cg-review-1001")
    page_payloads = {0: [prev_item], 1: [next_item]}

    finalize_orchestration_metadata_by_page(page_payloads)

    assert prev_item["continuation_group"] == "cg-review-1001"
    assert next_item["continuation_group"] == "cg-review-1001"
    assert prev_item["translation_unit_kind"] == "group"
    assert prev_item["translation_unit_id"] == next_item["translation_unit_id"]
    assert prev_item["translation_unit_member_ids"] == ["p1-tail", "p2-head"]


def test_cross_page_provider_group_units_not_downgraded() -> None:
    # Bug B 回归:provider 跨页组虽有 provider id 护身,unit 字段曾被
    # 按页 refresh 降级成 single,与 save_pages 的扁平分组结论矛盾。
    prev_item = _item(
        item_id="p3-tail", page_idx=2, text="Beta phase", group="cg-003-001", provider_group_id="prov-7"
    )
    next_item = _item(
        item_id="p4-head", page_idx=3, text="transition continues.", group="cg-003-001", provider_group_id="prov-7"
    )
    page_payloads = {2: [prev_item], 3: [next_item]}

    finalize_orchestration_metadata_by_page(page_payloads)

    for item in (prev_item, next_item):
        assert item["translation_unit_kind"] == "group"
        assert item["translation_unit_member_ids"] == ["p3-tail", "p4-head"]


def test_true_singleton_group_still_cleared() -> None:
    # 原有行为不回归:全局确实只有一个成员、且无任何链接的组仍应被清。
    orphan = _item(item_id="p5-only", page_idx=4, text="Orphan block.", group="cg-orphan")
    other = _item(item_id="p5-plain", page_idx=4, text="Plain block.")
    page_payloads = {4: [orphan, other]}

    finalize_orchestration_metadata_by_page(page_payloads)

    assert orphan["continuation_group"] == ""
    assert orphan["translation_unit_kind"] == "single"
