from __future__ import annotations

import fitz

from services.rendering.redaction.redaction_config import HEAVY_VECTOR_PAGE_DRAWINGS_THRESHOLD
from services.rendering.redaction.redaction_config import LOCAL_VECTOR_ITEM_AREA_RATIO_THRESHOLD
from services.rendering.redaction.redaction_config import LOCAL_VECTOR_ITEM_DRAWINGS_THRESHOLD
from services.rendering.redaction.redaction_config import VECTOR_HEAVY_PAGE_DRAWINGS_THRESHOLD
from services.rendering.redaction.redaction_geometry import clip_rect
from services.rendering.redaction.redaction_geometry import rect_area


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


def item_should_use_cover_only(rect: fitz.Rect, drawing_rects: list[fitz.Rect]) -> bool:
    overlap_count, overlap_ratio = item_vector_overlap_stats(rect, drawing_rects)
    return (
        overlap_count >= LOCAL_VECTOR_ITEM_DRAWINGS_THRESHOLD
        or overlap_ratio >= LOCAL_VECTOR_ITEM_AREA_RATIO_THRESHOLD
    )
