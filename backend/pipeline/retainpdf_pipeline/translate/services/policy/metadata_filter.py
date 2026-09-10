import re

from retainpdf_pipeline.translate.core.item_reader import item_is_textual
from retainpdf_pipeline.translate.core.text_rules import looks_like_hard_nontranslatable_metadata
from retainpdf_pipeline.translate.core.text_rules import looks_like_pure_email_fragment
from retainpdf_pipeline.translate.core.text_rules import looks_like_short_copyright_tail
from retainpdf_pipeline.translate.core.text_rules import looks_like_url_fragment


COPYRIGHT_RE = re.compile(r"\b(copyright|all rights reserved|periodicals)\b", re.I)


def _normalized_text(item: dict) -> str:
    return " ".join((item.get("source_text") or "").split())


def _line_count(item: dict) -> int:
    return len(item.get("lines", []))


def _looks_like_pure_email_fragment(text: str) -> bool:
    return looks_like_pure_email_fragment(text)


def _looks_like_short_copyright_tail(text: str) -> bool:
    return looks_like_short_copyright_tail(text)


def looks_like_safe_nontranslatable_metadata(item: dict) -> bool:
    return looks_like_hard_nontranslatable_metadata(item)


def looks_like_nontranslatable_metadata(item: dict) -> bool:
    return looks_like_safe_nontranslatable_metadata(item)


def should_skip_metadata_fragment(item: dict) -> bool:
    if not item_is_textual(item):
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
