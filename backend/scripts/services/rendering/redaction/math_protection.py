from __future__ import annotations

import fitz

from services.rendering.redaction.redaction_config import MATH_INTRUSIVE_HEIGHT_RATIO
from services.rendering.redaction.redaction_config import MATH_INTRUSIVE_OVERLAP_AREA_MIN
from services.rendering.redaction.redaction_config import SPECIAL_MATH_FONT_MARKERS
from services.rendering.redaction.redaction_geometry import rect_area
from services.rendering.redaction.redaction_geometry import rect_key


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
