from __future__ import annotations

import fitz

from services.rendering.source.cleanup.math_fonts import is_special_math_font
from services.rendering.source.rects import rect_key


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
