from __future__ import annotations
import re

from .common import (
    GROUP_ITEM_PREFIX,
    has_group_translation,
    has_item_translation,
    is_group_unit_id,
    translation_unit_id,
)

HEAVY_GROUP_MAX_FORMULA_SEGMENTS = 12
HEAVY_GROUP_MAX_MEMBERS = 3
HEAVY_GROUP_MAX_SOURCE_CHARS = 1600
FORMULA_SEGMENT_WINDOW_TARGET_COUNT = 8
PROTECTED_FORMULA_RE = re.compile(r"<[ft]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]")


def _reset_group_item_to_single(item: dict, *, reason: str) -> None:
    item_id = str(item.get("item_id", "") or "")
    item["translation_unit_id"] = item_id
    item["translation_unit_kind"] = "single"
    item["translation_unit_member_ids"] = [item_id]
    item["translation_unit_protected_source_text"] = item.get("protected_source_text", "")
    item["translation_unit_formula_map"] = item.get("formula_map", [])
    item["translation_unit_protected_map"] = item.get("protected_map", [])
    item["group_protected_source_text"] = ""
    item["group_formula_map"] = []
    item["group_protected_map"] = []
    item["group_split_reason"] = reason


def _formula_segment_count(source_text: str) -> int:
    placeholder_count = len(PROTECTED_FORMULA_RE.findall(source_text or ""))
    if placeholder_count <= 0:
        return 0
    return placeholder_count + 1


def _is_heavy_group(combined_source: str, items: list[dict]) -> tuple[bool, str]:
    segment_count = _formula_segment_count(combined_source)
    if segment_count > HEAVY_GROUP_MAX_FORMULA_SEGMENTS:
        return True, "formula_heavy_group"
    if segment_count > FORMULA_SEGMENT_WINDOW_TARGET_COUNT:
        return True, "formula_windowed_group"
    if len(combined_source) > HEAVY_GROUP_MAX_SOURCE_CHARS:
        return True, "long_continuation_group"
    if len(items) > HEAVY_GROUP_MAX_MEMBERS:
        return True, "large_continuation_group"
    return False, ""


def _build_group_translation_unit(unit_id: str, items: list[dict]) -> dict | None:
    formula_map: list[dict] = []
    protected_map: list[dict] = []
    protected_chunks: list[str] = []
    next_formula_index = 1
    next_term_index = 1
    first_item = items[0]
    for item in items:
        source = item.get("protected_source_text", "")
        local_map = item.get("formula_map", [])
        local_protected_map = item.get("protected_map", []) or []
        remapped_source = source
        remapped_formulas = []
        remapped_tokens = []
        placeholder_mapping: dict[str, str] = {}
        temporary_mapping: dict[str, str] = {}
        for local_index, entry in enumerate(local_protected_map, start=1):
            old_placeholder = entry.get("token_tag") or entry.get("placeholder")
            token_type = str(entry.get("token_type", "") or "formula")
            if not old_placeholder:
                continue
            temp_placeholder = f"[[GROUP_TMP_{unit_id}_{local_index}]]"
            if token_type == "formula":
                new_placeholder = f"<f{next_formula_index}-{str(entry.get('checksum', '') or '000')}/>"
                next_formula_index += 1
            elif token_type == "term":
                new_placeholder = f"<t{next_term_index}-{str(entry.get('checksum', '') or '000')}/>"
                next_term_index += 1
            else:
                continue
            placeholder_mapping[old_placeholder] = new_placeholder
            temporary_mapping[old_placeholder] = temp_placeholder
            remapped_source = remapped_source.replace(old_placeholder, temp_placeholder)

        for old_placeholder, temp_placeholder in temporary_mapping.items():
            remapped_source = remapped_source.replace(temp_placeholder, placeholder_mapping[old_placeholder])

        for entry in local_protected_map:
            old_placeholder = entry.get("token_tag") or entry.get("placeholder")
            if not old_placeholder or old_placeholder not in placeholder_mapping:
                continue
            remapped_entry = dict(entry)
            remapped_entry["token_tag"] = placeholder_mapping[old_placeholder]
            remapped_tokens.append(remapped_entry)
            if str(entry.get("token_type", "") or "formula") == "formula":
                remapped_formulas.append(
                    {
                        "placeholder": placeholder_mapping[old_placeholder],
                        "formula_text": entry.get("restore_text") or entry.get("formula_text") or entry.get("original_text") or "",
                    }
                )
        formula_map.extend(remapped_formulas)
        protected_map.extend(remapped_tokens)
        protected_chunks.append(remapped_source.strip())

    combined_source = " ".join(chunk for chunk in protected_chunks if chunk).strip()
    if not combined_source:
        for item in items:
            _reset_group_item_to_single(item, reason="empty_continuation_group")
        return None
    is_heavy, split_reason = _is_heavy_group(combined_source, items)
    if is_heavy:
        for item in items:
            _reset_group_item_to_single(item, reason=split_reason)
        return None

    member_ids = [member.get("item_id", "") for member in items]
    for item in items:
        item["translation_unit_kind"] = "group"
        item["translation_unit_member_ids"] = member_ids
        item["translation_unit_protected_source_text"] = combined_source
        item["translation_unit_formula_map"] = formula_map
        item["translation_unit_protected_map"] = protected_map
        item["group_protected_source_text"] = combined_source
        item["group_formula_map"] = formula_map
        item["group_protected_map"] = protected_map

    return {
        "item_id": unit_id,
        "translation_unit_id": unit_id,
        "block_type": first_item.get("block_type", "text"),
        "metadata": dict(first_item.get("metadata", {}) or {}),
        "formula_map": formula_map,
        "protected_map": protected_map,
        "continuation_group": str(first_item.get("continuation_group", "") or ""),
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
        if unit is None:
            for item in items:
                if not has_item_translation(item):
                    units.append(item)
            continue
        units.append(unit)

    return units
