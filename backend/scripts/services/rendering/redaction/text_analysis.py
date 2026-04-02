from __future__ import annotations

import fitz

from services.rendering.redaction.redaction_geometry import clip_rect
from services.rendering.redaction.redaction_geometry import expand_item_rect
from services.rendering.redaction.redaction_geometry import expand_word_rect
from services.rendering.redaction.redaction_geometry import rect_area
from services.rendering.redaction.redaction_geometry import rect_key
from services.rendering.redaction.shared import get_item_formula_map
from services.rendering.redaction.shared import normalize_words

DISPLAY_INTRUSIVE_HEIGHT_RATIO = 3.0
DISPLAY_INTRUSIVE_OVERLAP_AREA_MIN = 6.0
DISPLAY_INTRUSIVE_MAX_TEXT_LEN = 2


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


def extract_page_text_blocks(page: fitz.Page) -> list[tuple[fitz.Rect, str]]:
    try:
        raw_blocks = page.get_text("blocks")
    except Exception:
        return []
    blocks: list[tuple[fitz.Rect, str]] = []
    for entry in raw_blocks:
        if len(entry) < 7:
            continue
        try:
            rect = fitz.Rect(entry[:4])
        except Exception:
            continue
        block_type = entry[6]
        if block_type != 0 or rect.is_empty:
            continue
        text = str(entry[4] or "").strip()
        if not text:
            continue
        blocks.append((rect, text))
    return blocks


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


def rect_contains_point(rect: fitz.Rect, x: float, y: float) -> bool:
    return rect.x0 <= x <= rect.x1 and rect.y0 <= y <= rect.y1


def rect_center(rect: fitz.Rect) -> tuple[float, float]:
    return ((rect.x0 + rect.x1) / 2.0, (rect.y0 + rect.y1) / 2.0)


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
    current_center = rect_center(rect)
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


def rects_overlap_area(a: fitz.Rect, b: fitz.Rect) -> float:
    inter = a & b
    if inter.is_empty:
        return 0.0
    return rect_area(inter)


def rect_intersects_intrusive_display_text(rect: fitz.Rect, intrusive_rects: list[fitz.Rect]) -> bool:
    for intrusive_rect in intrusive_rects:
        if rects_overlap_area(rect, intrusive_rect) >= DISPLAY_INTRUSIVE_OVERLAP_AREA_MIN:
            return True
    return False


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
    competing_rects: list[fitz.Rect] | None = None,
) -> list[fitz.Rect]:
    del special_math_rects
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
            return matched_block_rects

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
        return item_bbox_redaction_rect(rect)

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
    return word_entries_to_redaction_rects(word_entries)
