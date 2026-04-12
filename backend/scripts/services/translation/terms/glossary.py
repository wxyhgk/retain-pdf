from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
import json
import re
from typing import Any
from typing import Literal


@dataclass(frozen=True)
class GlossaryEntry:
    source: str
    target: str
    level: Literal["preserve", "canonical", "preferred"] = "preferred"
    match_mode: Literal["exact", "regex", "case_insensitive"] = "exact"
    context: str | None = None
    note: str = ""
    _compiled_pattern: re.Pattern[str] | None = field(default=None, compare=False, repr=False)


def build_glossary_guidance(entries: list[GlossaryEntry]) -> str:
    preferred_entries = [entry for entry in entries if entry.level == "preferred"]
    if not preferred_entries:
        return ""
    lines = ["Glossary preferences:"]
    for entry in preferred_entries:
        text = f"- {entry.source} -> {entry.target}"
        if entry.note.strip():
            text = f"{text} ({entry.note.strip()})"
        lines.append(text)
    return "\n".join(lines)


def normalize_glossary_entries(values: list[GlossaryEntry | dict[str, Any]] | None) -> list[GlossaryEntry]:
    normalized: list[GlossaryEntry] = []
    for item in values or []:
        if isinstance(item, GlossaryEntry):
            source = item.source.strip()
            target = item.target.strip()
            level = item.level
            match_mode = item.match_mode
            context = item.context.strip() if isinstance(item.context, str) else item.context
            note = item.note.strip()
        elif isinstance(item, dict):
            source = str(item.get("source", "") or "").strip()
            target = str(item.get("target", "") or "").strip()
            level = _normalize_level(item.get("level"))
            match_mode = _normalize_match_mode(item.get("match_mode") or item.get("match"))
            raw_context = item.get("context")
            context = str(raw_context).strip() if raw_context is not None and str(raw_context).strip() else None
            note = str(item.get("note", "") or "").strip()
        else:
            continue
        if not source or not target:
            continue
        normalized.append(
            GlossaryEntry(
                source=source,
                target=target,
                level=level,
                match_mode=match_mode,
                context=context,
                note=note,
            )
        )
    return normalized


def parse_glossary_json(text: str) -> list[GlossaryEntry]:
    raw = (text or "").strip()
    if not raw:
        return []
    payload = json.loads(raw)
    if not isinstance(payload, list):
        raise ValueError("glossary_json must be a JSON array")
    return normalize_glossary_entries(payload)


def glossary_hard_entries(entries: list[GlossaryEntry]) -> list[GlossaryEntry]:
    hard_entries = [entry for entry in entries if entry.level in {"preserve", "canonical"}]
    return sorted(
        hard_entries,
        key=lambda entry: (-len(entry.source), 0 if entry.level == "preserve" else 1, entry.source.casefold()),
    )


def _normalize_level(value: object) -> Literal["preserve", "canonical", "preferred"]:
    normalized = str(value or "preferred").strip().lower()
    if normalized in {"preserve", "canonical", "preferred"}:
        return normalized  # type: ignore[return-value]
    return "preferred"


def _normalize_match_mode(value: object) -> Literal["exact", "regex", "case_insensitive"]:
    normalized = str(value or "exact").strip().lower()
    if normalized in {"exact", "regex", "case_insensitive"}:
        return normalized  # type: ignore[return-value]
    return "exact"
