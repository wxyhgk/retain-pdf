from __future__ import annotations

import re

YEAR_RE = re.compile(r"\b(?:19|20)\d{2}\b")
REFERENCE_SIGNAL_RE = re.compile(
    r"\b(?:proc\.|proceedings|conference|journal|vol\.|volume|no\.|pp\.|pages?|doi|isbn|ifaamas|acm|ieee|springer|elsevier)\b",
    re.I,
)
AUTHOR_TOKEN_RE = re.compile(r"\b[A-Z][a-z]+(?:[-'][A-Za-z]+)?\b")
TITLE_CASE_NAME_RE = re.compile(r"\b[A-Z][a-z]+(?:[-'][A-Za-z]+)?(?:\s+[A-Z][a-z]+(?:[-'][A-Za-z]+)?){1,4}\b")
SHORT_FRAGMENT_RE = re.compile(r"^[A-Za-z][A-Za-z0-9._/-]{0,7}$")


def _normalized_text(item: dict) -> str:
    return " ".join((item.get("protected_source_text") or item.get("source_text") or "").split())


def _looks_like_reference_entry(text: str) -> bool:
    if not text:
        return False
    if not YEAR_RE.search(text):
        return False
    signal_count = len(REFERENCE_SIGNAL_RE.findall(text))
    author_like = len(TITLE_CASE_NAME_RE.findall(text)) >= 1 or text.count(",") >= 2
    return signal_count >= 1 and author_like


def _looks_like_short_fragment(text: str) -> bool:
    stripped = text.strip()
    if not stripped or " " in stripped:
        return False
    return bool(SHORT_FRAGMENT_RE.fullmatch(stripped))


def build_decision_hints(item: dict) -> dict[str, object]:
    text = _normalized_text(item)
    metadata = item.get("metadata", {}) or {}
    return {
        "block_type": item.get("block_type", "unknown"),
        "structure_role": metadata.get("structure_role", "body"),
        "reference_like": _looks_like_reference_entry(text),
        "short_fragment_like": _looks_like_short_fragment(text),
        "has_inline_formula": bool(item.get("formula_map") or item.get("translation_unit_formula_map")),
        "contains_year": bool(YEAR_RE.search(text)),
        "author_like_token_count": len(AUTHOR_TOKEN_RE.findall(text)),
    }


__all__ = ["build_decision_hints"]
