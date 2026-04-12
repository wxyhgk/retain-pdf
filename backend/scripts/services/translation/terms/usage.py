from __future__ import annotations

from typing import Any

from services.translation.terms.glossary import GlossaryEntry
from services.translation.terms.glossary import normalize_glossary_entries


def summarize_glossary_usage(
    *,
    entries: list[GlossaryEntry | dict[str, Any]] | None,
    translated_pages_map: dict[int, list[dict]],
    glossary_id: str = "",
    glossary_name: str = "",
    resource_entry_count: int = 0,
    inline_entry_count: int = 0,
    overridden_entry_count: int = 0,
) -> dict[str, object]:
    normalized_entries = normalize_glossary_entries(entries)
    if inline_entry_count <= 0 and not glossary_id and normalized_entries:
        inline_entry_count = len(normalized_entries)

    source_hit_keys: set[str] = set()
    target_hit_keys: set[str] = set()
    preferred_hit_keys: set[str] = set()
    level_counts = {"preserve": 0, "canonical": 0, "preferred": 0}
    for entry in normalized_entries:
        level_counts[entry.level] = level_counts.get(entry.level, 0) + 1
        key = _entry_key(entry)
        source_needle = entry.source.casefold()
        target_needle = entry.target.casefold()
        if not source_needle or not target_needle:
            continue
        for items in translated_pages_map.values():
            for item in items:
                source_text = _source_text(item).casefold()
                translated_text = str(item.get("translated_text", "") or "").casefold()
                if source_needle in source_text:
                    source_hit_keys.add(key)
                if target_needle in translated_text:
                    target_hit_keys.add(key)
                    if entry.level == "preferred":
                        preferred_hit_keys.add(key)

    entry_count = len(normalized_entries)
    source_hit_count = len(source_hit_keys)
    target_hit_count = len(target_hit_keys)
    preferred_count = max(0, level_counts.get("preferred", 0))
    return {
        "enabled": entry_count > 0,
        "glossary_id": (glossary_id or "").strip(),
        "glossary_name": (glossary_name or "").strip(),
        "entry_count": entry_count,
        "level_counts": level_counts,
        "resource_entry_count": max(0, int(resource_entry_count or 0)),
        "inline_entry_count": max(0, int(inline_entry_count or 0)),
        "overridden_entry_count": max(0, int(overridden_entry_count or 0)),
        "source_hit_entry_count": source_hit_count,
        "target_hit_entry_count": target_hit_count,
        "unused_entry_count": max(0, entry_count - source_hit_count),
        "unapplied_source_hit_entry_count": len(source_hit_keys - target_hit_keys),
        "preferred_hit_entry_count": len(preferred_hit_keys),
        "preferred_adoption_rate": round(len(preferred_hit_keys) / preferred_count, 4) if preferred_count else 0.0,
    }


def _entry_key(entry: GlossaryEntry) -> str:
    return entry.source.strip().casefold()


def _source_text(item: dict) -> str:
    return str(
        item.get("translation_unit_protected_source_text")
        or item.get("group_protected_source_text")
        or item.get("protected_source_text")
        or item.get("source_text")
        or ""
    )
