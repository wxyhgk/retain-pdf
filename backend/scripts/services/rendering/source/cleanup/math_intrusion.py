from __future__ import annotations

import fitz

from services.rendering.source.cleanup.config import MATH_INTRUSIVE_HEIGHT_RATIO
from services.rendering.source.cleanup.config import MATH_INTRUSIVE_OVERLAP_AREA_MIN
from services.rendering.source.rects import rect_area


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
