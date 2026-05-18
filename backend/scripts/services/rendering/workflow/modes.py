from __future__ import annotations

from pathlib import Path

import fitz

from services.rendering.legacy.pdf_compress import compress_pdf_images_only
from services.rendering.document.pdf_ops import save_fast_pdf
from services.rendering.document.pdf_ops import save_optimized_pdf
from services.rendering.document.pikepdf_pages import extract_pages_with_pikepdf
from services.rendering.output.typst.book_renderer import build_book_typst_background_pdf
from services.rendering.output.typst.book_renderer import build_book_typst_pdf
from services.rendering.output.typst.book_renderer import build_dual_book_pdf
from services.rendering.workflow.context import RenderExecutionContext
from services.rendering.output.typst.shared import default_typst_temp_root


def _compress_final_pdf_if_needed(context: RenderExecutionContext, *, mode: str) -> bool:
    if context.source_image_compressed:
        print(
            f"final image-only compress: skipped for {mode} because render source was already compressed",
            flush=True,
        )
        return False
    return compress_pdf_images_only(context.output_pdf_path, dpi=context.pdf_compress_dpi)


def _should_fast_save(context: RenderExecutionContext) -> bool:
    return context.source_image_compressed or context.pdf_compress_dpi <= 0


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
    )
    final_compressed = _compress_final_pdf_if_needed(context, mode="dual")
    return len(translated_pages), {"mode": "dual", "final_image_compressed": final_compressed}


def run_selected_pages_overlay_render(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    context: RenderExecutionContext,
) -> tuple[int, dict[str, object]]:
    selected_source_path = default_typst_temp_root(context.output_pdf_path) / f"{context.output_pdf_path.stem}.selected-source.pdf"
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
    build_book_typst_background_pdf(
        source_pdf_path=source_pdf_path,
        output_pdf_path=context.output_pdf_path,
        translated_pages=translated_pages,
        api_key=context.api_key,
        model=context.model,
        base_url=context.base_url,
        font_family=context.typst_font_family,
        redaction_strategy="visual_cover" if visual_only_background else None,
        indent_detection_pdf_path=_indent_detection_pdf_path(context, source_pdf_path),
        first_line_indent_lookup=context.first_line_indent_lookup,
        effective_inner_bbox_lookup=context.effective_inner_bbox_lookup,
    )
    mode = "typst_visual" if visual_only_background else "typst"
    final_compressed = _compress_final_pdf_if_needed(context, mode=mode)
    return len(translated_pages), {"mode": mode, "final_image_compressed": final_compressed}
