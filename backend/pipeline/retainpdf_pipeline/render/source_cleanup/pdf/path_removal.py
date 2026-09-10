from __future__ import annotations

from dataclasses import dataclass

import fitz

from retainpdf_pipeline.render.source_cleanup.pdf.hit_test import RectIndex
from retainpdf_pipeline.render.source_cleanup.pdf.hit_test import RectTuple
from retainpdf_pipeline.render.source_cleanup.pdf.pdf_math import PdfMatrix
from retainpdf_pipeline.render.source_cleanup.pdf.pdf_math import to_float
from retainpdf_pipeline.render.source_cleanup.pdf.pdf_math import transform_point
from retainpdf_pipeline.render.source_cleanup.planning.drawing_classifier import rect_is_text_like_fill_path


PATH_CONSTRUCTION_OPERATORS = frozenset({"m", "l", "c", "v", "y", "h", "re"})
PATH_PAINT_OPERATORS = frozenset({"f", "F", "f*", "B", "B*", "b", "b*", "S", "s", "n"})
TEXT_LIKE_PATH_PAINT_OPERATORS = frozenset({"f", "F", "f*"})


@dataclass(frozen=True)
class PathPaintRewriteDecision:
    remove: bool
    rect: RectTuple | None


@dataclass
class PathTracker:
    points: list[tuple[float, float]]

    @classmethod
    def empty(cls) -> "PathTracker":
        return cls(points=[])

    def clear(self) -> None:
        self.points.clear()

    def record(self, op: str, operands: object, ctm: PdfMatrix) -> None:
        if op == "h":
            return
        if op == "re":
            self._record_rect(operands, ctm)
            return
        for x, y in _operator_points(op, operands):
            self.points.append(transform_point(ctm, x, y))

    def rect(self) -> RectTuple | None:
        if not self.points:
            return None
        xs = [point[0] for point in self.points]
        ys = [point[1] for point in self.points]
        return (min(xs), min(ys), max(xs), max(ys))

    def _record_rect(self, operands: object, ctm: PdfMatrix) -> None:
        if len(operands) < 4:
            return
        x = to_float(operands[0])
        y = to_float(operands[1])
        width = to_float(operands[2])
        height = to_float(operands[3])
        for px, py in (
            (x, y),
            (x + width, y),
            (x + width, y + height),
            (x, y + height),
        ):
            self.points.append(transform_point(ctm, px, py))


def decide_path_paint_rewrite(
    *,
    op: str,
    path_rect: RectTuple | None,
    strip_index: RectIndex,
    protected_index: RectIndex,
) -> PathPaintRewriteDecision:
    if op not in TEXT_LIKE_PATH_PAINT_OPERATORS or path_rect is None:
        return PathPaintRewriteDecision(remove=False, rect=path_rect)
    if not rect_is_text_like_fill_path(fitz.Rect(path_rect)):
        return PathPaintRewriteDecision(remove=False, rect=path_rect)
    remove = strip_index.intersects(path_rect) and not protected_index.intersects(path_rect)
    return PathPaintRewriteDecision(remove=remove, rect=path_rect)


def _operator_points(op: str, operands: object) -> tuple[tuple[float, float], ...]:
    if op in {"m", "l"} and len(operands) >= 2:
        return ((to_float(operands[0]), to_float(operands[1])),)
    if op == "c" and len(operands) >= 6:
        return (
            (to_float(operands[0]), to_float(operands[1])),
            (to_float(operands[2]), to_float(operands[3])),
            (to_float(operands[4]), to_float(operands[5])),
        )
    if op == "v" and len(operands) >= 4:
        return (
            (to_float(operands[0]), to_float(operands[1])),
            (to_float(operands[2]), to_float(operands[3])),
        )
    if op == "y" and len(operands) >= 4:
        return (
            (to_float(operands[0]), to_float(operands[1])),
            (to_float(operands[2]), to_float(operands[3])),
        )
    return ()


__all__ = [
    "PATH_CONSTRUCTION_OPERATORS",
    "PATH_PAINT_OPERATORS",
    "PathTracker",
    "decide_path_paint_rewrite",
]
