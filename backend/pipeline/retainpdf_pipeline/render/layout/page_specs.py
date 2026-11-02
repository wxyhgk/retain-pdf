from __future__ import annotations

import os
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures import as_completed
from multiprocessing import get_context
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


_LAYOUT_PARALLEL_MIN_PAGES = 32
_LAYOUT_PARALLEL_MAX_WORKERS = 8
_LAYOUT_TUNING_ATTRS = (
    "BODY_FONT_SIZE_FACTOR",
    "BODY_LEADING_FACTOR",
    "INNER_BBOX_SHRINK_X",
    "INNER_BBOX_SHRINK_Y",
    "INNER_BBOX_DENSE_SHRINK_X",
    "INNER_BBOX_DENSE_SHRINK_Y",
    "FONT_UNIFY_MODE",
    "SOURCE_CLEANUP_STRATEGY",
    "DEFAULT_TEXT_OVERLAY_COVER_FILL",
)

_FORK_CONTEXT = None
try:
    _FORK_CONTEXT = get_context("fork")
except Exception:
    _FORK_CONTEXT = None


def _layout_tuning_snapshot() -> dict[str, object]:
    return {name: getattr(layout, name) for name in _LAYOUT_TUNING_ATTRS}


def _apply_layout_tuning_snapshot(snapshot: dict[str, object]) -> None:
    for name, value in snapshot.items():
        setattr(layout, name, value)


def _default_layout_workers(page_count: int) -> int:
    cpu_count = os.cpu_count() or 1
    return max(1, min(page_count, cpu_count, _LAYOUT_PARALLEL_MAX_WORKERS))


def _build_page_block_payloads_job(
    args: tuple[int, list[dict], float, float],
) -> tuple[int, list[dict], float]:
    page_index, items, page_width, page_height = args
    block_payloads, page_text_width_med = build_render_block_payloads(
        items,
        page_width=page_width,
        page_height=page_height,
    )
    return page_index, block_payloads, page_text_width_med


def _layout_single_page_spec_job(
    args: tuple[int, float, float, list[dict], float, float | None, str | None],
) -> tuple[int, RenderPageSpec, list[dict]]:
    page_index, page_width, page_height, block_payloads, med, font_target, background_pdf = args
    spec, ordered_payloads = _layout_page_spec_with_payloads(
        page_index=page_index,
        page_width_pt=page_width,
        page_height_pt=page_height,
        block_payloads=block_payloads,
        page_text_width_med=med,
        book_body_font_target=font_target,
        background_pdf_path=Path(background_pdf) if background_pdf is not None else None,
    )
    return page_index, spec, ordered_payloads


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
    spec, _ordered_payloads = _layout_page_spec_with_payloads(
        page_index=page_index,
        page_width_pt=page_width_pt,
        page_height_pt=page_height_pt,
        block_payloads=block_payloads,
        page_text_width_med=page_text_width_med,
        book_body_font_target=book_body_font_target,
        background_pdf_path=background_pdf_path,
    )
    return spec


def _layout_page_spec_with_payloads(
    *,
    page_index: int,
    page_width_pt: float,
    page_height_pt: float,
    block_payloads: list[dict],
    page_text_width_med: float,
    book_body_font_target: float | None,
    background_pdf_path: Path | None,
) -> tuple[RenderPageSpec, list[dict]]:
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
    ), ordered_payloads


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
    finally:
        source_doc.close()
    # The pool below may fork: no fitz Document may stay open across it, or a
    # child can inherit (and wedge on) MuPDF-global locks held by siblings.
    return build_render_page_specs_from_page_sizes(
        translated_pages=prepared_pages,
        page_size_lookup=source_page_sizes,
        background_pdf_path=background_pdf_path,
        on_page_spec_built=on_page_spec_built,
    )


def build_render_page_specs_from_page_sizes(
    *,
    translated_pages: dict[int, list[dict]],
    page_size_lookup: PageSizeLookup,
    background_pdf_path: Path | None = None,
    on_page_spec_built: RenderPageSpecProgressCallback | None = None,
    max_workers: int | None = None,
) -> list[RenderPageSpec]:
    ordered_inputs = [
        (page_index, translated_pages[page_index], page_size_lookup[page_index][0], page_size_lookup[page_index][1])
        for page_index in sorted(translated_pages)
        if page_index in page_size_lookup
    ]
    workers = max_workers if max_workers is not None else _default_layout_workers(len(ordered_inputs))
    workers = max(1, min(workers, _LAYOUT_PARALLEL_MAX_WORKERS))
    if workers <= 1 or len(ordered_inputs) < _LAYOUT_PARALLEL_MIN_PAGES:
        return _build_page_specs_sequential(
            ordered_inputs,
            background_pdf_path=background_pdf_path,
            on_page_spec_built=on_page_spec_built,
        )
    snapshot = _layout_tuning_snapshot()
    page_payloads: dict[int, tuple[list[dict], float]] = {}
    with ProcessPoolExecutor(
        max_workers=workers,
        mp_context=_FORK_CONTEXT,
        initializer=_apply_layout_tuning_snapshot,
        initargs=(snapshot,),
    ) as executor:
        phase_a = {
            executor.submit(
                _build_page_block_payloads_job, (page_index, items, page_width, page_height)
            ): page_index
            for page_index, items, page_width, page_height in ordered_inputs
        }
        for future in as_completed(phase_a):
            page_index, block_payloads, med = future.result()
            page_payloads[page_index] = (block_payloads, med)
        book_body_font_target = resolve_book_body_font_target_from_payloads(
            [page_payloads[page_index] for page_index, _items, _w, _h in ordered_inputs]
        )
        background_pdf_str = str(background_pdf_path) if background_pdf_path is not None else None
        phase_b = {
            executor.submit(
                _layout_single_page_spec_job,
                (
                    page_index,
                    page_size_lookup[page_index][0],
                    page_size_lookup[page_index][1],
                    page_payloads[page_index][0],
                    page_payloads[page_index][1],
                    book_body_font_target,
                    background_pdf_str,
                ),
            ): page_index
            for page_index, _items, _w, _h in ordered_inputs
        }
        spec_by_page: dict[int, RenderPageSpec] = {}
        completed = 0
        total_pages = len(ordered_inputs)
        for future in as_completed(phase_b):
            page_index, spec, _ordered_payloads = future.result()
            spec_by_page[page_index] = spec
            completed += 1
            if on_page_spec_built is not None:
                # Arrival order, not page order: `completed` stays monotonic,
                # `page_index` follows finish order. No production caller
                # consumes this callback today.
                on_page_spec_built(completed, total_pages, page_index)
    return [spec_by_page[page_index] for page_index, _items, _w, _h in ordered_inputs]


def _build_page_specs_sequential(
    ordered_inputs: list[tuple[int, list[dict], float, float]],
    *,
    background_pdf_path: Path | None,
    on_page_spec_built: RenderPageSpecProgressCallback | None,
) -> list[RenderPageSpec]:
    page_payloads: dict[int, tuple[list[dict], float]] = {}
    for page_index, items, page_width, page_height in ordered_inputs:
        page_payloads[page_index] = build_render_block_payloads(
            items,
            page_width=page_width,
            page_height=page_height,
        )
    book_body_font_target = resolve_book_body_font_target_from_payloads(list(page_payloads.values()))
    page_specs: list[RenderPageSpec] = []
    total_pages = len(ordered_inputs)
    for completed, (page_index, _items, page_width, page_height) in enumerate(ordered_inputs, start=1):
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
