from .common import (
    GROUP_ITEM_PREFIX,
    has_group_translation,
    has_item_translation,
    is_group_unit_id,
    translation_unit_id,
)


def _build_group_translation_unit(unit_id: str, items: list[dict]) -> dict | None:
    formula_map: list[dict] = []
    protected_chunks: list[str] = []
    next_formula_index = 1
    for item in items:
        source = item.get("protected_source_text", "")
        local_map = item.get("formula_map", [])
        remapped_source = source
        remapped_formulas = []
        for entry in local_map:
            new_placeholder = f"[[FORMULA_{next_formula_index}]]"
            next_formula_index += 1
            remapped_source = remapped_source.replace(entry["placeholder"], new_placeholder)
            remapped_formulas.append(
                {
                    "placeholder": new_placeholder,
                    "formula_text": entry["formula_text"],
                }
            )
        formula_map.extend(remapped_formulas)
        protected_chunks.append(remapped_source.strip())

    combined_source = " ".join(chunk for chunk in protected_chunks if chunk).strip()
    if not combined_source:
        return None

    member_ids = [member.get("item_id", "") for member in items]
    for item in items:
        item["translation_unit_kind"] = "group"
        item["translation_unit_member_ids"] = member_ids
        item["translation_unit_protected_source_text"] = combined_source
        item["translation_unit_formula_map"] = formula_map
        item["group_protected_source_text"] = combined_source
        item["group_formula_map"] = formula_map

    return {
        "item_id": unit_id,
        "translation_unit_id": unit_id,
        "protected_source_text": combined_source,
    }


def pending_translation_items(payload: list[dict]) -> list[dict]:
    units: list[dict] = []
    groups: dict[str, list[dict]] = {}

    for item in payload:
        if not item.get("should_translate", True):
            continue
        unit_id = translation_unit_id(item)
        if is_group_unit_id(unit_id):
            groups.setdefault(unit_id, []).append(item)
            continue
        if not has_item_translation(item):
            units.append(item)

    for unit_id, items in groups.items():
        items = [item for item in items if item.get("should_translate", True)]
        if not items:
            continue
        if any(has_group_translation(item) for item in items):
            continue
        unit = _build_group_translation_unit(unit_id, items)
        if unit is not None:
            units.append(unit)

    return units
