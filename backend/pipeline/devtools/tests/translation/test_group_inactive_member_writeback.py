"""接续组里夹着不翻的成员（should_translate=False）时，写回不再把译文截掉一段（2026-11-26 审查第 7 条）。

发给模型的整段只拼要翻的成员（`pending_translation_items` 先滤掉不翻的块），写回却按 `refresh_payload_translation_units`
分出的全部成员切分：分给不翻成员的那一段随后被清空，要翻的成员拼起来比模型给的整段少一截。
#224 的 `keep_translated_blocks_out_of_mixed_groups` 切出来的段也带着不翻的成员，有同样的截断。

修法：`apply_group_translated_entry` 只按要翻的成员切分（各条写回的路都经过它：`apply_translated_text_map`、
`TranslationResultApplier`、最终补救、乱码重建）；`keep_translated_blocks_out_of_mixed_groups` 里不翻的成员
不让一段凑够两块。
"""
from __future__ import annotations

from retainpdf_translation.core.orchestration.units import finalize_payload_orchestration_metadata
from retainpdf_translation.core.payload.parts.apply import apply_group_translated_entry
from retainpdf_translation.core.payload.parts.apply import apply_translated_text_map
from retainpdf_translation.core.payload.parts.units import pending_translation_items


def _item(block_idx: int, text: str, *, protected_map: list[dict] | None = None) -> dict:
    item_id = f"p001-b{block_idx:03d}"
    protected_map = protected_map or []
    return {
        "item_id": item_id,
        "page_idx": 0,
        "block_idx": block_idx,
        "block_type": "text",
        "block_kind": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "policy_translate": True,
        "raw_block_type": "text",
        "bbox": [50, 100 + block_idx * 40, 500, 130 + block_idx * 40],
        "source_text": text,
        "protected_source_text": text,
        "formula_map": [
            {"placeholder": entry["token_tag"], "formula_text": entry["restore_text"]} for entry in protected_map
        ],
        "protected_map": protected_map,
        "math_mode": "placeholder",
        "should_translate": True,
        "layout_mode": "single",
        "layout_zone": "single_column",
        "layout_boundary_role": "middle",
        "translation_unit_id": item_id,
        "translation_unit_kind": "single",
        "translation_unit_member_ids": [item_id],
        "translation_unit_protected_source_text": text,
        "translation_unit_formula_map": [],
        "translation_unit_protected_map": [],
        "translation_unit_protected_translated_text": "",
        "translation_unit_translated_text": "",
        "protected_translated_text": "",
        "translated_text": "",
        "group_protected_translated_text": "",
        "group_translated_text": "",
        "continuation_group": "cg-001-001",
        "final_status": "",
        "translation_diagnostics": {},
    }


def _translate_alone(item: dict) -> None:
    text = f"译文 {item['item_id']}"
    for field in (
        "translation_unit_protected_translated_text",
        "translation_unit_translated_text",
        "protected_translated_text",
        "translated_text",
    ):
        item[field] = text
    item["final_status"] = "translated"


def _skip(item: dict) -> dict:
    item["should_translate"] = False
    item["classification_label"] = "skip_running_header"
    return item


def test_member_that_is_not_translated_does_not_swallow_a_chunk_of_the_group_translation() -> None:
    a = _item(0, "The results of the experiment were quite")
    x = _skip(_item(1, "skipped block text that policy keeps in the original language"))
    b = _item(2, "surprisingly consistent with the theory and the earlier work.")
    payload = [a, x, b]
    finalize_payload_orchestration_metadata(payload)
    units = pending_translation_items(payload)
    assert len(units) == 1
    assert units[0]["translation_unit_member_ids"] == [a["item_id"], b["item_id"]]

    translated = "实验结果相当出人意料地与理论以及早先的工作保持一致。"
    apply_translated_text_map(payload, {units[0]["item_id"]: translated})

    assert (a["protected_translated_text"] + b["protected_translated_text"]).replace(" ", "") == translated
    assert a["protected_translated_text"] and b["protected_translated_text"]
    assert x["protected_translated_text"] == "" and x["translated_text"] == ""
    assert pending_translation_items(payload) == []


def test_the_unit_maps_come_from_a_translated_member_when_the_first_member_is_not_translated() -> None:
    """排在最前面的是不翻的成员时，占位符照样按要翻成员的整组映射还原（以前取 items[0] 的，还原不出公式）。"""
    token = {"token_tag": "<f1-a7c/>", "token_type": "formula", "checksum": "a7c", "restore_text": "$x^2$"}
    x = _skip(_item(0, "Running header kept in the original"))
    a = _item(1, "The value <f1-a7c/> of the experiment was", protected_map=[token])
    b = _item(2, "surprisingly consistent with the theory.")
    payload = [x, a, b]
    finalize_payload_orchestration_metadata(payload)
    units = pending_translation_items(payload)
    assert len(units) == 1

    apply_translated_text_map(payload, {units[0]["item_id"]: "实验的数值 <f1-a7c/> 出人意料地与理论一致。"})

    assert "$x^2$" in a["translation_unit_translated_text"]
    assert "<f1-a7c/>" not in a["translation_unit_translated_text"]
    assert x["translated_text"] == ""


def test_direct_group_write_back_only_splits_over_members_that_are_translated() -> None:
    """其余写回入口（结果应用器、最终补救、乱码重建）直接调 apply_group_translated_entry，传进来的成员里也会夹着不翻的块。"""
    a = _item(0, "The results of the experiment were quite")
    x = _skip(_item(1, "skipped block text that policy keeps in the original language"))
    b = _item(2, "surprisingly consistent with the theory and the earlier work.")
    x["translated_text"] = "残留"
    translated = "实验结果相当出人意料地与理论以及早先的工作保持一致。"

    apply_group_translated_entry([a, x, b], translated)

    assert (a["protected_translated_text"] + b["protected_translated_text"]).replace(" ", "") == translated
    assert x["translated_text"] == ""


def test_regrouped_run_with_a_member_that_is_not_translated_does_not_truncate_the_untranslated_block() -> None:
    """续跑重新分组：已译的 a 挪出去，剩下不翻的 x 和没译的 b。以前 x、b 还成一组，b 只拿到一部分译文。"""
    a = _item(0, "An opening sentence that is complete and was translated before.")
    x = _skip(_item(1, "skipped block text that policy keeps in the original language"))
    b = _item(2, "surprisingly consistent with the theory and the earlier work reported by others.")
    _translate_alone(a)
    payload = [a, x, b]
    finalize_payload_orchestration_metadata(payload)

    assert [item["continuation_group"] for item in payload] == ["", "", ""]
    units = pending_translation_items(payload)
    assert [unit["item_id"] for unit in units] == [b["item_id"]]

    translated = "与理论以及他人报道的早先工作都惊人地一致。"
    apply_translated_text_map(payload, {b["item_id"]: translated})

    assert b["protected_translated_text"] == translated
    assert a["translated_text"] == f"译文 {a['item_id']}"
