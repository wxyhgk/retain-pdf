from __future__ import annotations

import fitz


HEAVY_VECTOR_PAGE_DRAWINGS_THRESHOLD = 5000
VECTOR_HEAVY_PAGE_DRAWINGS_THRESHOLD = 2000


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
        draw_rect = _expand_thin_drawing_rect(draw_rect, drawing)
        if draw_rect.is_empty:
            continue
        rects.append(draw_rect)
    return rects


def _expand_thin_drawing_rect(rect: fitz.Rect, drawing: dict) -> fitz.Rect:
    if not rect.is_empty:
        return rect
    stroke_width = _drawing_stroke_width(drawing)
    pad = max(stroke_width / 2.0, 0.5)
    expanded = fitz.Rect(rect)
    if expanded.x0 == expanded.x1:
        expanded.x0 -= pad
        expanded.x1 += pad
    if expanded.y0 == expanded.y1:
        expanded.y0 -= pad
        expanded.y1 += pad
    return expanded


def _drawing_stroke_width(drawing: dict) -> float:
    try:
        return float(drawing.get("width") or 1.0)
    except Exception:
        return 1.0


def page_drawing_count(page: fitz.Page) -> int:
    try:
        drawings = page.get_cdrawings() if hasattr(page, "get_cdrawings") else page.get_drawings()
    except Exception:
        return 0
    return len(drawings)


def page_should_use_cover_only(drawing_rects: list[fitz.Rect]) -> bool:
    return len(drawing_rects) >= HEAVY_VECTOR_PAGE_DRAWINGS_THRESHOLD


def page_is_vector_heavy(drawing_rects: list[fitz.Rect]) -> bool:
    return len(drawing_rects) >= VECTOR_HEAVY_PAGE_DRAWINGS_THRESHOLD


def page_should_use_cover_only_count(drawing_count: int) -> bool:
    return drawing_count >= HEAVY_VECTOR_PAGE_DRAWINGS_THRESHOLD


def page_is_vector_heavy_count(drawing_count: int) -> bool:
    return drawing_count >= VECTOR_HEAVY_PAGE_DRAWINGS_THRESHOLD
