import re


COPYRIGHT_RE = re.compile(r"\b(copyright|all rights reserved|periodicals)\b", re.I)
COPYRIGHT_TAIL_RE = re.compile(
    r"\b(?:copyright|all rights reserved|trademarks?|registered|unregistered|intellectual property rights?)\b",
    re.I,
)
EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
URL_LIKE_RE = re.compile(
    r"^(?:(?:https?://|ftp://|www\.)\S+|(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?:/[A-Za-z0-9._~:/?#\[\]@!$&()*+,;=%-]*)?)$",
    re.I,
)


def _normalized_text(item: dict) -> str:
    return " ".join((item.get("source_text") or "").split())


def _line_count(item: dict) -> int:
    return len(item.get("lines", []))


def looks_like_url_fragment(text: str) -> bool:
    stripped = text.strip().strip("()[]<>\"'“”‘’,;")
    if not stripped or any(ch.isspace() for ch in stripped):
        return False
    return bool(URL_LIKE_RE.fullmatch(stripped))


def _looks_like_pure_email_fragment(text: str) -> bool:
    stripped = text.strip().strip("()[]<>\"'“”‘’,;")
    return bool(EMAIL_RE.fullmatch(stripped))


def _looks_like_short_copyright_tail(text: str) -> bool:
    normalized = " ".join(text.split()).strip()
    if not normalized:
        return False
    lowered = normalized.lower()
    if len(normalized) > 220:
        return False
    if len(re.findall(r"[A-Za-z]+(?:[-'][A-Za-z]+)?", normalized)) > 32:
        return False
    if not COPYRIGHT_TAIL_RE.search(normalized):
        return False
    tail_signals = (
        "all rights reserved",
        "copyright",
        "trademark",
        "trademarks",
        "registered trademark",
        "registered and unregistered",
        "intellectual property rights",
        "key symbol",
        "periodicals",
    )
    if not any(signal in lowered for signal in tail_signals):
        return False
    disclaimer_markers = (
        "redistribution of this document",
        "accepts no liability",
        "written permission",
        "this material is distributed",
        "advised to seek independent professional advice",
    )
    if any(marker in lowered for marker in disclaimer_markers):
        return False
    return True


def looks_like_hard_nontranslatable_metadata(item: dict) -> bool:
    if item.get("block_type") not in {"text", "title", "list"}:
        return False

    text = _normalized_text(item)
    if not text:
        return False

    return looks_like_url_fragment(text) or _looks_like_pure_email_fragment(text) or _looks_like_short_copyright_tail(text)


def looks_like_safe_nontranslatable_metadata(item: dict) -> bool:
    return looks_like_hard_nontranslatable_metadata(item)


def looks_like_nontranslatable_metadata(item: dict) -> bool:
    return looks_like_safe_nontranslatable_metadata(item)


def should_skip_metadata_fragment(item: dict) -> bool:
    if item.get("block_type") not in {"text", "title", "list"}:
        return False
    if not item.get("should_translate", True):
        return False

    text = _normalized_text(item)
    if not text:
        return False
    return looks_like_safe_nontranslatable_metadata(item)


def find_metadata_fragment_item_ids(payload: list[dict]) -> set[str]:
    skipped: set[str] = set()
    for item in payload:
        if should_skip_metadata_fragment(item):
            skipped.add(item.get("item_id", ""))
    return skipped


__all__ = [
    "find_metadata_fragment_item_ids",
    "looks_like_hard_nontranslatable_metadata",
    "looks_like_url_fragment",
    "looks_like_safe_nontranslatable_metadata",
    "looks_like_nontranslatable_metadata",
    "should_skip_metadata_fragment",
]
