from __future__ import annotations

from copy import deepcopy
from statistics import median

from rendering.font_fit import bbox_width
from rendering.font_fit import inner_bbox
from rendering.font_fit import page_baseline_font_size
from rendering.render_payload_parts.metrics import block_metrics
from rendering.render_payload_parts.metrics import box_capacity_units
from rendering.render_payload_parts.shared import split_protected_text_for_boxes


def prepare_render_payloads_by_page(translated_pages: dict[int, list[dict]]) -> dict[int, list[dict]]:
    prepared = {page_idx: deepcopy(items) for page_idx, items in translated_pages.items()}
    if not prepared:
        return prepared

    page_metrics: dict[int, tuple[float, float, float, float, float]] = {}
    flat_items: list[dict] = []
    for page_idx in sorted(prepared):
        items = prepared[page_idx]
        page_font_size, page_line_pitch, page_line_height, density_baseline = page_baseline_font_size(items)
        text_widths = [bbox_width(item) for item in items if item.get("block_type") == "text"]
        page_text_width_med = median(text_widths) if text_widths else 0.0
        page_metrics[page_idx] = (
            page_font_size,
            page_line_pitch,
            page_line_height,
            density_baseline,
            page_text_width_med,
        )
        for item in items:
            item["render_protected_text"] = (
                item.get("translation_unit_protected_translated_text")
                or item.get("protected_translated_text")
                or ""
            ).strip()
            item["render_formula_map"] = item.get("translation_unit_formula_map") or item.get("formula_map", [])
            flat_items.append(item)

    units: dict[str, list[dict]] = {}
    for item in flat_items:
        unit_id = str(item.get("translation_unit_id", "") or "")
        if item.get("translation_unit_kind") == "group" and unit_id:
            units.setdefault(unit_id, []).append(item)

    for _, items in units.items():
        items = [item for item in items if (item.get("translation_unit_protected_translated_text") or "").strip()]
        if not items:
            continue
        unit_formula_map = items[0].get("translation_unit_formula_map") or items[0].get("group_formula_map", [])
        protected_unit_text = (
            items[0].get("translation_unit_protected_translated_text")
            or items[0].get("group_protected_translated_text")
            or ""
        ).strip()
        capacities: list[float] = []
        for item in items:
            page_font_size, page_line_pitch, page_line_height, density_baseline, page_text_width_med = page_metrics[
                item.get("page_idx", 0)
            ]
            font_size_pt, leading_em = block_metrics(
                item,
                page_font_size,
                page_line_pitch,
                page_line_height,
                density_baseline,
                page_text_width_med,
            )
            capacities.append(box_capacity_units(inner_bbox(item), font_size_pt, leading_em))

        chunks = split_protected_text_for_boxes(protected_unit_text, unit_formula_map, capacities)
        for item, chunk in zip(items, chunks):
            item["render_protected_text"] = chunk
            item["render_formula_map"] = unit_formula_map

    return prepared
