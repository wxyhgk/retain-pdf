from __future__ import annotations

import fitz

from services.rendering.source.cleanup.config import SAFE_DIRECT_REDACTION_IOU_THRESHOLD
from services.rendering.source.cleanup.config import SAFE_DIRECT_REDACTION_SIZE_TOLERANCE
from services.rendering.source.cleanup.redaction_padding import expand_word_rect
from services.rendering.source.cleanup.text_extract import extract_page_text_spans
from services.rendering.source.cleanup.text_extract import rect_contains_point
from services.rendering.source.cleanup.text_ownership import owned_text_block_entries
from services.rendering.source.rects import rect_area
from services.rendering.source.rects import rects_overlap_area


def rect_iou(a: fitz.Rect, b: fitz.Rect) -> float:
    inter = rects_overlap_area(a, b)
    if inter <= 0.0:
        return 0.0
    union = rect_area(a) + rect_area(b) - inter
    if union <= 0.0:
        return 0.0
    return inter / union


def rect_center_contains(rect: fitz.Rect, target: fitz.Rect) -> bool:
    cx = (target.x0 + target.x1) / 2.0
    cy = (target.y0 + target.y1) / 2.0
    return rect_contains_point(rect, cx, cy)


def relative_size_error(expected: float, actual: float) -> float:
    baseline = max(expected, 1.0)
    return abs(actual - expected) / baseline


def safe_direct_redaction_rect(
    page: fitz.Page,
    item: dict,
    rect: fitz.Rect,
    *,
    competing_rects: list[fitz.Rect] | None = None,
) -> fitz.Rect | None:
    del item
    if rect.is_empty:
        return None

    raw_bbox = fitz.Rect(rect)
    span_entries = extract_page_text_spans(page)
    if not span_entries:
        return None
    owned_spans = owned_text_block_entries(raw_bbox, span_entries, competing_rects=competing_rects)
    if not owned_spans:
        return None

    matched: list[fitz.Rect] = []
    for span_rect, _span_text in owned_spans:
        if not rect_center_contains(span_rect, raw_bbox):
            continue
        width_error = relative_size_error(raw_bbox.width, span_rect.width)
        height_error = relative_size_error(raw_bbox.height, span_rect.height)
        iou = rect_iou(raw_bbox, span_rect)
        if width_error > SAFE_DIRECT_REDACTION_SIZE_TOLERANCE:
            continue
        if height_error > SAFE_DIRECT_REDACTION_SIZE_TOLERANCE:
            continue
        if iou < SAFE_DIRECT_REDACTION_IOU_THRESHOLD:
            continue
        matched.append(span_rect)

    if len(matched) != 1:
        return None
    return expand_word_rect(matched[0])
