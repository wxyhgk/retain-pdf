from __future__ import annotations

from statistics import median

from rendering.font_fit import bbox_width
from rendering.font_fit import estimate_font_size_pt
from rendering.font_fit import estimate_leading_em
from rendering.font_fit import inner_bbox
from rendering.font_fit import is_body_text_candidate
from rendering.font_fit import page_baseline_font_size
from rendering.math_utils import build_markdown_from_parts
from rendering.math_utils import build_plain_text_from_text
from rendering.models import RenderBlock
from rendering.render_payload_parts.metrics import fit_translated_block_metrics
from rendering.render_payload_parts.shared import COMPACT_SCALE
from rendering.render_payload_parts.shared import COMPACT_TRIGGER_RATIO
from rendering.render_payload_parts.shared import is_flag_like_plain_text_block
from rendering.render_payload_parts.shared import translation_density_ratio


def build_render_blocks(translated_items: list[dict]) -> list[RenderBlock]:
    blocks: list[RenderBlock] = []
    page_font_size, page_line_pitch, page_line_height, density_baseline = page_baseline_font_size(translated_items)
    text_widths = [bbox_width(item) for item in translated_items if item.get("block_type") == "text"]
    page_text_width_med = median(text_widths) if text_widths else 0.0
    body_base_sizes: list[float] = []
    body_flags: dict[int, bool] = {}
    base_metrics: dict[int, tuple[float, float]] = {}

    for index, item in enumerate(translated_items):
        item_with_flag = dict(item)
        item_with_flag["_is_body_text_candidate"] = is_body_text_candidate(item, page_text_width_med)
        body_flags[index] = item_with_flag["_is_body_text_candidate"]
        font_size_pt = estimate_font_size_pt(
            item_with_flag,
            page_font_size,
            page_line_pitch,
            page_line_height,
            density_baseline,
        )
        leading_em = estimate_leading_em(item_with_flag, page_line_pitch, font_size_pt)
        base_metrics[index] = (font_size_pt, leading_em)
        if item_with_flag["_is_body_text_candidate"]:
            body_base_sizes.append(font_size_pt)

    page_body_font_size_pt = round(median(body_base_sizes), 2) if body_base_sizes else None

    for index, item in enumerate(translated_items):
        translated_text = (
            item.get("render_protected_text")
            or item.get("translation_unit_protected_translated_text")
            or item.get("protected_translated_text")
            or ""
        ).strip()
        bbox = item.get("bbox", [])
        if len(bbox) != 4 or not translated_text:
            continue
        font_size_pt, leading_em = base_metrics[index]
        formula_map = item.get("render_formula_map") or item.get("translation_unit_formula_map") or item.get("formula_map", [])
        density_ratio = translation_density_ratio(item, translated_text)
        is_dense_block = density_ratio >= COMPACT_TRIGGER_RATIO
        if body_flags.get(index) and page_body_font_size_pt is not None:
            down_band = 0.7 if is_dense_block else 0.45
            up_band = 0.35 if is_dense_block else 0.3
            font_size_pt = round(min(max(font_size_pt, page_body_font_size_pt - down_band), page_body_font_size_pt + up_band), 2)
        if is_dense_block and not body_flags.get(index):
            font_size_pt = round(font_size_pt * COMPACT_SCALE, 2)
            leading_em = round(leading_em * COMPACT_SCALE, 2)
        font_size_pt, leading_em = fit_translated_block_metrics(
            {**item, "_is_body_text_candidate": body_flags.get(index, False)},
            translated_text,
            formula_map,
            font_size_pt,
            leading_em,
            page_body_font_size_pt=page_body_font_size_pt if body_flags.get(index) else None,
        )
        blocks.append(
            RenderBlock(
                block_id=f"item-{index}",
                bbox=bbox,
                inner_bbox=inner_bbox(item),
                markdown_text=build_markdown_from_parts(translated_text, formula_map),
                plain_text=build_plain_text_from_text(translated_text),
                render_kind="plain_line" if item.get("_force_plain_line") or is_flag_like_plain_text_block(item) else "markdown",
                font_size_pt=font_size_pt,
                leading_em=leading_em,
            )
        )
    return blocks
