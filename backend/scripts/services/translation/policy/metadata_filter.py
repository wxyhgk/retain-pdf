import re


COPYRIGHT_RE = re.compile(r"\b(copyright|all rights reserved|periodicals)\b", re.I)
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


def looks_like_hard_nontranslatable_metadata(item: dict) -> bool:
    if item.get("block_type") not in {"text", "title", "list"}:
        return False

    text = _normalized_text(item)
    if not text:
        return False

    return looks_like_url_fragment(text) or _looks_like_pure_email_fragment(text) or bool(COPYRIGHT_RE.search(text))


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
