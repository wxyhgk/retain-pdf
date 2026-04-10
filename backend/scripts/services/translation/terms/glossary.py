from __future__ import annotations

from dataclasses import dataclass
import json
from typing import Any


@dataclass(frozen=True)
class GlossaryEntry:
    source: str
    target: str
    note: str = ""


def build_glossary_guidance(entries: list[GlossaryEntry]) -> str:
    if not entries:
        return ""
    lines = ["Glossary preferences:"]
    for entry in entries:
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
            note = item.note.strip()
        elif isinstance(item, dict):
            source = str(item.get("source", "") or "").strip()
            target = str(item.get("target", "") or "").strip()
            note = str(item.get("note", "") or "").strip()
        else:
            continue
        if not source or not target:
            continue
        normalized.append(GlossaryEntry(source=source, target=target, note=note))
    return normalized


def parse_glossary_json(text: str) -> list[GlossaryEntry]:
    raw = (text or "").strip()
    if not raw:
        return []
    payload = json.loads(raw)
    if not isinstance(payload, list):
        raise ValueError("glossary_json must be a JSON array")
    return normalize_glossary_entries(payload)
