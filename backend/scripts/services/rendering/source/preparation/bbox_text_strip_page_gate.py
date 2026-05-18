from __future__ import annotations

import fitz

from services.rendering.source.preparation.bbox_text_strip_page_probe import page_content_stream_too_large
from services.rendering.source.preparation.bbox_text_strip_page_probe import page_has_text_overlap
from services.rendering.source.preparation.bbox_text_strip_policy_adapter import should_skip_page_for_bbox_text_strip
from services.rendering.source.preparation.bbox_text_strip_types import BBOX_TEXT_STRIP_PAGE_SKIP_COMPLEX
from services.rendering.source.preparation.bbox_text_strip_types import BBOX_TEXT_STRIP_PAGE_SKIP_NONE
from services.rendering.source.preparation.bbox_text_strip_types import BBOX_TEXT_STRIP_PAGE_SKIP_NO_TEXT_OVERLAP


def bbox_text_strip_items_skip_reason(
    items: list[dict],
    *,
    skip_formula_pages: bool,
) -> str:
    if should_skip_page_for_bbox_text_strip(items, skip_formula_pages=skip_formula_pages):
        return BBOX_TEXT_STRIP_PAGE_SKIP_COMPLEX
    return BBOX_TEXT_STRIP_PAGE_SKIP_NONE


def bbox_text_strip_page_skip_reason(
    doc: fitz.Document,
    page: fitz.Page,
    *,
    source_item_rects: list[fitz.Rect],
) -> str:
    if not source_item_rects:
        return BBOX_TEXT_STRIP_PAGE_SKIP_NONE
    if page_content_stream_too_large(doc, page):
        return BBOX_TEXT_STRIP_PAGE_SKIP_COMPLEX
    if not page_has_text_overlap(page, source_item_rects):
        return BBOX_TEXT_STRIP_PAGE_SKIP_NO_TEXT_OVERLAP
    return BBOX_TEXT_STRIP_PAGE_SKIP_NONE
