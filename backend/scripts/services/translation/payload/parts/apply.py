from ..formula_protection import restore_inline_formulas
from .common import (
    clear_translation_fields,
    is_group_unit_id,
    translation_unit_id,
)

KEEP_ORIGIN_LABEL = "skip_model_keep_origin"


def _normalize_result_entry(value) -> tuple[str, str]:
    if isinstance(value, dict):
        decision = str(value.get("decision", "translate") or "translate").strip() or "translate"
        translated_text = str(value.get("translated_text", "") or "").strip()
        return decision, translated_text
    return "translate", str(value or "").strip()


def _mark_keep_origin(item: dict) -> None:
    item["classification_label"] = KEEP_ORIGIN_LABEL
    item["should_translate"] = False
    item["skip_reason"] = KEEP_ORIGIN_LABEL
    clear_translation_fields(item)


def _join_prefix_and_tail(prefix: str, tail: str) -> str:
    left = prefix.rstrip()
    right = tail.strip()
    if not left:
        return right
    if not right:
        return left
    if right[:1] in ",.;:!?)]}":
        return left + right
    return f"{left} {right}"


def apply_translated_text_map(payload: list[dict], translated: dict) -> None:
    group_items: dict[str, list[dict]] = {}
    for item in payload:
        unit_id = translation_unit_id(item)
        if is_group_unit_id(unit_id):
            group_items.setdefault(unit_id, []).append(item)

    for item_id, protected_translated_text in translated.items():
        if not is_group_unit_id(item_id):
            continue
        items = group_items.get(item_id, [])
        if not items:
            continue
        decision, protected_translated_text = _normalize_result_entry(protected_translated_text)
        if decision == "keep_origin":
            for item in items:
                _mark_keep_origin(item)
            continue
        formula_map = items[0].get("translation_unit_formula_map") or items[0].get("group_formula_map", [])
        restored = restore_inline_formulas(protected_translated_text, formula_map)
        for item in items:
            if not item.get("should_translate", True):
                clear_translation_fields(item)
                continue
            item["translation_unit_protected_translated_text"] = protected_translated_text
            item["translation_unit_translated_text"] = restored
            item["group_protected_translated_text"] = protected_translated_text
            item["group_translated_text"] = restored
            # Group units only have unit/group-level translations here.
            # Do not duplicate the full group text into member-level fields,
            # otherwise downstream consumers may mistake it for block text.
            item["protected_translated_text"] = ""
            item["translated_text"] = ""

    for item in payload:
        item_id = item.get("item_id")
        if item_id not in translated:
            continue
        decision, protected_translated_text = _normalize_result_entry(translated[item_id])
        if decision == "keep_origin":
            _mark_keep_origin(item)
            continue
        item["translation_unit_protected_translated_text"] = protected_translated_text
        item["translation_unit_translated_text"] = restore_inline_formulas(
            protected_translated_text,
            item.get("translation_unit_formula_map") or item.get("formula_map", []),
        )
        if str(item.get("mixed_literal_action", "") or "") == "translate_tail":
            prefix = str(item.get("mixed_literal_prefix", "") or "")
            item["translation_unit_protected_translated_text"] = _join_prefix_and_tail(
                prefix,
                item["translation_unit_protected_translated_text"],
            )
            item["translation_unit_translated_text"] = _join_prefix_and_tail(
                prefix,
                item["translation_unit_translated_text"],
            )
        item["protected_translated_text"] = protected_translated_text
        item["translated_text"] = restore_inline_formulas(
            protected_translated_text,
            item.get("formula_map", []),
        )
        if str(item.get("mixed_literal_action", "") or "") == "translate_tail":
            prefix = str(item.get("mixed_literal_prefix", "") or "")
            item["protected_translated_text"] = _join_prefix_and_tail(prefix, item["protected_translated_text"])
            item["translated_text"] = _join_prefix_and_tail(prefix, item["translated_text"])
