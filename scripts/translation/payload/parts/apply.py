from ..formula_protection import restore_inline_formulas
from .common import (
    clear_translation_fields,
    is_group_unit_id,
    translation_unit_id,
)


def apply_translated_text_map(payload: list[dict], translated: dict[str, str]) -> None:
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

    for item in payload:
        item_id = item.get("item_id")
        if item_id not in translated:
            continue
        protected_translated_text = translated[item_id]
        item["translation_unit_protected_translated_text"] = protected_translated_text
        item["translation_unit_translated_text"] = restore_inline_formulas(
            protected_translated_text,
            item.get("translation_unit_formula_map") or item.get("formula_map", []),
        )
        item["protected_translated_text"] = protected_translated_text
        item["translated_text"] = restore_inline_formulas(
            protected_translated_text,
            item.get("formula_map", []),
        )
