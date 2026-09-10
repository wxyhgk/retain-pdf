from __future__ import annotations

from dataclasses import dataclass
import re

from retainpdf_pipeline.translate.core.terms.glossary import TERM_WORD_CHARS


@dataclass(frozen=True)
class AbbreviationEntry:
    source: str
    target: str = ""
    expansion: str = ""
    strategy: str = "keep"


def build_abbreviation_guidance(entries: list[AbbreviationEntry]) -> str:
    if not entries:
        return ""
    lines = ["Abbreviation preferences:"]
    for entry in entries:
        summary = f"- {entry.source}: strategy={entry.strategy}"
        if entry.target.strip():
            summary = f"{summary}, target={entry.target.strip()}"
        if entry.expansion.strip():
            summary = f"{summary}, expansion={entry.expansion.strip()}"
        lines.append(summary)
    return "\n".join(lines)


def matched_abbreviation_entries(entries: list[AbbreviationEntry] | None, text: str) -> list[AbbreviationEntry]:
    if not entries or not text:
        return []
    matched: list[AbbreviationEntry] = []
    seen: set[tuple[str, str, str, str]] = set()
    for entry in sorted(entries, key=lambda item: (-len(item.source), item.source.casefold())):
        source = entry.source.strip()
        if not source:
            continue
        pattern = re.compile(
            rf"(?<![{TERM_WORD_CHARS}]){re.escape(source)}(?![{TERM_WORD_CHARS}])",
            re.IGNORECASE,
        )
        if not pattern.search(text):
            continue
        key = (source.casefold(), entry.target.strip().casefold(), entry.expansion.strip().casefold(), entry.strategy.strip().casefold())
        if key in seen:
            continue
        seen.add(key)
        matched.append(entry)
    return matched
