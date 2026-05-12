from __future__ import annotations

import fitz

from services.rendering.source.cleanup.config import SAFE_DIRECT_REDACTION_IOU_THRESHOLD
from services.rendering.source.cleanup.config import SAFE_DIRECT_REDACTION_SIZE_TOLERANCE
from services.rendering.source.cleanup.geometry import expand_item_rect
from services.rendering.source.cleanup.geometry import expand_word_rect
from services.rendering.source.cleanup.geometry import rect_area
from services.rendering.source.cleanup.geometry import rect_key
from services.rendering.source.cleanup.geometry import rects_overlap_area
from services.rendering.source.cleanup.shared import get_item_formula_map
from services.rendering.source.cleanup.shared import normalize_words
from services.rendering.source.cleanup.text_extract import extract_item_word_entries
from services.rendering.source.cleanup.text_extract import extract_page_text_blocks
from services.rendering.source.cleanup.text_extract import extract_page_text_spans
from services.rendering.source.cleanup.text_extract import rect_center
from services.rendering.source.cleanup.text_extract import rect_contains_point

DISPLAY_INTRUSIVE_OVERLAP_AREA_MIN = 6.0


def _squared_distance(a: tuple[float, float], b: tuple[float, float]) -> float:
    dx = a[0] - b[0]
    dy = a[1] - b[1]
    return dx * dx + dy * dy


def owned_word_entries(
    rect: fitz.Rect,
    entries: list[tuple[fitz.Rect, str]],
    *,
    competing_rects: list[fitz.Rect] | None = None,
) -> list[tuple[fitz.Rect, str]]:
    if not entries:
        return []

    competing = [candidate for candidate in (competing_rects or []) if not candidate.is_empty]
    owned: list[tuple[fitz.Rect, str]] = []
    for word_rect_value, token in entries:
        center = rect_center(word_rect_value)
        if not rect_contains_point(rect, center[0], center[1]):
            continue

        owners = [candidate for candidate in competing if rect_contains_point(candidate, center[0], center[1])]
        if owners:
            best_owner = min(owners, key=lambda candidate: _squared_distance(rect_center(candidate), center))
            if best_owner != rect:
                continue
        owned.append((word_rect_value, token))
    return owned


def owned_text_block_entries(
    rect: fitz.Rect,
    entries: list[tuple[fitz.Rect, str]],
    *,
    competing_rects: list[fitz.Rect] | None = None,
) -> list[tuple[fitz.Rect, str]]:
    if not entries:
        return []
    competing = [candidate for candidate in (competing_rects or []) if not candidate.is_empty]
    owned: list[tuple[fitz.Rect, str]] = []
    for block_rect, text in entries:
        center = rect_center(block_rect)
        if not rect_contains_point(rect, center[0], center[1]):
            continue
        owners = [candidate for candidate in competing if rect_contains_point(candidate, center[0], center[1])]
        if owners:
            best_owner = min(owners, key=lambda candidate: _squared_distance(rect_center(candidate), center))
            if best_owner != rect:
                continue
        owned.append((block_rect, text))
    return owned


def word_entries_to_redaction_rects(entries: list[tuple[fitz.Rect, str]]) -> list[fitz.Rect]:
    rects: list[fitz.Rect] = []
    seen: set[tuple[int, int, int, int]] = set()
    for rect, _token in entries:
        expanded = expand_word_rect(rect)
        key = rect_key(expanded)
        if key in seen:
            continue
        seen.add(key)
        rects.append(expanded)
    return rects


def item_bbox_redaction_rect(rect: fitz.Rect) -> list[fitz.Rect]:
    expanded = expand_item_rect(rect)
    return [expanded] if not expanded.is_empty else []


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


def rect_intersects_intrusive_display_text(rect: fitz.Rect, intrusive_rects: list[fitz.Rect]) -> bool:
    for intrusive_rect in intrusive_rects:
        if rects_overlap_area(rect, intrusive_rect) >= DISPLAY_INTRUSIVE_OVERLAP_AREA_MIN:
            return True
    return False


def filter_rects_away_from_special_math(
    rects: list[fitz.Rect],
    special_math_rects: list[fitz.Rect] | None,
) -> list[fitz.Rect]:
    if not rects or not special_math_rects:
        return rects
    filtered: list[fitz.Rect] = []
    for rect in rects:
        if any(rects_overlap_area(rect, math_rect) > 0.5 for math_rect in special_math_rects):
            continue
        filtered.append(rect)
    return filtered


def item_has_formula(item: dict) -> bool:
    return bool(get_item_formula_map(item))


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

    block_entries = extract_page_text_blocks(page)
    if block_entries:
        block_entries = owned_text_block_entries(rect, block_entries, competing_rects=competing_rects)
        matched_block_rects: list[fitz.Rect] = []
        seen_blocks: set[tuple[int, int, int, int]] = set()
        for block_rect, block_text in block_entries:
            block_words = normalize_words(block_text)
            if not block_words:
                continue
            block_word_set = set(block_words)
            source_word_set = set(source_words)
            overlap = len(block_word_set & source_word_set)
            if not source_word_set:
                passed = len(block_words) >= 2
            elif len(source_word_set) <= 3:
                passed = overlap >= 1
            elif len(source_word_set) <= 8:
                passed = overlap >= 2
            else:
                passed = overlap >= max(2, int(len(source_word_set) * 0.3))
            if not passed:
                continue
            expanded = expand_word_rect(block_rect)
            key = rect_key(expanded)
            if key in seen_blocks:
                continue
            seen_blocks.add(key)
            matched_block_rects.append(expanded)
        if matched_block_rects:
            filtered_block_rects = filter_rects_away_from_special_math(matched_block_rects, special_math_rects)
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

    pdf_word_set = set(pdf_words)
    source_word_set = set(source_words)
    overlap = len(pdf_word_set & source_word_set)
    source_len = len(source_words)

    if source_len <= 3:
        passed = overlap >= 1
    elif source_len <= 8:
        passed = overlap >= 2
    else:
        passed = overlap >= max(2, int(source_len * 0.3))

    if not passed:
        return []
    return filter_rects_away_from_special_math(word_entries_to_redaction_rects(word_entries), special_math_rects)
