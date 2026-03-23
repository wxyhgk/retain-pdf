from __future__ import annotations

from translation.payload.parts.common import GROUP_ITEM_PREFIX


def finalize_payload_orchestration_metadata(payload: list[dict]) -> None:
    for item in payload:
        label = str(item.get("classification_label", "") or "")
        should_translate = bool(item.get("should_translate", True))
        group_id = str(item.get("continuation_group", "") or "")
        item_id = str(item.get("item_id", "") or "")
        unit_id = f"{GROUP_ITEM_PREFIX}{group_id}" if group_id else item_id

        item["skip_reason"] = label if (label and not should_translate) else ""
        item["translation_unit_id"] = unit_id
        item["translation_unit_kind"] = "group" if unit_id.startswith(GROUP_ITEM_PREFIX) else "single"
        if item["translation_unit_kind"] == "single":
            item["translation_unit_member_ids"] = [item_id]
            item["translation_unit_protected_source_text"] = item.get("protected_source_text", "")
            item["translation_unit_formula_map"] = item.get("formula_map", [])
        item["candidate_pair_prev_id"] = str(item.get("continuation_candidate_prev_id", "") or "")
        item["candidate_pair_next_id"] = str(item.get("continuation_candidate_next_id", "") or "")


def finalize_orchestration_metadata_by_page(page_payloads: dict[int, list[dict]]) -> None:
    for page_idx in sorted(page_payloads):
        finalize_payload_orchestration_metadata(page_payloads[page_idx])
