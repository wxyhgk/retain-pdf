from __future__ import annotations

import fitz

from retainpdf_pipeline.render.source.rects import rect_area
from retainpdf_pipeline.render.source_cleanup.planning.drawing_classifier import unsafe_text_strip_drawing_rects
from retainpdf_pipeline.render.source_cleanup.planning.spatial_index import RectOverlapIndex


MIN_UNSAFE_VECTOR_OVERLAP_AREA_PT2 = 0.5


def keep_rects_without_unsafe_vector_overlap(page: fitz.Page, rects: list[fitz.Rect]) -> list[fitz.Rect]:
    unsafe_index = RectOverlapIndex.build(unsafe_text_strip_drawing_rects(page))
    if not unsafe_index.rects:
        return rects
    return [rect for rect in rects if not rect_overlaps_any_unsafe_vector(rect, unsafe_index)]


def has_unsafe_vector_overlap(page: fitz.Page, view_rect: fitz.Rect) -> bool:
    return rect_overlaps_any_unsafe_vector(view_rect, RectOverlapIndex.build(unsafe_text_strip_drawing_rects(page)))


def rect_overlaps_any_unsafe_vector(rect: fitz.Rect, unsafe_rects: RectOverlapIndex | list[fitz.Rect]) -> bool:
    if isinstance(unsafe_rects, RectOverlapIndex):
        return unsafe_rects.overlaps_any(rect, min_overlap_area=MIN_UNSAFE_VECTOR_OVERLAP_AREA_PT2)
    return any(rect_overlap_area(rect, unsafe_rect) > MIN_UNSAFE_VECTOR_OVERLAP_AREA_PT2 for unsafe_rect in unsafe_rects)


def rect_overlap_area(left: fitz.Rect, right: fitz.Rect) -> float:
    return rect_area(left & right)
