from __future__ import annotations

import re

from services.document_schema.semantics import structure_role
from services.translation.policy.reference_section import looks_like_reference_entry_text

YEAR_RE = re.compile(r"\b(?:19|20)\d{2}\b")
AUTHOR_TOKEN_RE = re.compile(r"\b[A-Z][a-z]+(?:[-'][A-Za-z]+)?\b")
SHORT_FRAGMENT_RE = re.compile(r"^[A-Za-z][A-Za-z0-9._/-]{0,7}$")


def _normalized_text(item: dict) -> str:
    return " ".join((item.get("protected_source_text") or item.get("source_text") or "").split())

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
        "structure_role": structure_role(metadata) or "body",
        "reference_like": looks_like_reference_entry_text(text),
        "short_fragment_like": _looks_like_short_fragment(text),
        "has_inline_formula": bool(item.get("formula_map") or item.get("translation_unit_formula_map")),
        "contains_year": bool(YEAR_RE.search(text)),
        "author_like_token_count": len(AUTHOR_TOKEN_RE.findall(text)),
    }


__all__ = ["build_decision_hints"]
