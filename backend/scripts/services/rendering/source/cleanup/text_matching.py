from __future__ import annotations

import fitz

from services.rendering.source.cleanup.redaction_padding import expand_word_rect
from services.rendering.source.cleanup.text_extract import extract_item_word_entries
from services.rendering.source.cleanup.text_extract import extract_page_text_blocks
from services.rendering.source.cleanup.text_math_guard import filter_rects_away_from_special_math
from services.rendering.source.cleanup.text_ownership import owned_text_block_entries
from services.rendering.source.cleanup.text_ownership import owned_word_entries
from services.rendering.source.cleanup.text_rects import item_bbox_redaction_rect
from services.rendering.source.cleanup.text_rects import word_entries_to_redaction_rects
from services.rendering.source.cleanup.text_safe_direct import safe_direct_redaction_rect
from services.rendering.source.items import normalize_words
from services.rendering.source.rects import rect_key


def item_has_removable_text(
    page: fitz.Page,
    item: dict,
    rect: fitz.Rect,
    page_words: list[tuple] | None = None,
) -> bool:
    del page_words
    return safe_direct_redaction_rect(page, item, rect) is not None


def item_removable_text_rects(
    page: fitz.Page,
    item: dict,
    rect: fitz.Rect,
    page_words: list[tuple] | None = None,
    special_math_rects: list[fitz.Rect] | None = None,
    competing_rects: list[fitz.Rect] | None = None,
) -> list[fitz.Rect]:
    matched = safe_direct_redaction_rect(page, item, rect, competing_rects=competing_rects)
    if matched is not None:
        return filter_rects_away_from_special_math([matched], special_math_rects)

    source_text = (item.get("source_text") or item.get("protected_source_text") or "").strip()
    if not source_text:
        return []

    source_words = normalize_words(source_text)
    block_rects = _matched_text_block_rects(page, rect, source_words, competing_rects=competing_rects)
    if block_rects:
        filtered_block_rects = filter_rects_away_from_special_math(block_rects, special_math_rects)
        if filtered_block_rects:
            return filtered_block_rects

    word_entries = extract_item_word_entries(page, rect, page_words=page_words)
    if not word_entries:
        return []
    word_entries = owned_word_entries(rect, word_entries, competing_rects=competing_rects)
    if not word_entries:
        return []

    pdf_words: list[str] = []
    for _rect, token in word_entries:
        pdf_words.extend(normalize_words(token))
    if not pdf_words:
        return []

    if not source_words:
        if len(pdf_words) < 2:
            return []
        return filter_rects_away_from_special_math(item_bbox_redaction_rect(rect), special_math_rects)

    if not _word_overlap_passes(source_words, pdf_words):
        return []
    return filter_rects_away_from_special_math(word_entries_to_redaction_rects(word_entries), special_math_rects)


def _matched_text_block_rects(
    page: fitz.Page,
    rect: fitz.Rect,
    source_words: list[str],
    *,
    competing_rects: list[fitz.Rect] | None = None,
) -> list[fitz.Rect]:
    block_entries = extract_page_text_blocks(page)
    if not block_entries:
        return []

    block_entries = owned_text_block_entries(rect, block_entries, competing_rects=competing_rects)
    matched_block_rects: list[fitz.Rect] = []
    seen_blocks: set[tuple[int, int, int, int]] = set()
    for block_rect, block_text in block_entries:
        block_words = normalize_words(block_text)
        if not block_words or not _word_overlap_passes(source_words, block_words):
            continue
        expanded = expand_word_rect(block_rect)
        key = rect_key(expanded)
        if key in seen_blocks:
            continue
        seen_blocks.add(key)
        matched_block_rects.append(expanded)
    return matched_block_rects


def _word_overlap_passes(source_words: list[str], candidate_words: list[str]) -> bool:
    source_word_set = set(source_words)
    candidate_word_set = set(candidate_words)
    overlap = len(candidate_word_set & source_word_set)
    if not source_word_set:
        return len(candidate_words) >= 2

    source_len = len(source_words)
    if source_len <= 3:
        return overlap >= 1
    if source_len <= 8:
        return overlap >= 2
    return overlap >= max(2, int(source_len * 0.3))
