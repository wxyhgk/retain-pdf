from __future__ import annotations

from services.rendering.layout.font_fit import BODY_LEADING_FLOOR_MIN
from services.rendering.layout.font_fit import BODY_LEADING_MAX
from services.rendering.layout.font_fit import BODY_LEADING_MIN
from services.rendering.layout.font_fit import BODY_LEADING_SIZE_ADJUST
from services.rendering.layout.font_fit import NON_BODY_LEADING_FLOOR_MIN
from services.rendering.layout.font_fit import NON_BODY_LEADING_MAX
from services.rendering.layout.font_fit import NON_BODY_LEADING_MIN
from services.rendering.layout.font_fit import NON_BODY_LEADING_SIZE_ADJUST
from services.rendering.layout.font_fit import cover_bbox as resolve_cover_bbox
from services.rendering.layout.font_fit import normalize_leading_em_for_font_size
from services.rendering.layout.font_fit import resolve_font_weight
from services.rendering.layout.font_fit import resolve_title_fill_max_font_size_pt
from services.rendering.layout.font_roles import is_title_like_block
from services.rendering.layout.payload.block_seed_body_policy import adjust_body_seed_font_size
from services.rendering.layout.payload.block_seed_body_policy import is_dense_small_box
from services.rendering.layout.payload.block_seed_body_policy import is_heavy_dense_small_box
from services.rendering.layout.payload.block_seed_body_policy import is_wide_aspect_body_text
from services.rendering.layout.payload.block_seed_body_policy import relax_wide_aspect_body_leading
from services.rendering.layout.payload.block_seed_metrics import PageSeedMetrics
from services.rendering.layout.payload.body_context import page_box_area_ratio as compute_page_box_area_ratio
from services.rendering.layout.payload.metrics import fit_translated_block_metrics
from services.rendering.layout.payload.shared import COMPACT_SCALE
from services.rendering.layout.payload.shared import HEAVY_COMPACT_RATIO
from services.rendering.layout.payload.shared import get_render_formula_map
from services.rendering.layout.payload.shared import get_render_protected_text
from services.rendering.layout.payload.shared import is_flag_like_plain_text_block
from services.rendering.layout.payload.shared import layout_density_ratio
from services.rendering.layout.payload.shared import translation_density_ratio
from services.rendering.layout.payload.render_item import get_render_first_line_indent_pt
from services.rendering.layout.payload.render_item import set_render_inner_bbox
from services.rendering.layout.title_binary_fit import solve_title_fit
from services.rendering.layout.typography.geometry import inner_bbox
from services.rendering.layout.typography.measurement import bbox_height
from services.rendering.layout.typography.measurement import bbox_width


def build_seed_payload_for_item(
    *,
    index: int,
    item: dict,
    metrics: PageSeedMetrics,
    page_width: float | None,
    page_height: float | None,
) -> dict | None:
    translated_text = get_render_protected_text(item)
    bbox = item.get("bbox", [])
    if len(bbox) != 4 or not translated_text:
        return None

    use_raw_text_bbox = bool(item.get("_use_raw_text_bbox"))
    font_size_pt, leading_em = metrics.base_metrics[index]
    formula_map = get_render_formula_map(item)
    title_fit = None
    density_ratio = translation_density_ratio(item, translated_text)
    page_box_area_ratio = compute_page_box_area_ratio(bbox, page_width, page_height)
    raw_inner_bbox = inner_bbox(item)
    item_inner_bbox = metrics.effective_inner_bboxes.get(index, raw_inner_bbox)
    seed_line_step = max(font_size_pt * 1.02, font_size_pt * (1.0 + leading_em))
    layout_density = layout_density_ratio(
        item_inner_bbox,
        translated_text,
        font_size_pt=font_size_pt,
        line_step_pt=seed_line_step,
    )
    dense_small_box = is_dense_small_box(
        density_ratio=density_ratio,
        layout_density=layout_density,
        page_box_area_ratio=page_box_area_ratio,
    )
    heavy_dense_small_box = is_heavy_dense_small_box(
        density_ratio=density_ratio,
        layout_density=layout_density,
        page_box_area_ratio=page_box_area_ratio,
        heavy_compact_ratio=HEAVY_COMPACT_RATIO,
    )
    block_height = bbox_height(item)
    block_width = bbox_width(item)
    body_like_single_line = bool(metrics.body_flags.get(index, False))
    wide_aspect_body_text = is_wide_aspect_body_text(
        is_body=body_like_single_line,
        block_width=block_width,
        block_height=block_height,
    )

    font_size_pt = adjust_body_seed_font_size(
        font_size_pt=font_size_pt,
        page_body_font_size_pt=metrics.page_body_font_size_pt,
        is_body=body_like_single_line,
        dense_small_box=dense_small_box,
        heavy_dense_small_box=heavy_dense_small_box,
        wide_aspect_body_text=wide_aspect_body_text,
    )

    title_like = is_title_like_block(item)
    if title_like:
        title_item = dict(item)
        set_render_inner_bbox(title_item, item_inner_bbox)
        title_fit = solve_title_fit(
            title_item,
            translated_text,
            formula_map,
            base_font_size_pt=font_size_pt,
            base_leading_em=leading_em,
            max_font_size_pt=resolve_title_fill_max_font_size_pt(item, font_size_pt),
        )
        if title_fit is not None:
            font_size_pt = title_fit.font_size_pt
            leading_em = title_fit.leading_em

    if dense_small_box and not metrics.body_flags.get(index) and not title_like:
        font_size_pt = round(font_size_pt * COMPACT_SCALE, 2)
        leading_em = round(leading_em * COMPACT_SCALE, 2)

    if not title_like:
        fit_item = {
            **item,
            "_is_body_text_candidate": body_like_single_line,
            "_page_box_area_ratio": page_box_area_ratio,
            "_dense_small_box": dense_small_box,
            "_heavy_dense_small_box": heavy_dense_small_box,
            "_wide_aspect_body_text": wide_aspect_body_text,
        }
        set_render_inner_bbox(fit_item, item_inner_bbox)
        font_size_pt, leading_em = fit_translated_block_metrics(
            fit_item,
            translated_text,
            formula_map,
            font_size_pt,
            leading_em,
            page_body_font_size_pt=metrics.page_body_font_size_pt if body_like_single_line else None,
        )

    if body_like_single_line and not title_like:
        leading_em = normalize_leading_em_for_font_size(
            font_size_pt,
            leading_em,
            reference_font_size_pt=metrics.page_body_font_size_pt or metrics.page_font_size,
            min_leading_em=BODY_LEADING_MIN,
            max_leading_em=BODY_LEADING_MAX,
            strength=BODY_LEADING_SIZE_ADJUST,
            floor_min_leading_em=BODY_LEADING_FLOOR_MIN,
        )
    elif not title_like:
        leading_em = normalize_leading_em_for_font_size(
            font_size_pt,
            leading_em,
            reference_font_size_pt=metrics.page_font_size,
            min_leading_em=NON_BODY_LEADING_MIN,
            max_leading_em=NON_BODY_LEADING_MAX,
            strength=NON_BODY_LEADING_SIZE_ADJUST,
            floor_min_leading_em=NON_BODY_LEADING_FLOOR_MIN,
        )

    if wide_aspect_body_text:
        leading_em = relax_wide_aspect_body_leading(
            item_inner_bbox,
            translated_text,
            formula_map,
            font_size_pt,
            leading_em,
        )
    item_cover_bbox = resolve_cover_bbox(item)
    return {
        "index": index,
        "item": item,
        "bbox": bbox,
        "cover_bbox": item_cover_bbox,
        "inner_bbox": list(bbox) if use_raw_text_bbox else item_inner_bbox,
        "translated_text": translated_text,
        "formula_map": formula_map,
        "render_kind": "plain_line" if item.get("_force_plain_line") or is_flag_like_plain_text_block(item) else "markdown",
        "font_size_pt": font_size_pt,
        "leading_em": leading_em,
        "first_line_indent_pt": get_render_first_line_indent_pt(item),
        "font_weight": resolve_font_weight(item),
        "page_body_font_size_pt": metrics.page_body_font_size_pt if body_like_single_line else None,
        "is_body": body_like_single_line,
        "page_box_area_ratio": page_box_area_ratio,
        "dense_small_box": dense_small_box,
        "heavy_dense_small_box": heavy_dense_small_box,
        "wide_aspect_body_text": wide_aspect_body_text,
        "prefer_typst_fit": bool(metrics.body_flags.get(index, False) and dense_small_box),
        "title_fit": title_fit,
        "adjacent_collision_risk": False,
        "adjacent_available_height_pt": None,
        "text_color": item.get("_render_text_color", (0, 0, 0)),
        "cover_fill": item.get("_render_cover_fill", (1, 1, 1)),
    }
