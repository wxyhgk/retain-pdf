from __future__ import annotations

import fitz

from services.rendering.source.rects import clip_rect
from services.rendering.source.rects import rect_area


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
