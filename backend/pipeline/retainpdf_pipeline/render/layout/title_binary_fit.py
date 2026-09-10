from __future__ import annotations

from dataclasses import dataclass

from retainpdf_pipeline.render.layout.font_roles import is_title_like_block
from retainpdf_pipeline.render.layout.inline_content.core.markdown import build_plain_text_from_text
from retainpdf_pipeline.render.layout.payload.capacity import estimated_render_height_pt
from retainpdf_pipeline.render.layout.payload.capacity import estimated_required_lines
from retainpdf_pipeline.render.layout.payload.capacity import text_demand_units
from retainpdf_pipeline.render.layout.payload.fit_common import fit_inner_bbox
from retainpdf_pipeline.render.semantics.item_view import layout_role
from retainpdf_pipeline.render.semantics.item_view import structure_role


TITLE_FIT_WIDTH_SAFETY = 0.92
TITLE_FIT_HEIGHT_SAFETY = 0.94
TITLE_FIT_MIN_FONT_SIZE_PT = 5.2
TITLE_FIT_EPS_PT = 0.03
TITLE_FIT_ITERATIONS = 18


@dataclass(frozen=True)
class TitleFitDecision:
    font_size_pt: float
    leading_em: float
    fit_to_box: bool
    fit_single_line: bool
    fit_min_font_size_pt: float
    fit_max_font_size_pt: float
    fit_min_leading_em: float
    fit_max_height_pt: float
    fit_target_width_pt: float
    fit_target_height_pt: float


def _title_kind(item: dict) -> str:
    role = layout_role(item) or structure_role(item)
    return "title" if role == "title" else "heading"


def _title_leading_em(kind: str, font_size_pt: float, base_font_size_pt: float) -> float:
    if kind == "title":
        base = 0.28
        if font_size_pt < base_font_size_pt * 0.88:
            base = 0.34
        if font_size_pt < 8.0:
            base = 0.4
    else:
        base = 0.34
        if font_size_pt < base_font_size_pt * 0.88:
            base = 0.4
        if font_size_pt < 8.0:
            base = 0.46
    return round(base, 2)


def _single_line_width_fits(inner: list[float], protected_text: str, formula_map: list[dict], font_size_pt: float) -> bool:
    if len(inner) != 4:
        return False
    width_pt = max(1.0, inner[2] - inner[0])
    demand = text_demand_units(protected_text, formula_map)
    return demand * font_size_pt <= width_pt * TITLE_FIT_WIDTH_SAFETY


def _fits_title_box(
    inner: list[float],
    protected_text: str,
    formula_map: list[dict],
    *,
    kind: str,
    base_font_size_pt: float,
    font_size_pt: float,
) -> bool:
    if len(inner) != 4 or font_size_pt <= 0:
        return False
    width_pt = max(1.0, inner[2] - inner[0]) * TITLE_FIT_WIDTH_SAFETY
    height_pt = max(1.0, inner[3] - inner[1]) * TITLE_FIT_HEIGHT_SAFETY
    if width_pt <= 0 or height_pt <= 0:
        return False
    leading_em = _title_leading_em(kind, font_size_pt, base_font_size_pt)
    estimated_height = estimated_render_height_pt(
        [inner[0], inner[1], inner[0] + width_pt, inner[1] + height_pt],
        protected_text,
        formula_map,
        font_size_pt,
        leading_em,
    )
    return estimated_height <= height_pt


def solve_title_fit(
    item: dict,
    protected_text: str,
    formula_map: list[dict],
    *,
    base_font_size_pt: float,
    base_leading_em: float,
    max_font_size_pt: float,
) -> TitleFitDecision | None:
    if not is_title_like_block(item) or not protected_text:
        return None
    inner = fit_inner_bbox(item)
    if len(inner) != 4:
        return None

    width_pt = max(8.0, inner[2] - inner[0])
    height_pt = max(8.0, inner[3] - inner[1])
    kind = _title_kind(item)
    plain_text = build_plain_text_from_text(protected_text)
    text_len = len(plain_text)
    max_size = max(1.0, max_font_size_pt or base_font_size_pt)
    low = max(1.0, min(TITLE_FIT_MIN_FONT_SIZE_PT, base_font_size_pt, max_size))
    high = max(low, max_size)
    best = low

    if _fits_title_box(
        inner,
        protected_text,
        formula_map,
        kind=kind,
        base_font_size_pt=base_font_size_pt,
        font_size_pt=high,
    ):
        best = high
    else:
        for _ in range(TITLE_FIT_ITERATIONS):
            mid = low + (high - low) / 2.0
            if _fits_title_box(
                inner,
                protected_text,
                formula_map,
                kind=kind,
                base_font_size_pt=base_font_size_pt,
                font_size_pt=mid,
            ):
                best = mid
                low = mid
            else:
                high = mid
            if high - low <= TITLE_FIT_EPS_PT:
                break

    font_size_pt = round(max(1.0, best), 2)
    leading_em = _title_leading_em(kind, font_size_pt, base_font_size_pt)
    required_lines = estimated_required_lines(inner, protected_text, formula_map, font_size_pt)
    single_line = required_lines <= 1 and text_len <= 42 and _single_line_width_fits(inner, protected_text, formula_map, font_size_pt)
    shrink_pressure = font_size_pt < base_font_size_pt - 0.08 or required_lines > 1
    fit_min_font = max(1.0, min(font_size_pt, base_font_size_pt, font_size_pt * (0.72 if kind == "title" else 0.78)))
    fit_min_leading = max(0.16, min(leading_em, base_leading_em, leading_em - (0.08 if shrink_pressure else 0.0)))

    return TitleFitDecision(
        font_size_pt=font_size_pt,
        leading_em=leading_em,
        fit_to_box=True,
        fit_single_line=single_line,
        fit_min_font_size_pt=round(fit_min_font, 2),
        fit_max_font_size_pt=round(max(font_size_pt, max_size), 2),
        fit_min_leading_em=round(fit_min_leading, 2),
        fit_max_height_pt=round(height_pt, 2),
        fit_target_width_pt=round(width_pt, 2),
        fit_target_height_pt=round(height_pt, 2),
    )


__all__ = [
    "TITLE_FIT_HEIGHT_SAFETY",
    "TITLE_FIT_MIN_FONT_SIZE_PT",
    "TITLE_FIT_WIDTH_SAFETY",
    "TitleFitDecision",
    "solve_title_fit",
]
