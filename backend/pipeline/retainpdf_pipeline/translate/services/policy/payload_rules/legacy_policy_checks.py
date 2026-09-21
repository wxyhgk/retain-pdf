from __future__ import annotations

import re

from retainpdf_pipeline.translate.core.item_reader import item_block_kind
from retainpdf_pipeline.translate.core.item_reader import item_is_bodylike

_CJK_CHAR_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff]")
_LATIN_CHAR_RE = re.compile(r"[A-Za-z]")
_EN_WORD_RE = re.compile(r"[A-Za-z]+(?:[-'][A-Za-z]+)?")
_PROSE_CUE_RE = re.compile(
    r"\b(if|when|then|thus|are|is|was|were|seen|rules?|vertices?|order|bump|more|governed)\b",
    re.I,
)
NUMBERED_SUMMARY_RE = re.compile(r"^\s*\d+\.\s+[A-Z]")
REFERENCE_ENTRY_RE = re.compile(r"^\s*(?:\[\d+]|[A-Z][^,]{0,40},\s+[A-Z])")
NUMBERED_REFERENCE_ENTRY_RE = re.compile(
    r"^\s*\d+\.\s+(?:[A-Z][A-Za-z'`-]+,\s+[A-Z]|[A-Z][A-Za-z'`-]+(?:\s+[A-Z]\.){1,3}(?:\s+[A-Z][A-Za-z'`-]+)?)"
)


def english_words(text: str) -> list[str]:
    return _EN_WORD_RE.findall(str(text or ""))


def prose_cue_match(text: str):
    return _PROSE_CUE_RE.search(str(text or ""))


def looks_like_cjk_dominant_body_text(item: dict) -> bool:
    if item_block_kind(item) != "text":
        return False
    if not item_is_bodylike(item):
        return False
    source_text = str(
        item.get("translation_unit_protected_source_text")
        or item.get("protected_source_text")
        or item.get("source_text")
        or ""
    )
    compact = " ".join(source_text.split())
    if len(compact) < 16:
        return False
    cjk_chars = len(_CJK_CHAR_RE.findall(compact))
    if cjk_chars < 10:
        return False
    latin_chars = len(_LATIN_CHAR_RE.findall(compact))
    word_count = len(english_words(compact))
    return cjk_chars >= max(10, latin_chars * 2, word_count * 2)


__all__ = [
    "NUMBERED_REFERENCE_ENTRY_RE",
    "NUMBERED_SUMMARY_RE",
    "REFERENCE_ENTRY_RE",
    "english_words",
    "looks_like_cjk_dominant_body_text",
    "prose_cue_match",
]
