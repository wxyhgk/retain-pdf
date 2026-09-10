from __future__ import annotations

import re
from collections import Counter
from typing import Iterable

from retainpdf_pipeline.translate.core.terms.glossary import GlossaryEntry
from retainpdf_pipeline.translate.core.terms.glossary import normalize_glossary_entries


TECH_TERM_RE = re.compile(
    r"\b(?:"
    r"[A-Z][a-z]+(?:-[A-Z][A-Za-z0-9]+)+"  # Hartree-Fock, Kohn-Sham
    r"|[A-Z]{2,}(?:[-_/][A-Za-z0-9]+)+"  # GFN2-xTB, LCAO-MO
    r"|[A-Za-z]+[0-9][A-Za-z0-9]*(?:[-_/][A-Za-z0-9]+)*"  # DFTB3, GFN2-xTB
    r"|[A-Z]{2,}[a-z]*\b"  # SCF, DFT, XTB
    r")\b"
)

_TRIM_CHARS = ".,;:()[]{}<>\"'“”‘’"
_COMMON_WORDS = {
    "AND",
    "ARE",
    "CAN",
    "FOR",
    "FROM",
    "HAS",
    "HAVE",
    "HERE",
    "INTO",
    "NOT",
    "THE",
    "THIS",
    "THAT",
    "THESE",
    "THOSE",
    "WERE",
    "WHEN",
    "WITH",
}


def auto_preserve_glossary_entries_from_texts(
    texts: Iterable[str],
    *,
    existing_entries: list[GlossaryEntry | dict] | None = None,
    min_hits: int = 1,
    max_entries: int = 240,
) -> list[GlossaryEntry]:
    existing = normalize_glossary_entries(existing_entries)
    existing_sources = {entry.source.casefold() for entry in existing}
    counter: Counter[str] = Counter()
    canonical_by_key: dict[str, str] = {}
    for text in texts:
        for match in TECH_TERM_RE.finditer(text or ""):
            term = _normalize_candidate(match.group(0))
            if not _should_preserve_candidate(term):
                continue
            key = term.casefold()
            counter[key] += 1
            canonical_by_key.setdefault(key, term)

    entries: list[GlossaryEntry] = []
    for key, hits in sorted(counter.items(), key=lambda item: (-item[1], canonical_by_key[item[0]].casefold())):
        if hits < min_hits or key in existing_sources:
            continue
        term = canonical_by_key[key]
        entries.append(
            GlossaryEntry(
                source=term,
                target=term,
                level="preserve",
                match_mode="case_insensitive",
                note="auto_preserve_technical_term",
            )
        )
        if len(entries) >= max_entries:
            break
    return entries


def merge_auto_preserve_glossary_entries(
    entries: list[GlossaryEntry | dict] | None,
    texts: Iterable[str],
    *,
    min_hits: int = 1,
    max_entries: int = 240,
) -> list[GlossaryEntry]:
    normalized = normalize_glossary_entries(entries)
    auto_entries = auto_preserve_glossary_entries_from_texts(
        texts,
        existing_entries=normalized,
        min_hits=min_hits,
        max_entries=max_entries,
    )
    return [*normalized, *auto_entries]


def _normalize_candidate(value: str) -> str:
    return " ".join((value or "").strip(_TRIM_CHARS).split())


def _should_preserve_candidate(value: str) -> bool:
    if len(value) < 2:
        return False
    upper = value.upper()
    if upper in _COMMON_WORDS:
        return False
    if value.isdigit():
        return False
    if "-" in value or "_" in value or "/" in value:
        return any(ch.isalpha() for ch in value)
    if any(ch.isdigit() for ch in value):
        return any(ch.isalpha() for ch in value)
    if value.isupper():
        return 2 <= len(value) <= 12
    return False


__all__ = [
    "auto_preserve_glossary_entries_from_texts",
    "merge_auto_preserve_glossary_entries",
]
