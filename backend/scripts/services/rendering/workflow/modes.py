from __future__ import annotations

from pathlib import Path

import fitz

from services.rendering.legacy.pdf_compress import compress_pdf_images_only
from services.rendering.document.pdf_ops import save_optimized_pdf
from services.rendering.output.typst.book_renderer import build_book_typst_background_pdf
from services.rendering.output.typst.book_renderer import build_book_typst_pdf
from services.rendering.output.typst.book_renderer import build_dual_book_pdf
from services.rendering.output.typst.overlay_ops import overlay_translated_pages_on_doc
from services.rendering.workflow.context import RenderExecutionContext
from services.rendering.document.metadata import copy_toc
from services.rendering.output.typst.shared import default_typst_temp_root


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
    )
    compress_pdf_images_only(context.output_pdf_path, dpi=context.pdf_compress_dpi)
    return len(translated_pages), {"mode": "dual"}


def run_selected_pages_overlay_render(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    context: RenderExecutionContext,
) -> tuple[int, dict[str, object]]:
    source_doc = fitz.open(source_pdf_path)
    temp_doc = fitz.open()
    try:
        temp_doc.insert_pdf(source_doc, from_page=context.start_page, to_page=context.end_page)
        copy_toc(source_doc, temp_doc, start_page=context.start_page, end_page=context.end_page)
        remapped_pages = {
            page_idx - context.start_page: items
            for page_idx, items in translated_pages.items()
        }
        overlay_diagnostics = overlay_translated_pages_on_doc(
            temp_doc,
            remapped_pages,
            stem="book-overlay",
            compile_workers=context.compile_workers,
            api_key=context.api_key,
            model=context.model,
            base_url=context.base_url,
            font_family=context.typst_font_family,
            temp_root=default_typst_temp_root(context.output_pdf_path),
            cover_only=False,
        )
        save_optimized_pdf(temp_doc, context.output_pdf_path)
    finally:
        temp_doc.close()
        source_doc.close()
    compress_pdf_images_only(context.output_pdf_path, dpi=context.pdf_compress_dpi)
    return context.end_page - context.start_page + 1, dict(overlay_diagnostics)


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
    )
    compress_pdf_images_only(context.output_pdf_path, dpi=context.pdf_compress_dpi)
    return len(translated_pages), dict(overlay_diagnostics)


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
    )
    compress_pdf_images_only(context.output_pdf_path, dpi=context.pdf_compress_dpi)
    return len(translated_pages), {"mode": "typst_visual" if visual_only_background else "typst"}
