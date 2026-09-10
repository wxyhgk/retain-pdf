from __future__ import annotations

from .common import existing_group_unit_id
from .common import group_key
from .common import group_unit_id
from .common import seed_group_translation_unit
from .common import seed_single_translation_unit
from .common import translation_unit_state_snapshot


def _effective_group_unit_id(members: list[dict]) -> str:
    existing_ids = []
    seen: set[str] = set()
    for member in members:
        unit_id = existing_group_unit_id(member)
        if unit_id and unit_id not in seen:
            existing_ids.append(unit_id)
            seen.add(unit_id)
    if len(existing_ids) == 1:
        return existing_ids[0]
    for member in members:
        group_id = str(member.get("continuation_group", "") or "").strip()
        if group_id:
            return group_unit_id(group_id)
        translation_group_id = str(member.get("translation_group_id", "") or "").strip()
        if translation_group_id:
            return group_unit_id(translation_group_id)
    return existing_ids[0] if existing_ids else ""


def _has_external_group_members(item: dict) -> bool:
    item_id = str(item.get("item_id", "") or "")
    member_ids = [str(member or "").strip() for member in item.get("translation_unit_member_ids", []) if str(member or "").strip()]
    return bool(item_id and any(member_id != item_id for member_id in member_ids))


def refresh_payload_translation_units(payload: list[dict], *, preserve_external_groups: bool = False) -> bool:
    changed = False
    grouped_members: dict[str, list[dict]] = {}
    for item in payload:
        key = group_key(item)
        if not key:
            continue
        grouped_members.setdefault(key, []).append(item)

    effective_groups = {
        key: members
        for key, members in grouped_members.items()
        if len(members) >= 2
    }
    effective_member_ids = {
        key: [str(member.get("item_id", "") or "") for member in members]
        for key, members in effective_groups.items()
    }
    effective_unit_ids = {
        key: _effective_group_unit_id(members)
        for key, members in effective_groups.items()
    }

    for item in payload:
        item_id = str(item.get("item_id", "") or "")
        key = group_key(item)
        if key and key in effective_groups:
            member_ids = effective_member_ids[key]
            unit_id = effective_unit_ids[key] or existing_group_unit_id(item) or item_id
            protected_source = str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text", "") or "")
            formula_map = list(item.get("translation_unit_formula_map") or item.get("formula_map", []) or [])
            protected_map = list(item.get("translation_unit_protected_map") or item.get("protected_map", formula_map) or [])
            before = translation_unit_state_snapshot(item)
            seed_group_translation_unit(
                item,
                unit_id=unit_id,
                member_ids=member_ids,
                protected_source_text=protected_source,
                formula_map=formula_map,
                protected_map=protected_map,
            )
            after = translation_unit_state_snapshot(item)
            if before != after:
                changed = True
            continue

        if preserve_external_groups and key and _has_external_group_members(item):
            continue

        before = translation_unit_state_snapshot(item)
        seed_single_translation_unit(item)
        after = translation_unit_state_snapshot(item)
        if before != after:
            changed = True
        if item.get("group_protected_source_text"):
            item["group_protected_source_text"] = ""
            changed = True
        if item.get("group_formula_map"):
            item["group_formula_map"] = []
            changed = True
        if item.get("group_protected_map"):
            item["group_protected_map"] = []
            changed = True
        if item.get("group_protected_translated_text"):
            item["group_protected_translated_text"] = ""
            changed = True
        if item.get("group_translated_text"):
            item["group_translated_text"] = ""
            changed = True

    return changed


__all__ = ["refresh_payload_translation_units"]
