from __future__ import annotations

from dataclasses import dataclass

from retainpdf_pipeline.render.layout.payload.capacity import box_capacity_units
from retainpdf_pipeline.render.layout.payload.capacity import estimated_render_height_pt
from retainpdf_pipeline.render.layout.payload.capacity import text_demand_units
from retainpdf_pipeline.render.layout.payload.fit_common import TYPST_BINARY_COLLISION_OVERFLOW_TRIGGER
from retainpdf_pipeline.render.layout.payload.fit_common import TYPST_BINARY_DEMAND_TRIGGER
from retainpdf_pipeline.render.layout.payload.fit_common import TYPST_BINARY_DENSE_LAYOUT_TRIGGER
from retainpdf_pipeline.render.layout.payload.fit_common import TYPST_BINARY_FORMULA_OVERFLOW_TRIGGER
from retainpdf_pipeline.render.layout.payload.fit_common import TYPST_BINARY_FORMULA_RATIO_TRIGGER
from retainpdf_pipeline.render.layout.payload.fit_common import TYPST_BINARY_OVERFLOW_TRIGGER
from retainpdf_pipeline.render.layout.payload.fit_common import TYPST_BINARY_SOURCE_HEIGHT_TRIGGER
from retainpdf_pipeline.render.layout.payload.fit_common import fit_inner_bbox
from retainpdf_pipeline.render.layout.payload.shared import layout_density_ratio
from retainpdf_pipeline.render.layout.typography.measurement import formula_ratio
from retainpdf_pipeline.render.layout.typography.measurement import source_text_height_limit_pt
from retainpdf_pipeline.render.layout.typography.measurement import visual_line_count


@dataclass(frozen=True)
class TypstFitContext:
    inner: list[float]
    container_height_pt: float
    effective_container_height_pt: float
    source_height_limit_pt: float
    estimated_height_pt: float
    overflow_ratio: float
    source_overflow_ratio: float
    adjacent_overflow_ratio: float
    effective_overflow_ratio: float
    demand_ratio: float
    layout_density: float
    formula_weight: float
    dense_small_box: bool
    heavy_dense_small_box: bool
    is_body: bool
    inherited_font_floor: float


def build_typst_fit_context(
    item: dict,
    protected_text: str,
    formula_map: list[dict],
    font_size_pt: float,
    leading_em: float,
    *,
    adjacent_collision_risk: bool,
    adjacent_available_height_pt: float | None,
) -> TypstFitContext | None:
    inner = fit_inner_bbox(item)
    if len(inner) != 4:
        return None

    container_height_pt = max(8.0, inner[3] - inner[1])
    relaxed_fit_height = float(item.get("_relaxed_fit_height_pt") or 0.0)
    effective_container_height_pt = max(container_height_pt, relaxed_fit_height)
    raw_source_height_limit = source_text_height_limit_pt(item)
    if relaxed_fit_height > container_height_pt:
        raw_source_height_limit = max(raw_source_height_limit, relaxed_fit_height)
    source_height_limit = min(effective_container_height_pt, raw_source_height_limit)
    line_step = max(font_size_pt * 1.02, font_size_pt * (1.0 + leading_em))
    demand = text_demand_units(protected_text, formula_map)
    capacity = box_capacity_units(inner, font_size_pt, leading_em, visual_lines=visual_line_count(item))
    estimated_height = estimated_render_height_pt(inner, protected_text, formula_map, font_size_pt, leading_em)
    layout_density = layout_density_ratio(inner, protected_text, font_size_pt=font_size_pt, line_step_pt=line_step)
    overflow_ratio = estimated_height / max(effective_container_height_pt, 1.0)
    source_overflow_ratio = estimated_height / max(source_height_limit, 1.0) if source_height_limit > 0 else 0.0
    adjacent_overflow_ratio = (
        estimated_height / max(adjacent_available_height_pt, 1.0)
        if adjacent_collision_risk and adjacent_available_height_pt and adjacent_available_height_pt > 0
        else 0.0
    )

    return TypstFitContext(
        inner=inner,
        container_height_pt=container_height_pt,
        effective_container_height_pt=effective_container_height_pt,
        source_height_limit_pt=source_height_limit,
        estimated_height_pt=estimated_height,
        overflow_ratio=overflow_ratio,
        source_overflow_ratio=source_overflow_ratio,
        adjacent_overflow_ratio=adjacent_overflow_ratio,
        effective_overflow_ratio=max(overflow_ratio, adjacent_overflow_ratio, source_overflow_ratio),
        demand_ratio=demand / max(capacity, 1.0),
        layout_density=layout_density,
        formula_weight=formula_ratio(item),
        dense_small_box=bool(item.get("_dense_small_box", False)),
        heavy_dense_small_box=bool(item.get("_heavy_dense_small_box", False)),
        is_body=bool(item.get("_is_body_text_candidate", False)),
        inherited_font_floor=float(item.get("_short_body_inherited_font_floor_pt") or 0.0),
    )


def should_apply_typst_fit(
    context: TypstFitContext,
    *,
    prefer_typst_fit: bool,
    adjacent_collision_risk: bool,
) -> bool:
    return (
        prefer_typst_fit
        or context.overflow_ratio >= TYPST_BINARY_OVERFLOW_TRIGGER
        or context.source_overflow_ratio >= TYPST_BINARY_SOURCE_HEIGHT_TRIGGER
        or context.demand_ratio >= TYPST_BINARY_DEMAND_TRIGGER
        or (
            context.is_body
            and context.dense_small_box
            and context.layout_density >= TYPST_BINARY_DENSE_LAYOUT_TRIGGER
        )
        or (
            context.formula_weight >= TYPST_BINARY_FORMULA_RATIO_TRIGGER
            and context.overflow_ratio >= TYPST_BINARY_FORMULA_OVERFLOW_TRIGGER
        )
        or (
            adjacent_collision_risk
            and context.adjacent_overflow_ratio >= TYPST_BINARY_COLLISION_OVERFLOW_TRIGGER
        )
    )
