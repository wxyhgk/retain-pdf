from __future__ import annotations

from retainpdf_pipeline.translate.core.ocr.models import TextItem
from retainpdf_pipeline.translate.core.payload.formula_protection import protected_map_from_formula_map
from retainpdf_pipeline.translate.core.payload.formula_protection import re_protect_restored_formulas
from retainpdf_pipeline.translate.core.payload.parts.policy_state import mark_policy_skip

from .template_records import build_translation_record
from .template_records import contract_fields_from_item
from .template_records import default_translation_flags
from .template_records import ocr_continuation_fields
from .template_records import provider_layout_warning_fields
from .template_records import resolve_translation_item_payload


def setdefault_record_fields(record: dict, defaults: dict) -> bool:
    changed = False
    for key, value in defaults.items():
        if key not in record:
            record[key] = value
            changed = True
    return changed


def sync_direct_typst_record_fields(record: dict, *, protected_source_text: str) -> bool:
    changed = False
    if record.get("protected_source_text") != protected_source_text:
        record["protected_source_text"] = protected_source_text
        changed = True
    if record.get("mixed_original_protected_source_text") != protected_source_text:
        record["mixed_original_protected_source_text"] = protected_source_text
        changed = True
    if record.get("formula_map") != []:
        record["formula_map"] = []
        changed = True
    if record.get("protected_map") != []:
        record["protected_map"] = []
        changed = True
    if record.get("translation_unit_protected_source_text") != protected_source_text:
        record["translation_unit_protected_source_text"] = protected_source_text
        changed = True
    if record.get("translation_unit_formula_map") != []:
        record["translation_unit_formula_map"] = []
        changed = True
    if record.get("translation_unit_protected_map") != []:
        record["translation_unit_protected_map"] = []
        changed = True
    return changed


def append_missing_translation_records(
    payload: list[dict],
    *,
    items: list[TextItem],
    existing_item_ids: set[str],
    math_mode: str,
) -> bool:
    missing_items = [item for item in items if item.item_id not in existing_item_ids]
    if not missing_items:
        return False
    payload.extend(build_translation_record(item, math_mode=math_mode) for item in missing_items)
    return True


def sync_translation_record(record: dict, item: TextItem, *, math_mode: str) -> bool:
    changed = False
    contract_fields = contract_fields_from_item(item)
    classification_label, should_translate, skip_reason = default_translation_flags(
        item.block_type,
        item.metadata,
        contract_fields=contract_fields,
    )
    ocr_fields = ocr_continuation_fields(item.metadata)
    warning_fields = provider_layout_warning_fields(item.metadata)
    protected_source_text, formula_map, protected_map = resolve_translation_item_payload(item, math_mode=math_mode)

    for key, value in contract_fields.items():
        if record.get(key) != value:
            record[key] = value
            changed = True
    if record.get("bbox") != item.bbox:
        record["bbox"] = item.bbox
        changed = True
    if record.get("source_text") != item.text:
        record["source_text"] = item.text
        changed = True
    source_line_texts = list(getattr(item, "line_texts", []) or [])
    if record.get("source_line_texts") != source_line_texts:
        record["source_line_texts"] = source_line_texts
        changed = True
    text_flow = str(getattr(item, "text_flow", "") or "flow")
    if record.get("text_flow") != text_flow:
        record["text_flow"] = text_flow
        changed = True
    toc_entries = list(getattr(item, "toc_entries", []) or [])
    if record.get("toc_entries") != toc_entries:
        record["toc_entries"] = toc_entries
        changed = True
    if record.get("lines") != item.lines:
        record["lines"] = item.lines
        changed = True
    if record.get("metadata") != item.metadata:
        record["metadata"] = item.metadata
        changed = True
    if (
        "protected_source_text" not in record
        or "formula_map" not in record
        or "protected_translated_text" not in record
        or "lines" not in record
    ):
        record["source_text"] = item.text
        record["source_line_texts"] = source_line_texts
        record["text_flow"] = text_flow
        record["toc_entries"] = toc_entries
        record["lines"] = item.lines
        record["metadata"] = item.metadata
        record.update(contract_fields)
        record.update(ocr_fields)
        record.update(warning_fields)
        record["math_mode"] = math_mode
        record["protected_source_text"] = protected_source_text
        record["formula_map"] = formula_map
        record["protected_map"] = protected_map
        record.setdefault("classification_label", classification_label)
        record.setdefault("should_translate", should_translate)
        record.setdefault("protected_translated_text", "")
        record.setdefault("continuation_group", "")
        record.setdefault("continuation_prev_text", "")
        record.setdefault("continuation_next_text", "")
        record.setdefault("group_protected_source_text", "")
        record.setdefault("group_formula_map", [])
        record.setdefault("group_protected_translated_text", "")
        record.setdefault("group_translated_text", "")
        changed = True
    if record.get("math_mode") != math_mode:
        record["math_mode"] = math_mode
        changed = True
    if math_mode == "direct_typst":
        changed = sync_direct_typst_record_fields(record, protected_source_text=protected_source_text) or changed
    changed = setdefault_record_fields(
        record,
        {
            "classification_label": classification_label,
            "mixed_original_protected_source_text": record.get("protected_source_text", ""),
            "mixed_literal_action": "",
            "mixed_literal_prefix": "",
            "layout_mode": "",
            "layout_split_x": 0.0,
            "layout_zone": "",
            "layout_zone_rank": -1,
            "layout_zone_size": 0,
            "layout_boundary_role": "",
            "metadata": item.metadata,
        },
    ) or changed
    for key, value in ocr_fields.items():
        if record.get(key) != value:
            record[key] = value
            changed = True
    for key, value in warning_fields.items():
        if record.get(key) != value:
            record[key] = value
            changed = True
    changed = setdefault_record_fields(
        record,
        {
            "should_translate": should_translate,
            "skip_reason": skip_reason,
        },
    ) or changed
    if not should_translate:
        before_state = _translation_policy_state_snapshot(record)
        mark_policy_skip(record, classification_label, skip_reason=skip_reason)
        changed = changed or before_state != _translation_policy_state_snapshot(record)
    changed = setdefault_record_fields(
        record,
        {
            "translation_unit_id": record.get("item_id", item.item_id),
            "translation_unit_kind": "single",
            "translation_unit_member_ids": [record.get("item_id", item.item_id)],
            "translation_unit_protected_source_text": record.get("protected_source_text", ""),
            "translation_unit_formula_map": record.get("formula_map", []),
        },
    ) or changed
    if "protected_map" not in record:
        record["protected_map"] = protected_map_from_formula_map(record.get("formula_map", []))
        changed = True
    changed = setdefault_record_fields(
        record,
        {
            "translation_unit_protected_map": record.get("protected_map", []),
            "translation_unit_protected_translated_text": "",
            "translation_unit_translated_text": "",
            "translation_group_id": "",
            "translation_group_kind": "",
            "translation_group_strategy": "",
            "continuation_group": "",
            "continuation_prev_text": "",
            "continuation_next_text": "",
            "continuation_decision": "",
            "continuation_candidate_prev_id": "",
            "continuation_candidate_next_id": "",
            "group_protected_source_text": "",
            "group_formula_map": [],
            "group_protected_map": [],
            "group_protected_translated_text": "",
            "group_translated_text": "",
            "final_status": "",
            "translation_diagnostics": {},
        },
    ) or changed
    if not record.get("protected_translated_text") and record.get("translated_text"):
        record["protected_translated_text"] = re_protect_restored_formulas(
            record["translated_text"],
            record.get("formula_map", []),
        )
        changed = True
    return changed


def _translation_policy_state_snapshot(record: dict) -> tuple:
    return (
        record.get("classification_label"),
        record.get("should_translate"),
        record.get("skip_reason"),
        record.get("final_status"),
        record.get("translation_unit_protected_translated_text"),
        record.get("translation_unit_translated_text"),
        record.get("protected_translated_text"),
        record.get("translated_text"),
        record.get("group_protected_translated_text"),
        record.get("group_translated_text"),
    )
