from __future__ import annotations

from pathlib import Path
from typing import Callable

import fitz

from retainpdf_pipeline.render.layout.payload.prepare import prepare_render_payloads_by_page
from retainpdf_pipeline.render.layout.payload.blocks import build_render_block_payloads
from retainpdf_pipeline.render.layout.payload.blocks import resolve_book_body_font_target_from_payloads
from retainpdf_pipeline.render.layout.payload.body_pipeline import apply_body_payload_pipeline
from retainpdf_pipeline.render.layout.payload.annotation_font_policy import unify_annotation_fonts
from retainpdf_pipeline.render.layout.payload.collision import mark_adjacent_collision_risk
from retainpdf_pipeline.render.layout.payload.reading_sort import sort_payloads_by_reading_order
from retainpdf_pipeline.render.layout.payload.emit import emit_render_blocks
from retainpdf_pipeline.render.layout.model.models import RenderLayoutBlock
from retainpdf_pipeline.render.layout.model.models import RenderPageSpec
from retainpdf_pipeline.render.layout.title_fit import apply_title_fit_budget_to_render_blocks
from retainpdf_pipeline.render.policy import apply_render_pages_policy_fields
from retainpdf_pipeline.render.layout.typography_memory.learning import observe_payload_typography
from retainpdf_pipeline.foundation.config import layout

RenderPageSpecProgressCallback = Callable[[int, int, int], None]
PageSizeLookup = dict[int, tuple[float, float]]


def _layout_block_from_render_block(block, *, page_index: int) -> RenderLayoutBlock:
    return RenderLayoutBlock(
        block_id=f"item-{block.source_item_id}" if block.source_item_id else block.block_id,
        page_index=page_index,
        background_rect=list(block.cover_bbox),
        content_rect=list(block.inner_bbox),
        content_kind=block.render_kind,
        content_text=block.plain_text if block.render_kind == "plain" else block.markdown_text,
        plain_text=block.plain_text,
        math_map=list(block.math_map if hasattr(block, "math_map") else []),
        font_size_pt=block.font_size_pt,
        leading_em=block.leading_em,
        font_weight=block.font_weight,
        fit_to_box=block.fit_to_box,
        fit_single_line=block.fit_single_line,
        fit_min_font_size_pt=block.fit_min_font_size_pt,
        fit_max_font_size_pt=block.fit_max_font_size_pt,
        fit_min_leading_em=block.fit_min_leading_em,
        fit_max_height_pt=block.fit_max_height_pt,
        fit_target_width_pt=block.fit_target_width_pt,
        fit_target_height_pt=block.fit_target_height_pt,
        fit_shift_up_pt=block.fit_shift_up_pt,
        first_line_indent_pt=block.first_line_indent_pt,
        justify_text=block.justify_text,
        text_color=block.text_color,
        cover_fill=block.cover_fill,
        use_cover_fill=block.use_cover_fill,
        skip_reason=block.skip_reason,
        preserve_line_breaks=block.preserve_line_breaks,
        preserved_line_boxes=list(block.preserved_line_boxes or []),
        toc_entries=list(block.toc_entries or []),
    )


def _layout_page_spec(
    *,
    page_index: int,
    page_width_pt: float,
    page_height_pt: float,
    block_payloads: list[dict],
    page_text_width_med: float,
    book_body_font_target: float | None,
    background_pdf_path: Path | None,
) -> RenderPageSpec:
    # Reading-order-first (double-column): global sorted((y, x)) interleaves
    # the right-column top into the left column. Bbox is in-column fallback.
    ordered_payloads = sort_payloads_by_reading_order(block_payloads)
    apply_body_payload_pipeline(
        ordered_payloads,
        page_text_width_med=page_text_width_med,
        book_body_font_target=book_body_font_target,
    )
    if layout.FONT_UNIFY_MODE != "off":
        unify_annotation_fonts(ordered_payloads)
    mark_adjacent_collision_risk(ordered_payloads)
    observe_payload_typography(ordered_payloads)
    blocks = [
        _layout_block_from_render_block(block, page_index=page_index)
        for block in emit_render_blocks(block_payloads)
    ]
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
    prepared: bool = False,
    on_page_spec_built: RenderPageSpecProgressCallback | None = None,
    page_size_lookup: PageSizeLookup | None = None,
) -> list[RenderPageSpec]:
    prepared_pages = (
        apply_render_pages_policy_fields(translated_pages)
        if prepared
        else apply_render_pages_policy_fields(prepare_render_payloads_by_page(translated_pages))
    )
    if page_size_lookup is not None:
        return build_render_page_specs_from_page_sizes(
            translated_pages=prepared_pages,
            page_size_lookup=page_size_lookup,
            background_pdf_path=background_pdf_path,
            on_page_spec_built=on_page_spec_built,
        )
    source_doc = fitz.open(source_pdf_path)
    try:
        source_page_sizes = {
            page_index: (float(source_doc[page_index].rect.width), float(source_doc[page_index].rect.height))
            for page_index in sorted(page_idx for page_idx in prepared_pages if 0 <= page_idx < len(source_doc))
        }
        return build_render_page_specs_from_page_sizes(
            translated_pages=prepared_pages,
            page_size_lookup=source_page_sizes,
            background_pdf_path=background_pdf_path,
            on_page_spec_built=on_page_spec_built,
        )
    finally:
        source_doc.close()


def build_render_page_specs_from_page_sizes(
    *,
    translated_pages: dict[int, list[dict]],
    page_size_lookup: PageSizeLookup,
    background_pdf_path: Path | None = None,
    on_page_spec_built: RenderPageSpecProgressCallback | None = None,
) -> list[RenderPageSpec]:
    page_payloads: dict[int, tuple[list[dict], float]] = {}
    for page_index in sorted(translated_pages):
        page_size = page_size_lookup.get(page_index)
        if page_size is None:
            continue
        page_width, page_height = page_size
        page_payloads[page_index] = build_render_block_payloads(
            translated_pages[page_index],
            page_width=page_width,
            page_height=page_height,
        )
    book_body_font_target = resolve_book_body_font_target_from_payloads(list(page_payloads.values()))
    page_specs: list[RenderPageSpec] = []
    ordered_page_indices = sorted(page_payloads)
    total_pages = len(ordered_page_indices)
    for completed, page_index in enumerate(ordered_page_indices, start=1):
        page_size = page_size_lookup.get(page_index)
        if page_size is None:
            continue
        page_width, page_height = page_size
        block_payloads, page_text_width_med = page_payloads[page_index]
        page_specs.append(
            _layout_page_spec(
                page_index=page_index,
                page_width_pt=page_width,
                page_height_pt=page_height,
                block_payloads=block_payloads,
                page_text_width_med=page_text_width_med,
                book_body_font_target=book_body_font_target,
                background_pdf_path=background_pdf_path,
            )
        )
        if on_page_spec_built is not None:
            on_page_spec_built(completed, total_pages, page_index)
    return page_specs
