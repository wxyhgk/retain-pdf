from __future__ import annotations

import tempfile
from pathlib import Path

import fitz

from config import fonts
from config import paths
from rendering.pdf_overlay import save_optimized_pdf
from rendering.pdf_overlay import strip_page_links
from rendering.render_payloads import prepare_render_payloads_by_page
from rendering.typst_renderer.compiler import compile_typst_book_background_pdf
from rendering.typst_renderer.overlay_ops import overlay_translated_items_on_page
from rendering.typst_renderer.overlay_ops import overlay_translated_pages_on_doc
from rendering.typst_renderer.sanitize import sanitize_page_specs_for_typst_book_background


def build_single_page_typst_pdf(
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_items: list[dict],
    page_idx: int,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
) -> None:
    source_doc = fitz.open(source_pdf_path)
    temp_doc = fitz.open()
    temp_doc.insert_pdf(source_doc, from_page=page_idx, to_page=page_idx)
    page = temp_doc[0]
    strip_page_links(page)
    overlay_translated_items_on_page(
        page,
        translated_items,
        stem=f"page-{page_idx + 1}",
        font_family=font_family,
        font_paths=font_paths,
    )
    save_optimized_pdf(temp_doc, output_pdf_path)
    temp_doc.close()
    source_doc.close()


def build_book_typst_pdf(
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    compile_workers: int | None = None,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
) -> None:
    doc = fitz.open(source_pdf_path)
    try:
        overlay_translated_pages_on_doc(
            doc,
            translated_pages,
            stem="book-overlay",
            compile_workers=compile_workers,
            font_family=font_family,
            font_paths=font_paths,
        )
        save_optimized_pdf(doc, output_pdf_path)
    finally:
        doc.close()


def build_dual_book_pdf(
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    start_page: int = 0,
    end_page: int = -1,
    compile_workers: int | None = None,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
) -> None:
    source_doc = fitz.open(source_pdf_path)
    translated_doc = fitz.open(source_pdf_path)
    dual_doc = fitz.open()
    try:
        overlay_translated_pages_on_doc(
            translated_doc,
            translated_pages,
            stem="book-overlay-dual",
            compile_workers=compile_workers,
            font_family=font_family,
            font_paths=font_paths,
        )
        last_page = len(source_doc) - 1
        start_idx = max(0, start_page)
        end_idx = last_page if end_page < 0 else min(end_page, last_page)
        for page_idx in range(start_idx, end_idx + 1):
            source_page = source_doc[page_idx]
            translated_page = translated_doc[page_idx]
            page_width = source_page.rect.width + translated_page.rect.width
            page_height = max(source_page.rect.height, translated_page.rect.height)
            dual_page = dual_doc.new_page(width=page_width, height=page_height)
            dual_page.show_pdf_page(
                fitz.Rect(0, 0, source_page.rect.width, source_page.rect.height),
                source_doc,
                page_idx,
                overlay=True,
            )
            dual_page.show_pdf_page(
                fitz.Rect(
                    source_page.rect.width,
                    0,
                    source_page.rect.width + translated_page.rect.width,
                    translated_page.rect.height,
                ),
                translated_doc,
                page_idx,
                overlay=True,
            )
        save_optimized_pdf(dual_doc, output_pdf_path)
    finally:
        dual_doc.close()
        translated_doc.close()
        source_doc.close()


def build_book_typst_background_pdf(
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
) -> None:
    translated_pages = prepare_render_payloads_by_page(translated_pages)
    source_doc = fitz.open(source_pdf_path)
    try:
        ordered_page_indices = sorted(page_idx for page_idx in translated_pages if 0 <= page_idx < len(source_doc))
        page_specs = [
            (
                page_idx,
                source_doc[page_idx].rect.width,
                source_doc[page_idx].rect.height,
                translated_pages[page_idx],
            )
            for page_idx in ordered_page_indices
        ]
    finally:
        source_doc.close()

    with tempfile.TemporaryDirectory(prefix="typst-background-", dir=paths.OUTPUT_DIR) as temp_dir:
        work_dir = Path(temp_dir)
        try:
            background_pdf = compile_typst_book_background_pdf(
                source_pdf_path=source_pdf_path,
                page_specs=page_specs,
                stem="book-background-overlay",
                font_family=font_family,
                font_paths=font_paths,
                work_dir=work_dir,
            )
        except RuntimeError as exc:
            print("typst background book compile failed; sanitizing pages", flush=True)
            print(str(exc), flush=True)
            sanitized_page_specs = sanitize_page_specs_for_typst_book_background(
                page_specs,
                stem="book-background-overlay",
                font_family=font_family,
                font_paths=font_paths,
                work_dir=work_dir,
            )
            background_pdf = compile_typst_book_background_pdf(
                source_pdf_path=source_pdf_path,
                page_specs=sanitized_page_specs,
                stem="book-background-overlay-sanitized",
                font_family=font_family,
                font_paths=font_paths,
                work_dir=work_dir,
            )
        background_doc = fitz.open(background_pdf)
        try:
            save_optimized_pdf(background_doc, output_pdf_path)
        finally:
            background_doc.close()
