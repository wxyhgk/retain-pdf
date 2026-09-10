from __future__ import annotations

import re

from retainpdf_pipeline.translate.core.item_reader import item_block_class
from retainpdf_pipeline.translate.core.item_reader import item_block_kind

from .common import (
    effective_translation_unit_id,
    GROUP_ITEM_PREFIX,
    has_item_translation,
    item_source_text,
    is_group_unit_id,
    seed_group_translation_unit,
)
from .translation_units import refresh_payload_translation_units

HEAVY_GROUP_MAX_FORMULA_SEGMENTS = 12
HEAVY_GROUP_MAX_MEMBERS = 3
HEAVY_GROUP_MAX_SOURCE_CHARS = 1600
FORMULA_SEGMENT_WINDOW_TARGET_COUNT = 8
PROTECTED_FORMULA_RE = re.compile(r"<[ft]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]")
_MICRO_CONNECTOR_SEGMENTS = {
    "a",
    "an",
    "and",
    "as",
    "at",
    "be",
    "by",
    "but",
    "can",
    "for",
    "from",
    "in",
    "into",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "that",
    "the",
    "their",
    "this",
    "to",
    "was",
    "which",
    "with",
}


def _segment_word_tokens(text: str) -> list[str]:
    normalized = " ".join((text or "").split()).strip().lower()
    if not normalized:
        return []
    return re.findall(r"[a-z]+(?:[-'][a-z]+)?", normalized)


def _is_micro_formula_segment(text: str) -> bool:
    normalized = " ".join((text or "").split()).strip().lower()
    if not normalized:
        return True
    words = _segment_word_tokens(normalized)
    if not words:
        return True
    if len(words) <= 2 and len(normalized) <= 20 and all(word in _MICRO_CONNECTOR_SEGMENTS for word in words):
        return True
    if len(words) <= 3 and len(normalized) <= 24 and (
        words[0] in _MICRO_CONNECTOR_SEGMENTS or words[-1] in _MICRO_CONNECTOR_SEGMENTS
    ):
        return True
    if len(words) <= 4 and all(word in _MICRO_CONNECTOR_SEGMENTS for word in words):
        return True
    return False


def _effective_formula_segment_count(source_text: str) -> int:
    source = item_source_text({"translation_unit_protected_source_text": source_text}) or ""
    segments: list[str] = []
    cursor = 0
    for match in PROTECTED_FORMULA_RE.finditer(source):
        text = source[cursor : match.start()]
        if any(ch.isalpha() for ch in text):
            segments.append(text.strip())
        cursor = match.end()
    tail = source[cursor:]
    if any(ch.isalpha() for ch in tail):
        segments.append(tail.strip())
    if not segments:
        return 0
    meaningful = [segment for segment in segments if not _is_micro_formula_segment(segment)]
    return len(meaningful) or len(segments)


def _reset_group_item_to_single(item: dict, *, reason: str) -> None:
    item_id = str(item.get("item_id", "") or "")
    item["continuation_group"] = ""
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
    return _effective_formula_segment_count(source_text or "")


def _is_heavy_group(combined_source: str, items: list[dict]) -> tuple[bool, str]:
    segment_count = _formula_segment_count(combined_source)
    continuation_group = str(items[0].get("continuation_group", "") or "").strip() if items else ""
    aggregate_geometry_group = (
        str(items[0].get("translation_group_strategy", "") or "").strip() == "aggregate_geometry"
        if items
        else False
    )
    if segment_count > HEAVY_GROUP_MAX_FORMULA_SEGMENTS:
        return True, "formula_heavy_group"
    if segment_count > FORMULA_SEGMENT_WINDOW_TARGET_COUNT:
        return True, "formula_windowed_group"
    if len(combined_source) > HEAVY_GROUP_MAX_SOURCE_CHARS and not continuation_group and not aggregate_geometry_group:
        return True, "long_continuation_group"
    if len(items) > HEAVY_GROUP_MAX_MEMBERS and not continuation_group and not aggregate_geometry_group:
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
        source = str(item.get("protected_source_text", "") or "")
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
        seed_group_translation_unit(
            item,
            unit_id=unit_id,
            member_ids=member_ids,
            protected_source_text=combined_source,
            formula_map=formula_map,
            protected_map=protected_map,
        )

    return {
        "item_id": unit_id,
        "translation_unit_id": unit_id,
        "translation_unit_kind": "group",
        "translation_unit_member_ids": list(member_ids),
        "translation_unit_members": [
            {
                "item_id": str(member_id or ""),
                "protected_source_text": protected_chunk,
            }
            for member_id, protected_chunk in zip(member_ids, protected_chunks)
        ],
        "block_type": item_block_kind(first_item) or "text",
        "block_kind": str(first_item.get("block_kind", "") or item_block_kind(first_item) or "text"),
        "block_class": item_block_class(first_item),
        "layout_role": str(first_item.get("layout_role", "") or ""),
        "semantic_role": str(first_item.get("semantic_role", "") or ""),
        "structure_role": str(first_item.get("structure_role", "") or ""),
        "policy_translate": first_item.get("policy_translate"),
        "asset_id": str(first_item.get("asset_id", "") or ""),
        "reading_order": int(first_item.get("reading_order", first_item.get("block_idx", 0)) or 0),
        "raw_block_type": str(first_item.get("raw_block_type", "") or first_item.get("block_type", "") or "").lower(),
        "normalized_sub_type": str(first_item.get("normalized_sub_type", "") or "").lower(),
        "math_mode": str(first_item.get("math_mode", "placeholder") or "placeholder"),
        "metadata": {},
        "formula_map": formula_map,
        "protected_map": protected_map,
        "continuation_group": str(first_item.get("continuation_group", "") or ""),
        "translation_group_id": str(first_item.get("translation_group_id", "") or ""),
        "translation_group_kind": str(first_item.get("translation_group_kind", "") or ""),
        "translation_group_strategy": str(first_item.get("translation_group_strategy", "") or ""),
        "translation_style_hint": str(first_item.get("translation_style_hint", "") or ""),
        "protected_source_text": combined_source,
    }


def _compact_group_text(text: str) -> str:
    return " ".join((text or "").split())


def _group_translation_text(item: dict) -> str:
    return _compact_group_text(
        item.get("translation_unit_protected_translated_text")
        or item.get("group_protected_translated_text")
        or ""
    )


def _member_translation_text(item: dict) -> str:
    """Member-level translation only: group-level unit fields excluded.

    A stale solo text sitting in a group field must not count as this
    member being translated; only text written for the member itself does.
    """
    return _compact_group_text(
        item.get("protected_translated_text") or item.get("translated_text") or ""
    )


def _group_translation_complete(items: list[dict]) -> bool:
    """A group counts as translated when every member is covered.

    Two ways to be covered: (a) all members carry the same group-level
    translation (genuinely translated as a unit), or (b) every member has
    its own member-level translation (e.g. translated as singles before a
    review join; retranslation would add nothing).

    A lone member holding a stale solo group-field text while another
    member is empty satisfies neither and stays pending (previously: the
    empty member was silently skipped, then a later regroup exposed it as
    pending and the checkpoint guard failed the entire job).
    """
    if not items:
        return False
    texts = [_group_translation_text(item) for item in items]
    if all(texts) and len(set(texts)) == 1:
        return True
    return all(bool(_member_translation_text(item)) for item in items)


def pending_translation_items(payload: list[dict]) -> list[dict]:
    refresh_payload_translation_units(payload)
    units: list[dict] = []
    groups: dict[str, list[dict]] = {}

    for item in payload:
        if not item.get("should_translate", True):
            continue
        unit_id = effective_translation_unit_id(item)
        if is_group_unit_id(unit_id):
            groups.setdefault(unit_id, []).append(item)
            continue
        if not has_item_translation(item):
            units.append(item)

    for unit_id, items in groups.items():
        items = [item for item in items if item.get("should_translate", True)]
        if not items:
            continue
        if _group_translation_complete(items):
            continue
        unit = _build_group_translation_unit(unit_id, items)
        if unit is None:
            for item in items:
                if not has_item_translation(item):
                    units.append(item)
            continue
        units.append(unit)

    return units
