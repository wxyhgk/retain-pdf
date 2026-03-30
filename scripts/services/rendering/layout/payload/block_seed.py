from __future__ import annotations

from statistics import median

from services.rendering.layout.font_fit import BODY_LEADING_FLOOR_MIN
from services.rendering.layout.font_fit import BODY_LEADING_MAX
from services.rendering.layout.font_fit import BODY_LEADING_MIN
from services.rendering.layout.font_fit import BODY_LEADING_SIZE_ADJUST
from services.rendering.layout.font_fit import NON_BODY_LEADING_FLOOR_MIN
from services.rendering.layout.font_fit import NON_BODY_LEADING_MAX
from services.rendering.layout.font_fit import NON_BODY_LEADING_MIN
from services.rendering.layout.font_fit import NON_BODY_LEADING_SIZE_ADJUST
from services.rendering.layout.font_fit import cover_bbox as resolve_cover_bbox
from services.rendering.layout.font_fit import estimate_font_size_pt
from services.rendering.layout.font_fit import estimate_leading_em
from services.rendering.layout.font_fit import is_body_text_candidate
from services.rendering.layout.font_fit import normalize_leading_em_for_font_size
from services.rendering.layout.font_fit import page_baseline_font_size
from services.rendering.layout.font_fit import percentile_value
from services.rendering.layout.payload.body_context import page_box_area_ratio as compute_page_box_area_ratio
from services.rendering.layout.payload.metrics import fit_translated_block_metrics
from services.rendering.layout.payload.shared import COMPACT_SCALE
from services.rendering.layout.payload.shared import HEAVY_COMPACT_RATIO
from services.rendering.layout.payload.shared import get_render_protected_text
from services.rendering.layout.payload.shared import is_flag_like_plain_text_block
from services.rendering.layout.payload.shared import translation_density_ratio
from services.rendering.layout.typography.geometry import inner_bbox
from services.rendering.layout.typography.measurement import bbox_width


BODY_PAGE_FONT_ANCHOR_PERCENTILE = 0.46
SMALL_PAGE_BOX_RATIO = 0.06
ULTRA_SMALL_PAGE_BOX_RATIO = 0.04


def _item_tags(item: dict) -> set[str]:
    metadata = item.get("metadata", {}) or {}
    return {str(tag or "") for tag in (metadata.get("tags", []) or [])}


def _derived_role(item: dict) -> str:
    metadata = item.get("metadata", {}) or {}
    derived = metadata.get("derived", {}) or {}
    return str(derived.get("role", "") or "")


def _is_caption_like(item: dict) -> bool:
    return (
        _derived_role(item) == "caption"
        or str(item.get("block_type", "") or "") in {"image_caption", "table_caption", "table_footnote"}
        or "caption" in _item_tags(item)
    )


def _collect_page_seed_metrics(
    translated_items: list[dict],
) -> tuple[float, float, float, float, float, dict[int, bool], dict[int, tuple[float, float]], float | None]:
    page_font_size, page_line_pitch, page_line_height, density_baseline = page_baseline_font_size(translated_items)
    text_widths = [bbox_width(item) for item in translated_items if item.get("block_type") == "text" and not _is_caption_like(item)]
    page_text_width_med = median(text_widths) if text_widths else 0.0
    body_base_sizes: list[float] = []
    body_flags: dict[int, bool] = {}
    base_metrics: dict[int, tuple[float, float]] = {}

    for index, item in enumerate(translated_items):
        is_body = is_body_text_candidate(item, page_text_width_med)
        item_with_flag = {**item, "_is_body_text_candidate": is_body}
        body_flags[index] = is_body
        font_size_pt = estimate_font_size_pt(
            item_with_flag,
            page_font_size,
            page_line_pitch,
            page_line_height,
            density_baseline,
        )
        leading_em = estimate_leading_em(item_with_flag, page_line_pitch, font_size_pt)
        base_metrics[index] = (font_size_pt, leading_em)
        if is_body:
            body_base_sizes.append(font_size_pt)

    page_body_font_size_pt = round(percentile_value(body_base_sizes, BODY_PAGE_FONT_ANCHOR_PERCENTILE), 2) if body_base_sizes else None
    return (
        page_font_size,
        page_line_pitch,
        page_line_height,
        density_baseline,
        page_text_width_med,
        body_flags,
        base_metrics,
        page_body_font_size_pt,
    )


def build_block_payloads(
    translated_items: list[dict],
    *,
    page_width: float | None = None,
    page_height: float | None = None,
) -> tuple[list[dict], float]:
    (
        page_font_size,
        page_line_pitch,
        page_line_height,
        density_baseline,
        page_text_width_med,
        body_flags,
        base_metrics,
        page_body_font_size_pt,
    ) = _collect_page_seed_metrics(translated_items)
    block_payloads: list[dict] = []

    for index, item in enumerate(translated_items):
        translated_text = get_render_protected_text(item)
        bbox = item.get("bbox", [])
        if len(bbox) != 4 or not translated_text:
            continue

        use_raw_text_bbox = bool(item.get("_use_raw_text_bbox"))
        font_size_pt, leading_em = base_metrics[index]
        formula_map = item.get("render_formula_map") or item.get("translation_unit_formula_map") or item.get("formula_map", [])
        density_ratio = translation_density_ratio(item, translated_text)
        page_box_area_ratio = compute_page_box_area_ratio(bbox, page_width, page_height)
        dense_small_box = density_ratio >= 0.9 and 0 < page_box_area_ratio <= SMALL_PAGE_BOX_RATIO
        heavy_dense_small_box = density_ratio >= HEAVY_COMPACT_RATIO and 0 < page_box_area_ratio <= ULTRA_SMALL_PAGE_BOX_RATIO

        if body_flags.get(index) and page_body_font_size_pt is not None:
            down_band = 0.34 if heavy_dense_small_box else (0.2 if dense_small_box else 0.06)
            up_band = 0.18 if dense_small_box else 0.24
            font_size_pt = round(min(max(font_size_pt, page_body_font_size_pt - down_band), page_body_font_size_pt + up_band), 2)

        if dense_small_box and not body_flags.get(index):
            font_size_pt = round(font_size_pt * COMPACT_SCALE, 2)
            leading_em = round(leading_em * COMPACT_SCALE, 2)

        font_size_pt, leading_em = fit_translated_block_metrics(
            {
                **item,
                "_is_body_text_candidate": body_flags.get(index, False),
                "_page_box_area_ratio": page_box_area_ratio,
                "_dense_small_box": dense_small_box,
                "_heavy_dense_small_box": heavy_dense_small_box,
            },
            translated_text,
            formula_map,
            font_size_pt,
            leading_em,
            page_body_font_size_pt=page_body_font_size_pt if body_flags.get(index) else None,
        )

        if body_flags.get(index):
            leading_em = normalize_leading_em_for_font_size(
                font_size_pt,
                leading_em,
                reference_font_size_pt=page_body_font_size_pt or page_font_size,
                min_leading_em=BODY_LEADING_MIN,
                max_leading_em=BODY_LEADING_MAX,
                strength=BODY_LEADING_SIZE_ADJUST,
                floor_min_leading_em=BODY_LEADING_FLOOR_MIN,
            )
        else:
            leading_em = normalize_leading_em_for_font_size(
                font_size_pt,
                leading_em,
                reference_font_size_pt=page_font_size,
                min_leading_em=NON_BODY_LEADING_MIN,
                max_leading_em=NON_BODY_LEADING_MAX,
                strength=NON_BODY_LEADING_SIZE_ADJUST,
                floor_min_leading_em=NON_BODY_LEADING_FLOOR_MIN,
            )

        item_inner_bbox = inner_bbox(item)
        item_cover_bbox = resolve_cover_bbox(item)
        block_payloads.append(
            {
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
                "page_body_font_size_pt": page_body_font_size_pt if body_flags.get(index) else None,
                "is_body": body_flags.get(index, False),
                "page_box_area_ratio": page_box_area_ratio,
                "dense_small_box": dense_small_box,
                "heavy_dense_small_box": heavy_dense_small_box,
                "prefer_typst_fit": bool(body_flags.get(index, False) and dense_small_box),
                "adjacent_collision_risk": False,
                "adjacent_available_height_pt": None,
            }
        )

    return block_payloads, page_text_width_med
