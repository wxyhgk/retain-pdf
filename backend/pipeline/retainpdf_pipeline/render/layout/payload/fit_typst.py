from __future__ import annotations

from retainpdf_pipeline.render.layout.payload.fit_typst_bounds import resolve_fit_height_pt
from retainpdf_pipeline.render.layout.payload.fit_typst_bounds import resolve_min_font_size_pt
from retainpdf_pipeline.render.layout.payload.fit_typst_bounds import resolve_min_leading_em
from retainpdf_pipeline.render.layout.payload.fit_typst_context import build_typst_fit_context
from retainpdf_pipeline.render.layout.payload.fit_typst_context import should_apply_typst_fit


def resolve_typst_binary_fit(
    item: dict,
    protected_text: str,
    formula_map: list[dict],
    font_size_pt: float,
    leading_em: float,
    *,
    page_body_font_size_pt: float | None = None,
    prefer_typst_fit: bool = False,
    adjacent_collision_risk: bool = False,
    adjacent_available_height_pt: float | None = None,
) -> tuple[bool, float, float, float]:
    context = build_typst_fit_context(
        item,
        protected_text,
        formula_map,
        font_size_pt,
        leading_em,
        adjacent_collision_risk=adjacent_collision_risk,
        adjacent_available_height_pt=adjacent_available_height_pt,
    )
    if context is None:
        return False, 0.0, 0.0, 0.0

    if not should_apply_typst_fit(
        context,
        prefer_typst_fit=prefer_typst_fit,
        adjacent_collision_risk=adjacent_collision_risk,
    ):
        return False, 0.0, 0.0, 0.0

    fit_height_pt = resolve_fit_height_pt(
        context,
        adjacent_collision_risk=adjacent_collision_risk,
        adjacent_available_height_pt=adjacent_available_height_pt,
    )
    min_font = resolve_min_font_size_pt(
        context,
        font_size_pt=font_size_pt,
        page_body_font_size_pt=page_body_font_size_pt,
    )
    min_leading = resolve_min_leading_em(context, leading_em=leading_em)
    return True, round(min_font, 2), round(min_leading, 2), round(fit_height_pt, 2)
