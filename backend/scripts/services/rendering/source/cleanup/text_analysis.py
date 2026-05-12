from __future__ import annotations

import fitz

from services.rendering.source.cleanup.geometry import rect_area
from services.rendering.source.cleanup.text_extract import extract_item_word_entries
from services.rendering.source.cleanup.text_extract import extract_page_text_blocks
from services.rendering.source.cleanup.text_extract import extract_page_text_spans
from services.rendering.source.cleanup.text_extract import extract_page_words
from services.rendering.source.cleanup.text_extract import rect_center
from services.rendering.source.cleanup.text_extract import rect_contains_point
from services.rendering.source.cleanup.text_extract import word_rect
from services.rendering.source.cleanup.text_match import DISPLAY_INTRUSIVE_OVERLAP_AREA_MIN
from services.rendering.source.cleanup.text_match import filter_rects_away_from_special_math
from services.rendering.source.cleanup.text_match import item_bbox_redaction_rect
from services.rendering.source.cleanup.text_match import item_has_formula
from services.rendering.source.cleanup.text_match import item_has_removable_text
from services.rendering.source.cleanup.text_match import item_removable_text_rects
from services.rendering.source.cleanup.text_match import owned_text_block_entries
from services.rendering.source.cleanup.text_match import owned_word_entries
from services.rendering.source.cleanup.text_match import rect_center_contains
from services.rendering.source.cleanup.text_match import rect_intersects_intrusive_display_text
from services.rendering.source.cleanup.text_match import rect_iou
from services.rendering.source.cleanup.text_match import relative_size_error
from services.rendering.source.cleanup.text_match import safe_direct_redaction_rect
from services.rendering.source.cleanup.text_match import word_entries_to_redaction_rects

DISPLAY_INTRUSIVE_HEIGHT_RATIO = 3.0
DISPLAY_INTRUSIVE_MAX_TEXT_LEN = 2


def page_has_large_background_image(
    page: fitz.Page,
    *,
    coverage_ratio_threshold: float = 0.75,
) -> bool:
    page_area = max(rect_area(page.rect), 1.0)
    try:
        images = page.get_images(full=True)
    except Exception:
        return False

    for image in images:
        if not image:
            continue
        xref = image[0]
        try:
            rects = page.get_image_rects(xref)
        except Exception:
            continue
        for rect in rects:
            if rect.is_empty:
                continue
            coverage_ratio = rect_area(rect & page.rect) / page_area
            if coverage_ratio >= coverage_ratio_threshold:
                return True
    return False


def collect_page_intrusive_display_text_rects(page: fitz.Page) -> list[fitz.Rect]:
    try:
        text_dict = page.get_text("dict")
    except Exception:
        return []

    span_heights: list[float] = []
    candidates: list[tuple[fitz.Rect, str, float]] = []
    for block in text_dict.get("blocks", []) or []:
        for line in block.get("lines", []) or []:
            for span in line.get("spans", []) or []:
                text = str(span.get("text", "") or "").strip()
                bbox = span.get("bbox", [])
                if len(bbox) != 4:
                    continue
                rect = fitz.Rect(bbox)
                if rect.is_empty:
                    continue
                height = max(0.0, rect.y1 - rect.y0)
                if height <= 0.5:
                    continue
                if text:
                    span_heights.append(height)
                candidates.append((rect, text, height))

    if not span_heights:
        return []
    span_heights.sort()
    baseline_height = span_heights[len(span_heights) // 2]
    if baseline_height <= 0.5:
        return []

    intrusive: list[fitz.Rect] = []
    for rect, text, height in candidates:
        compact_text = "".join(text.split())
        if len(compact_text) > DISPLAY_INTRUSIVE_MAX_TEXT_LEN:
            continue
        if height < baseline_height * DISPLAY_INTRUSIVE_HEIGHT_RATIO:
            continue
        intrusive.append(rect)
    return intrusive
