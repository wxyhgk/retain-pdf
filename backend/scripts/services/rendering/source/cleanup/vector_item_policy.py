from __future__ import annotations

import fitz

from services.rendering.source.cleanup.config import LOCAL_VECTOR_ITEM_AREA_RATIO_THRESHOLD
from services.rendering.source.cleanup.config import LOCAL_VECTOR_ITEM_DRAWINGS_THRESHOLD
from services.rendering.source.cleanup.vector_overlap import item_vector_overlap_stats


def item_should_use_cover_only(rect: fitz.Rect, drawing_rects: list[fitz.Rect]) -> bool:
    overlap_count, overlap_ratio = item_vector_overlap_stats(rect, drawing_rects)
    return (
        overlap_count >= LOCAL_VECTOR_ITEM_DRAWINGS_THRESHOLD
        or overlap_ratio >= LOCAL_VECTOR_ITEM_AREA_RATIO_THRESHOLD
    )
