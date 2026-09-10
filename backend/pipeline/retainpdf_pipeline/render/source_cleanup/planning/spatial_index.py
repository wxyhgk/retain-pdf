from __future__ import annotations

from bisect import bisect_right
from dataclasses import dataclass
from typing import Iterable

import fitz

from retainpdf_pipeline.render.source.rects import rect_area


@dataclass(frozen=True)
class RectOverlapIndex:
    rects: tuple[fitz.Rect, ...]
    y0_sorted: tuple[float, ...]

    @classmethod
    def build(cls, rects: Iterable[fitz.Rect]) -> "RectOverlapIndex":
        ordered = tuple(sorted((rect for rect in rects if not rect.is_empty), key=lambda rect: rect.y0))
        return cls(rects=ordered, y0_sorted=tuple(float(rect.y0) for rect in ordered))

    def overlaps_any(self, target_rect: fitz.Rect, *, min_overlap_area: float = 0.0) -> bool:
        if target_rect.is_empty or not self.rects:
            return False
        limit = bisect_right(self.y0_sorted, float(target_rect.y1))
        for index in range(limit):
            rect = self.rects[index]
            if rect.y1 < target_rect.y0:
                continue
            if rect.x1 < target_rect.x0 or rect.x0 > target_rect.x1:
                continue
            if rect_area(rect & target_rect) > min_overlap_area:
                return True
        return False
