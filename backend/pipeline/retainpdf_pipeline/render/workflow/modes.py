from __future__ import annotations

import os
from pathlib import Path

import fitz

from retainpdf_pipeline.render.legacy.pdf_compress import compress_pdf_images_only
from retainpdf_pipeline.render.document.pdf_ops import save_fast_pdf
from retainpdf_pipeline.render.document.pdf_ops import save_optimized_pdf
from retainpdf_pipeline.render.document.pikepdf_pages import extract_pages_with_pikepdf
from retainpdf_pipeline.render.output.typst.book_renderer import build_book_typst_background_pdf
from retainpdf_pipeline.render.output.typst.book_renderer import build_book_typst_pdf
from retainpdf_pipeline.render.output.typst.book_renderer import build_dual_book_pdf
from retainpdf_pipeline.render.workflow.context import RenderExecutionContext
from retainpdf_pipeline.render.output.typst.shared import default_typst_temp_root
from retainpdf_pipeline.render.source.intermediate_paths import intermediate_pdf_path


def _compress_final_pdf_if_needed(context: RenderExecutionContext, *, mode: str) -> bool:
    if context.source_image_compressed:
        print(
            f"final image-only compress: skipped for {mode} because render source was already compressed",
            flush=True,
        )
        return False
    return compress_pdf_images_only(context.output_pdf_path, dpi=context.pdf_compress_dpi)


def _should_fast_save(context: RenderExecutionContext) -> bool:
    optimized = str(os.environ.get("RETAINPDF_RENDER_OPTIMIZED_SAVE", "") or "").strip().lower()
    if optimized in {"1", "true", "yes", "on"}:
        return False
    return True


def _indent_detection_pdf_path(context: RenderExecutionContext, fallback: Path) -> Path:
    return context.indent_detection_pdf_path or fallback


def run_dual_render(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    context: RenderExecutionContext,
) -> tuple[int, dict[str, object]]:
    build_dual_book_pdf(
        source_pdf_path=source_pdf_path,
        output_pdf_path=context.output_pdf_path,
        translated_pages=translated_pages,
        start_page=context.start_page,
        end_page=context.end_page,
        compile_workers=context.compile_workers,
        api_key=context.api_key,
        model=context.model,
        base_url=context.base_url,
        font_family=context.typst_font_family,
        cover_only=False,
        fast_save=_should_fast_save(context),
        indent_detection_pdf_path=_indent_detection_pdf_path(context, source_pdf_path),
        first_line_indent_lookup=context.first_line_indent_lookup,
        effective_inner_bbox_lookup=context.effective_inner_bbox_lookup,
        request_chat_content_fn=None,
    )
    final_compressed = _compress_final_pdf_if_needed(context, mode="dual")
    return len(translated_pages), {"mode": "dual", "final_image_compressed": final_compressed}


def run_selected_pages_overlay_render(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    context: RenderExecutionContext,
) -> tuple[int, dict[str, object]]:
    selected_source_path = intermediate_pdf_path(
        work_root=default_typst_temp_root(context.output_pdf_path),
        output_pdf_path=context.output_pdf_path,
        suffix=".selected-source.pdf",
    )
    extract_pages_with_pikepdf(
        source_pdf_path=source_pdf_path,
        output_pdf_path=selected_source_path,
        start_page=context.start_page,
        end_page=context.end_page,
    )
    remapped_pages = {
        page_idx - context.start_page: items
        for page_idx, items in translated_pages.items()
        if context.start_page <= page_idx <= context.end_page
    }
    remapped_precleaned_pages = frozenset(
        page_idx - context.start_page
        for page_idx in context.source_text_precleaned_page_indices
        if context.start_page <= page_idx <= context.end_page
    )
    remapped_visual_cover_pages = frozenset(
        page_idx - context.start_page
        for page_idx in context.visual_cover_page_indices
        if context.start_page <= page_idx <= context.end_page
    )
    overlay_diagnostics = build_book_typst_pdf(
        source_pdf_path=selected_source_path,
        output_pdf_path=context.output_pdf_path,
        translated_pages=remapped_pages,
        compile_workers=context.compile_workers,
        api_key=context.api_key,
        model=context.model,
        base_url=context.base_url,
        font_family=context.typst_font_family,
        cover_only=False,
        fast_save=_should_fast_save(context),
        indent_detection_pdf_path=_indent_detection_pdf_path(context, source_pdf_path),
        first_line_indent_lookup=context.first_line_indent_lookup,
        effective_inner_bbox_lookup=context.effective_inner_bbox_lookup,
        source_text_precleaned_page_indices=remapped_precleaned_pages,
        source_cleanup_strategy=context.source_cleanup_strategy,
        precomputed_colors_by_item_id=context.render_colors_by_item_id,
        visual_profile_path=context.visual_profile_path,
        visual_cover_page_indices=remapped_visual_cover_pages,
        request_chat_content_fn=None,
    )
    final_compressed = _compress_final_pdf_if_needed(context, mode="selected_pages_overlay")
    diagnostics = dict(overlay_diagnostics)
    diagnostics["final_image_compressed"] = final_compressed
    return context.end_page - context.start_page + 1, diagnostics


def run_overlay_render(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    context: RenderExecutionContext,
) -> tuple[int, dict[str, object]]:
    overlay_diagnostics = build_book_typst_pdf(
        source_pdf_path=source_pdf_path,
        output_pdf_path=context.output_pdf_path,
        translated_pages=translated_pages,
        compile_workers=context.compile_workers,
        api_key=context.api_key,
        model=context.model,
        base_url=context.base_url,
        font_family=context.typst_font_family,
        cover_only=False,
        fast_save=_should_fast_save(context),
        indent_detection_pdf_path=_indent_detection_pdf_path(context, source_pdf_path),
        first_line_indent_lookup=context.first_line_indent_lookup,
        effective_inner_bbox_lookup=context.effective_inner_bbox_lookup,
        source_text_precleaned_page_indices=context.source_text_precleaned_page_indices,
        source_cleanup_strategy=context.source_cleanup_strategy,
        prepared_overlay_pages=context.prepared_overlay_pages,
        precomputed_colors_by_item_id=context.render_colors_by_item_id,
        visual_profile_path=context.visual_profile_path,
        prebuilt_source_path=None if context.no_cache else context.overlay_source_path,
        visual_cover_page_indices=context.visual_cover_page_indices,
        no_cache=context.no_cache,
        request_chat_content_fn=None,
    )
    final_compressed = _compress_final_pdf_if_needed(context, mode="overlay")
    diagnostics = dict(overlay_diagnostics)
    diagnostics["final_image_compressed"] = final_compressed
    return len(translated_pages), diagnostics


def run_background_typst_render(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    context: RenderExecutionContext,
    visual_only_background: bool = False,
) -> tuple[int, dict[str, object]]:
    if visual_only_background:
        print("typst visual-only background render selected", flush=True)
    else:
        print("typst background render selected", flush=True)
    background_diagnostics = build_book_typst_background_pdf(
        source_pdf_path=source_pdf_path,
        output_pdf_path=context.output_pdf_path,
        translated_pages=translated_pages,
        api_key=context.api_key,
        model=context.model,
        base_url=context.base_url,
        font_family=context.typst_font_family,
        compile_workers=context.compile_workers,
        redaction_strategy="visual_cover" if visual_only_background else None,
        indent_detection_pdf_path=_indent_detection_pdf_path(context, source_pdf_path),
        first_line_indent_lookup=context.first_line_indent_lookup,
        effective_inner_bbox_lookup=context.effective_inner_bbox_lookup,
        source_text_precleaned_page_indices=context.source_text_precleaned_page_indices,
        prebuilt_page_specs=context.background_render_page_specs,
        precomputed_colors_by_item_id=context.render_colors_by_item_id,
        visual_profile_path=context.visual_profile_path,
        fast_save=_should_fast_save(context),
        request_chat_content_fn=None,
    )
    mode = "typst_visual" if visual_only_background else "typst"
    final_compressed = _compress_final_pdf_if_needed(context, mode=mode)
    diagnostics = dict(background_diagnostics)
    diagnostics["mode"] = mode
    diagnostics["final_image_compressed"] = final_compressed
    return len(translated_pages), diagnostics
