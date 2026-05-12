from __future__ import annotations

from pathlib import Path

import fitz

from services.rendering.layout.payload.prepare import prepare_render_payloads_by_page
from services.rendering.layout.page_block_builder import layout_block_from_item
from services.rendering.layout.model.models import RenderLayoutBlock
from services.rendering.layout.model.models import RenderPageSpec
from services.rendering.layout.page_collision import mark_adjacent_collision_risk
from services.rendering.layout.font_fit import page_baseline_font_size
from services.rendering.layout.title_fit import apply_title_fit_budget_to_render_blocks
from services.rendering.layout.typography.measurement import bbox_width
from services.rendering.layout.payload.text_common import get_render_formula_map
from services.rendering.layout.payload.text_common import get_render_protected_text
from services.translation.item_reader import item_block_kind


def _page_text_width_med(items: list[dict]) -> float:
    text_widths = [bbox_width(item) for item in items if item_block_kind(item) == "text"]
    if not text_widths:
        return 0.0
    text_widths = sorted(text_widths)
    return text_widths[len(text_widths) // 2]


def _build_layout_blocks(items: list[dict], *, page_index: int) -> list[RenderLayoutBlock]:
    page_font_size, page_line_pitch, page_line_height, density_baseline = page_baseline_font_size(items)
    page_text_width_med = _page_text_width_med(items)
    blocks: list[RenderLayoutBlock] = []
    for item in items:
        block = layout_block_from_item(
            item,
            page_index=page_index,
            page_font_size=page_font_size,
            page_line_pitch=page_line_pitch,
            page_line_height=page_line_height,
            density_baseline=density_baseline,
            page_text_width_med=page_text_width_med,
        )
        if block is not None:
            blocks.append(block)
    mark_adjacent_collision_risk(blocks)
    return blocks


def _with_render_fields(items: list[dict]) -> list[dict]:
    prepared: list[dict] = []
    for item in items:
        next_item = dict(item)
        next_item["render_protected_text"] = get_render_protected_text(next_item)
        next_item["render_formula_map"] = get_render_formula_map(next_item)
        prepared.append(next_item)
    return prepared


def _layout_page_spec(
    *,
    page_index: int,
    page_width_pt: float,
    page_height_pt: float,
    items: list[dict],
    background_pdf_path: Path | None,
) -> RenderPageSpec:
    blocks = _build_layout_blocks(_with_render_fields(items), page_index=page_index)
    apply_title_fit_budget_to_render_blocks(
        blocks,
        page_width=page_width_pt,
        page_height=page_height_pt,
    )
    return RenderPageSpec(
        page_index=page_index,
        page_width_pt=page_width_pt,
        page_height_pt=page_height_pt,
        background_pdf_path=background_pdf_path,
        blocks=blocks,
    )


def build_render_page_specs(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    background_pdf_path: Path | None = None,
) -> list[RenderPageSpec]:
    prepared_pages = prepare_render_payloads_by_page(translated_pages)
    source_doc = fitz.open(source_pdf_path)
    try:
        page_specs: list[RenderPageSpec] = []
        for page_index in sorted(page_idx for page_idx in prepared_pages if 0 <= page_idx < len(source_doc)):
            page = source_doc[page_index]
            page_specs.append(
                _layout_page_spec(
                    page_index=page_index,
                    page_width_pt=page.rect.width,
                    page_height_pt=page.rect.height,
                    items=prepared_pages[page_index],
                    background_pdf_path=background_pdf_path,
                )
            )
        return page_specs
    finally:
        source_doc.close()
