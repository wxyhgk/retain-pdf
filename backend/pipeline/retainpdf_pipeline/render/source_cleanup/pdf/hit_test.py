from __future__ import annotations

from bisect import bisect_right
from dataclasses import dataclass
from typing import Iterable


RectTuple = tuple[float, float, float, float]
MIN_PROTECTED_OVERLAP_AREA_PT2 = 1.0
MIN_PROTECTED_OVERLAP_TEXT_RATIO = 0.15
MIN_PROTECTED_OVERLAP_HEIGHT_RATIO = 0.2


@dataclass(frozen=True)
class RectIndex:
    rects: tuple[RectTuple, ...]
    y0_sorted: tuple[float, ...]
    bounds: RectTuple | None = None

    @classmethod
    def build(cls, rects: Iterable[object]) -> "RectIndex":
        normalized = tuple(sorted((_rect_tuple(rect) for rect in rects), key=lambda rect: rect[1]))
        normalized = tuple(rect for rect in normalized if rect[0] < rect[2] and rect[1] < rect[3])
        if not normalized:
            return cls(rects=(), y0_sorted=(), bounds=None)
        return cls(
            rects=normalized,
            y0_sorted=tuple(rect[1] for rect in normalized),
            bounds=(
                min(rect[0] for rect in normalized),
                min(rect[1] for rect in normalized),
                max(rect[2] for rect in normalized),
                max(rect[3] for rect in normalized),
            ),
        )

    def contains_point(self, x: float, y: float) -> bool:
        if self.bounds is None or not _point_in_rect(x, y, self.bounds):
            return False
        limit = bisect_right(self.y0_sorted, y)
        for index in range(limit):
            rect = self.rects[index]
            if rect[3] < y:
                continue
            if _point_in_rect(x, y, rect):
                return True
        return False

    def intersects(self, rect: RectTuple) -> bool:
        if self.bounds is None or not _rect_intersects(rect, self.bounds):
            return False
        limit = bisect_right(self.y0_sorted, rect[3])
        for index in range(limit):
            candidate = self.rects[index]
            if candidate[3] < rect[1]:
                continue
            if _rect_intersects(rect, candidate):
                return True
        return False

    def contains_point_or_intersects(self, x: float, y: float, rect: RectTuple) -> bool:
        if self.bounds is None:
            return False
        point_may_match = _point_in_rect(x, y, self.bounds)
        rect_may_match = _rect_intersects(rect, self.bounds)
        if not point_may_match and not rect_may_match:
            return False
        limit = bisect_right(self.y0_sorted, max(y, rect[3]))
        for index in range(limit):
            candidate = self.rects[index]
            if point_may_match and candidate[3] >= y and _point_in_rect(x, y, candidate):
                return True
            if rect_may_match and candidate[3] >= rect[1] and _rect_intersects(rect, candidate):
                return True
        return False

    def matches_text_for_removal(self, x: float, y: float, rect: RectTuple) -> bool:
        if self.bounds is None:
            return False
        point_may_match = _point_in_rect(x, y, self.bounds)
        rect_may_match = _rect_intersects(rect, self.bounds)
        if not point_may_match and not rect_may_match:
            return False
        limit = bisect_right(self.y0_sorted, max(y, rect[3]))
        for index in range(limit):
            candidate = self.rects[index]
            if candidate[3] < min(y, rect[1]):
                continue
            if point_may_match and _point_in_rect(x, y, candidate):
                return True
            if rect_may_match and _rect_substantially_overlaps_text(rect, candidate):
                return True
        return False

    def protects_text_rect(self, x: float, y: float, rect: RectTuple) -> bool:
        if self.bounds is None:
            return False
        point_may_match = _point_in_rect(x, y, self.bounds)
        rect_may_match = _rect_intersects(rect, self.bounds)
        if not point_may_match and not rect_may_match:
            return False
        limit = bisect_right(self.y0_sorted, max(y, rect[3]))
        return any(
            _point_in_rect(x, y, candidate)
            or _rect_substantially_overlaps_text(rect, candidate)
            for candidate in self.rects[:limit]
            if candidate[3] >= min(y, rect[1])
        )


def inside_any_rect(x: float, y: float, rects: list[object]) -> bool:
    return RectIndex.build(rects).contains_point(x, y)


def intersects_any_rect(rect: object, rects: list[object]) -> bool:
    return RectIndex.build(rects).intersects(_rect_tuple(rect))


def is_protected_text_op(
    *,
    user_point: tuple[float, float],
    text_rect: RectTuple,
    protected_rects: list[object] | None = None,
    protected_index: RectIndex | None = None,
) -> bool:
    index = protected_index or RectIndex.build(protected_rects or [])
    if not index.rects:
        return False
    return index.protects_text_rect(user_point[0], user_point[1], text_rect)


def _rect_tuple(rect: object) -> RectTuple:
    if isinstance(rect, tuple) and len(rect) == 4:
        return (float(rect[0]), float(rect[1]), float(rect[2]), float(rect[3]))
    return (
        float(getattr(rect, "x0")),
        float(getattr(rect, "y0")),
        float(getattr(rect, "x1")),
        float(getattr(rect, "y1")),
    )


def _point_in_rect(x: float, y: float, rect: RectTuple) -> bool:
    return rect[0] <= x <= rect[2] and rect[1] <= y <= rect[3]


def _rect_intersects(left: RectTuple, right: RectTuple) -> bool:
    return left[0] < right[2] and left[2] > right[0] and left[1] < right[3] and left[3] > right[1]


def _rect_substantially_overlaps_text(text_rect: RectTuple, protected_rect: RectTuple) -> bool:
    overlap = _rect_intersection(text_rect, protected_rect)
    overlap_area = _rect_area(overlap)
    if overlap_area < MIN_PROTECTED_OVERLAP_AREA_PT2:
        return False
    text_area = max(_rect_area(text_rect), 0.001)
    overlap_height = max(0.0, overlap[3] - overlap[1])
    text_height = max(text_rect[3] - text_rect[1], 0.001)
    return (
        overlap_area / text_area >= MIN_PROTECTED_OVERLAP_TEXT_RATIO
        and overlap_height / text_height >= MIN_PROTECTED_OVERLAP_HEIGHT_RATIO
    )


def _rect_intersection(left: RectTuple, right: RectTuple) -> RectTuple:
    return (
        max(left[0], right[0]),
        max(left[1], right[1]),
        min(left[2], right[2]),
        min(left[3], right[3]),
    )


def _rect_area(rect: RectTuple) -> float:
    return max(0.0, rect[2] - rect[0]) * max(0.0, rect[3] - rect[1])


__all__ = [
    "RectIndex",
    "RectTuple",
    "inside_any_rect",
    "intersects_any_rect",
    "is_protected_text_op",
]
