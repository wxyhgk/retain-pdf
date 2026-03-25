from __future__ import annotations

import fitz

from rendering.pdf_overlay_parts.redaction_config import (
    HEAVY_VECTOR_PAGE_DRAWINGS_THRESHOLD,
    LOCAL_VECTOR_ITEM_AREA_RATIO_THRESHOLD,
    LOCAL_VECTOR_ITEM_DRAWINGS_THRESHOLD,
    MATH_INTRUSIVE_HEIGHT_RATIO,
    MATH_INTRUSIVE_OVERLAP_AREA_MIN,
    SPECIAL_MATH_FONT_MARKERS,
)
from rendering.pdf_overlay_parts.redaction_geometry import (
    clip_rect,
    expand_formula_rect,
    expand_word_rect,
    merge_dedup_rects,
    rect_area,
    rect_intersects_protected,
    rect_key,
)
from rendering.pdf_overlay_parts.shared import get_item_formula_map, normalize_words


def word_rect(entry: tuple) -> fitz.Rect | None:
    if len(entry) < 5:
        return None
    try:
        return fitz.Rect(entry[:4])
    except Exception:
        return None


def extract_page_words(page: fitz.Page) -> list[tuple]:
    try:
        return page.get_text("words")
    except Exception:
        return []


def is_special_math_font(font_name: str) -> bool:
    normalized = str(font_name or "").strip().lower()
    if not normalized:
        return False
    return any(marker in normalized for marker in SPECIAL_MATH_FONT_MARKERS)


def collect_page_math_protection_rects(page: fitz.Page) -> list[fitz.Rect]:
    try:
        text_dict = page.get_text("dict")
    except Exception:
        return []

    rects: list[fitz.Rect] = []
    seen: set[tuple[int, int, int, int]] = set()
    for block in text_dict.get("blocks", []) or []:
        for line in block.get("lines", []) or []:
            for span in line.get("spans", []) or []:
                if not is_special_math_font(span.get("font", "")):
                    continue
                bbox = span.get("bbox", [])
                if len(bbox) != 4:
                    continue
                rect = fitz.Rect(bbox)
                if rect.is_empty:
                    continue
                key = rect_key(rect)
                if key in seen:
                    continue
                seen.add(key)
                rects.append(rect)
    return rects


def collect_page_non_math_span_heights(page: fitz.Page) -> list[float]:
    try:
        text_dict = page.get_text("dict")
    except Exception:
        return []

    heights: list[float] = []
    for block in text_dict.get("blocks", []) or []:
        for line in block.get("lines", []) or []:
            for span in line.get("spans", []) or []:
                font_name = str(span.get("font", "")).lower()
                text = str(span.get("text", "") or "").strip()
                if not text or is_special_math_font(font_name):
                    continue
                bbox = span.get("bbox", [])
                if len(bbox) != 4:
                    continue
                rect = fitz.Rect(bbox)
                if rect.is_empty:
                    continue
                height = max(0.0, rect.y1 - rect.y0)
                if height > 0.5:
                    heights.append(height)
    return heights


def page_has_intrusive_math_protection(
    valid_items: list[tuple[fitz.Rect, dict, str]],
    protected_math_rects: list[fitz.Rect],
    non_math_span_heights: list[float],
) -> bool:
    if not protected_math_rects or not valid_items or not non_math_span_heights:
        return False

    sorted_heights = sorted(non_math_span_heights)
    baseline_height = sorted_heights[len(sorted_heights) // 2]
    if baseline_height <= 0.5:
        return False

    for protected in protected_math_rects:
        protected_height = max(0.0, protected.y1 - protected.y0)
        if protected_height < baseline_height * MATH_INTRUSIVE_HEIGHT_RATIO:
            continue
        for item_rect, _item, _translated_text in valid_items:
            inter = item_rect & protected
            if not inter.is_empty and rect_area(inter) >= MATH_INTRUSIVE_OVERLAP_AREA_MIN:
                return True
    return False


def extract_item_word_entries(
    page: fitz.Page,
    rect: fitz.Rect,
    page_words: list[tuple] | None = None,
) -> list[tuple[fitz.Rect, str]]:
    clip = clip_rect(rect)
    raw_words = page.get_text("words", clip=clip) if page_words is None else page_words
    entries: list[tuple[fitz.Rect, str]] = []
    for entry in raw_words:
        candidate_rect = word_rect(entry)
        if candidate_rect is None or (clip & candidate_rect).is_empty:
            continue
        token = str(entry[4]).strip().lower() if len(entry) >= 5 else ""
        if not token:
            continue
        entries.append((candidate_rect, token))
    return entries


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


def item_text_span_redaction_rects(item: dict) -> list[fitz.Rect]:
    rects: list[fitz.Rect] = []
    seen: set[tuple[int, int, int, int]] = set()
    for line in item.get("lines", []) or []:
        for span in line.get("spans", []) or []:
            if str(span.get("type", "")).strip() != "text":
                continue
            bbox = span.get("bbox", [])
            content = str(span.get("content", "")).strip()
            if len(bbox) != 4 or not content:
                continue
            rect = expand_word_rect(fitz.Rect(bbox))
            key = rect_key(rect)
            if key in seen:
                continue
            seen.add(key)
            rects.append(rect)
    return rects


def item_line_redaction_rects(item: dict) -> list[fitz.Rect]:
    rects: list[fitz.Rect] = []
    seen: set[tuple[int, int, int, int]] = set()
    for line in item.get("lines", []) or []:
        bbox = line.get("bbox", [])
        if len(bbox) != 4:
            continue
        rect = expand_word_rect(fitz.Rect(bbox))
        key = rect_key(rect)
        if key in seen:
            continue
        seen.add(key)
        rects.append(rect)
    return rects


def item_formula_span_redaction_rects(
    item: dict,
    special_math_rects: list[fitz.Rect],
) -> list[fitz.Rect]:
    if not special_math_rects:
        return []

    rects: list[fitz.Rect] = []
    seen: set[tuple[int, int, int, int]] = set()
    for line in item.get("lines", []) or []:
        for span in line.get("spans", []) or []:
            if str(span.get("type", "")).strip() != "inline_equation":
                continue
            bbox = span.get("bbox", [])
            if len(bbox) != 4:
                continue
            rect = expand_formula_rect(fitz.Rect(bbox))
            if not rect_intersects_protected(rect, special_math_rects):
                continue
            key = rect_key(rect)
            if key in seen:
                continue
            seen.add(key)
            rects.append(rect)
    return rects


def collect_page_drawing_rects(page: fitz.Page) -> list[fitz.Rect]:
    try:
        drawings = page.get_cdrawings() if hasattr(page, "get_cdrawings") else page.get_drawings()
    except Exception:
        return []

    rects: list[fitz.Rect] = []
    for drawing in drawings:
        rect = drawing.get("rect")
        if not rect:
            continue
        try:
            draw_rect = fitz.Rect(rect)
        except Exception:
            continue
        if draw_rect.is_empty:
            continue
        rects.append(draw_rect)
    return rects


def item_vector_overlap_stats(rect: fitz.Rect, drawing_rects: list[fitz.Rect]) -> tuple[int, float]:
    if not drawing_rects or rect.is_empty:
        return 0, 0.0

    clip = clip_rect(rect)
    overlap_count = 0
    overlap_area = 0.0
    for draw_rect in drawing_rects:
        inter = clip & draw_rect
        if inter.is_empty:
            continue
        overlap_count += 1
        overlap_area += rect_area(inter)
    rect_area_value = max(rect_area(clip), 1.0)
    return overlap_count, overlap_area / rect_area_value


def page_should_use_cover_only(drawing_rects: list[fitz.Rect]) -> bool:
    return len(drawing_rects) >= HEAVY_VECTOR_PAGE_DRAWINGS_THRESHOLD


def item_should_use_cover_only(rect: fitz.Rect, drawing_rects: list[fitz.Rect]) -> bool:
    overlap_count, overlap_ratio = item_vector_overlap_stats(rect, drawing_rects)
    return (
        overlap_count >= LOCAL_VECTOR_ITEM_DRAWINGS_THRESHOLD
        or overlap_ratio >= LOCAL_VECTOR_ITEM_AREA_RATIO_THRESHOLD
    )


def item_has_formula(item: dict) -> bool:
    return bool(get_item_formula_map(item))


def item_has_removable_text(
    page: fitz.Page,
    item: dict,
    rect: fitz.Rect,
    page_words: list[tuple] | None = None,
) -> bool:
    return bool(item_removable_text_rects(page, item, rect, page_words=page_words))


def item_removable_text_rects(
    page: fitz.Page,
    item: dict,
    rect: fitz.Rect,
    page_words: list[tuple] | None = None,
    special_math_rects: list[fitz.Rect] | None = None,
) -> list[fitz.Rect]:
    source_text = (item.get("source_text") or item.get("protected_source_text") or "").strip()
    has_formula = item_has_formula(item)
    formula_safe_rects = item_line_redaction_rects(item) if has_formula else []
    formula_span_rects = item_formula_span_redaction_rects(item, special_math_rects or []) if has_formula else []
    if not source_text:
        return []

    word_entries = extract_item_word_entries(page, rect, page_words=page_words)
    if not word_entries:
        return []

    pdf_words: list[str] = []
    for _rect, token in word_entries:
        pdf_words.extend(normalize_words(token))
    if not pdf_words:
        return []

    source_words = normalize_words(source_text)
    if not source_words:
        if len(pdf_words) < 2:
            return []
        return formula_safe_rects if formula_safe_rects else word_entries_to_redaction_rects(word_entries)

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
    if formula_safe_rects or formula_span_rects:
        return merge_dedup_rects(formula_safe_rects, formula_span_rects)
    return word_entries_to_redaction_rects(word_entries)
