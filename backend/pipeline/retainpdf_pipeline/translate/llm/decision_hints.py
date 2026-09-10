from __future__ import annotations

import re

from retainpdf_pipeline.translate.core.item_reader import item_block_kind
from retainpdf_pipeline.translate.core.item_reader import item_effective_role
from retainpdf_pipeline.translate.core.item_reader import item_is_reference_like
from retainpdf_pipeline.translate.core.item_reader import item_layout_role
from retainpdf_pipeline.translate.core.item_reader import item_semantic_role

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
    block_kind = item_block_kind(item) or "unknown"
    layout_role = item_layout_role(item) or ""
    semantic_role = item_semantic_role(item) or ""
    effective_role = item_effective_role(item) or "body"
    return {
        "block_type": block_kind,
        "block_kind": block_kind,
        "structure_role": effective_role,
        "layout_role": layout_role or "unknown",
        "semantic_role": semantic_role or "unknown",
        "reference_like": item_is_reference_like(item),
        "short_fragment_like": _looks_like_short_fragment(text),
        "has_inline_formula": bool(item.get("formula_map") or item.get("translation_unit_formula_map")),
        "contains_year": bool(YEAR_RE.search(text)),
        "author_like_token_count": len(AUTHOR_TOKEN_RE.findall(text)),
    }


__all__ = ["build_decision_hints"]
