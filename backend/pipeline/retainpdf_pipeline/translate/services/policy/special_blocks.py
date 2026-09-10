from __future__ import annotations

import re

from retainpdf_pipeline.translate.core.placeholder_tokens import strip_placeholders


_CONTRIBUTOR_HEADING_RE = re.compile(
    r"\b("
    r"data contributors?|contributors?|authors?|affiliations?|"
    r"corresponding authors?|acknowledgements?"
    r")\b",
    re.IGNORECASE,
)
_ENUMERATION_TOKEN_RE = re.compile(r"(?:^|\s)(?:\d{1,3}|[A-Z])[\.)]\s+")
_SUPERSCRIPT_MARKER_RE = re.compile(r"\$\s*\^\s*\{?[\d,\-\s]+\}?\s*\$")
_NAME_LIKE_TOKEN_RE = re.compile(r"\b[A-Z][a-zA-Z'\-]{2,}\b")


def _compact_text(text: str) -> str:
    return " ".join(strip_placeholders(str(text or "")).split())


def _comma_density(text: str) -> float:
    return text.count(",") / max(1, len(text.split()))


def _numbered_list_density(text: str) -> float:
    matches = _ENUMERATION_TOKEN_RE.findall(text)
    return len(matches) / max(1, len(text.split()))


def _superscript_density(text: str) -> float:
    return len(_SUPERSCRIPT_MARKER_RE.findall(text)) / max(1, len(text.split()))


def _name_like_density(text: str) -> float:
    return len(_NAME_LIKE_TOKEN_RE.findall(text)) / max(1, len(text.split()))


def looks_like_special_long_list_block(text: str) -> bool:
    compact = _compact_text(text)
    if len(compact) < 900:
        return False
    words = compact.split()
    if len(words) < 130:
        return False
    comma_density = _comma_density(compact)
    numbered_density = _numbered_list_density(compact)
    superscript_density = _superscript_density(compact)
    name_like_density = _name_like_density(compact)
    has_heading = bool(_CONTRIBUTOR_HEADING_RE.search(compact[:300]))
    if has_heading and (comma_density >= 0.12 or superscript_density >= 0.08):
        return True
    if numbered_density >= 0.12:
        return True
    if numbered_density >= 0.06 and comma_density >= 0.04:
        return True
    if superscript_density >= 0.14 and comma_density >= 0.10:
        return True
    if comma_density >= 0.28 and name_like_density >= 0.50:
        return True
    return False


__all__ = ["looks_like_special_long_list_block"]
