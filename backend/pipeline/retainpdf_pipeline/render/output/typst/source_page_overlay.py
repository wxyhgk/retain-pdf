from __future__ import annotations

from pathlib import Path

import fitz

from retainpdf_pipeline.render.layout.payload.blocks import build_render_blocks
from retainpdf_pipeline.render.source.background.page_overlay import overlay_pages_from_single_pdf as _overlay_pages_from_single_pdf
from retainpdf_pipeline.render.source.background.redaction_plan import redaction_items_from_blocks
from retainpdf_pipeline.render.source.background.redaction_plan import should_redact_source_page
from retainpdf_pipeline.render.source.background.redaction_plan import should_use_cover_only_for_vector_text
from retainpdf_pipeline.render.source.background.source_overlay import apply_source_page_overlay as _apply_source_page_overlay


def redaction_items_from_render_blocks(
    translated_items: list[dict],
    *,
    page_width: float,
    page_height: float,
) -> list[dict]:
    blocks = build_render_blocks(translated_items, page_width=page_width, page_height=page_height)
    return redaction_items_from_blocks(translated_items, blocks)


def apply_source_page_overlay(
    page: fitz.Page,
    translated_items: list[dict],
    *,
    cover_only: bool = False,
    redaction_strategy: str | None = None,
    visual_profile_path: Path | None = None,
) -> dict[str, object]:
    redaction_items = redaction_items_from_render_blocks(
        translated_items,
        page_width=page.rect.width,
        page_height=page.rect.height,
    )
    return _apply_source_page_overlay(
        page,
        translated_items,
        cover_only=cover_only,
        redaction_strategy=redaction_strategy,
        redaction_items=redaction_items,
        visual_profile_path=visual_profile_path,
    )


def overlay_pages_from_single_pdf(
    doc: fitz.Document,
    ordered_page_indices: list[int],
    translated_pages: dict[int, list[dict]],
    overlay_pdf_path: Path,
    *,
    cover_only: bool = False,
    apply_source_overlay: bool = True,
    remove_source_text_by_bbox: bool = False,
    redaction_strategy: str | None = None,
    source_text_precleaned_page_indices: frozenset[int] = frozenset(),
    skip_visual_cover: bool = False,
    source_base_pdf_path: Path | None = None,
    pikepdf_output_pdf_path: Path | None = None,
    visual_profile_path: Path | None = None,
) -> dict[str, object]:
    redaction_pages: dict[int, list[dict]] | None = None
    if apply_source_overlay or remove_source_text_by_bbox or not skip_visual_cover:
        redaction_pages = {
            page_idx: redaction_items_from_render_blocks(
                translated_pages[page_idx],
                page_width=doc[page_idx].rect.width,
                page_height=doc[page_idx].rect.height,
            )
            for page_idx in ordered_page_indices
        }
    return _overlay_pages_from_single_pdf(
        doc,
        ordered_page_indices,
        translated_pages,
        overlay_pdf_path,
        cover_only=cover_only,
        apply_source_overlay=apply_source_overlay,
        remove_source_text_by_bbox=remove_source_text_by_bbox,
        redaction_strategy=redaction_strategy,
        redaction_pages=redaction_pages,
        source_text_precleaned_page_indices=source_text_precleaned_page_indices,
        skip_visual_cover=skip_visual_cover,
        source_base_pdf_path=source_base_pdf_path,
        pikepdf_output_pdf_path=pikepdf_output_pdf_path,
        visual_profile_path=visual_profile_path,
    )


__all__ = [
    "apply_source_page_overlay",
    "overlay_pages_from_single_pdf",
    "redaction_items_from_render_blocks",
    "should_redact_source_page",
    "should_use_cover_only_for_vector_text",
]
