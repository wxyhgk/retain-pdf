from __future__ import annotations

import fitz

from retainpdf_pipeline.render.source_cleanup.pdf.constants import BBOX_TEXT_STRIP_FORMULA_GUARD_PAD_X_PT
from retainpdf_pipeline.render.source_cleanup.pdf.constants import BBOX_TEXT_STRIP_FORMULA_GUARD_PAD_Y_PT
from retainpdf_pipeline.render.source_cleanup.planning.coordinate_resolver import raw_bbox_rect
from retainpdf_pipeline.render.source_cleanup.planning.coordinate_resolver import resolve_bbox_rect
from retainpdf_pipeline.render.source_cleanup.planning.coordinate_resolver import to_float
from retainpdf_pipeline.render.source_cleanup.planning.segments import split_rect_around_guards


def rect_tuple(rect: fitz.Rect) -> tuple[float, float, float, float]:
    return (round(float(rect.x0), 3), round(float(rect.y0), 3), round(float(rect.x1), 3), round(float(rect.y1), 3))


def ocr_bbox_to_pdf_rect(page: fitz.Page, bbox: object) -> fitz.Rect | None:
    rect = raw_bbox_rect(bbox)
    if rect is None:
        return None
    pdf_rect = rect * ~page.transformation_matrix
    return None if pdf_rect.is_empty else pdf_rect


def ocr_bbox_to_view_rect(page: fitz.Page, bbox: object) -> fitz.Rect | None:
    return resolve_bbox_rect(page, bbox)


def formula_guard_rects(
    formula_rects: list[fitz.Rect],
    *,
    strip_rects: list[fitz.Rect] | None = None,
) -> list[fitz.Rect]:
    return [bbox_text_strip_formula_guard_rect(rect) for rect in formula_rects if not rect.is_empty]


def split_rect_away_from_formulas(rect: fitz.Rect, formula_rects: list[fitz.Rect]) -> list[fitz.Rect]:
    guards = [bbox_text_strip_formula_guard_rect(formula) for formula in formula_rects]
    return split_rect_around_guards(rect, guards)


def bbox_text_strip_formula_guard_rect(formula: fitz.Rect) -> fitz.Rect:
    return fitz.Rect(
        formula.x0 - BBOX_TEXT_STRIP_FORMULA_GUARD_PAD_X_PT,
        formula.y0 - BBOX_TEXT_STRIP_FORMULA_GUARD_PAD_Y_PT,
        formula.x1 + BBOX_TEXT_STRIP_FORMULA_GUARD_PAD_X_PT,
        formula.y1 + BBOX_TEXT_STRIP_FORMULA_GUARD_PAD_Y_PT,
    )


def shrink_rect_away_from_formulas(rect: fitz.Rect, formula_rects: list[fitz.Rect]) -> fitz.Rect:
    protected_segments = split_rect_away_from_formulas(rect, formula_rects)
    if not protected_segments:
        return fitz.Rect()
    if len(protected_segments) == 1:
        return protected_segments[0]
    largest = max(protected_segments, key=lambda segment: segment.width * segment.height)
    return largest
