from __future__ import annotations

from pathlib import Path

import fitz

from foundation.config import fonts
from services.rendering.api.pdf_overlay import save_optimized_pdf
from services.rendering.api.pdf_overlay import strip_page_links
from services.rendering.background.stage import build_clean_background_pdf
from services.rendering.typst.book_helpers import build_dual_doc_pages
from services.rendering.typst.book_helpers import collect_background_page_specs
from services.rendering.typst.book_helpers import prepare_background_work_dir
from services.rendering.typst.book_helpers import prepare_single_page_items
from services.rendering.typst.book_helpers import resolve_typst_temp_root
from services.rendering.typst.book_helpers import save_background_pdf_to_output
from services.rendering.layout.render_model import build_render_page_specs
from services.rendering.typst.compiler import compile_typst_render_pages_pdf
from services.rendering.typst.overlay_ops import overlay_translated_items_on_page
from services.rendering.typst.overlay_ops import overlay_translated_pages_on_doc
from services.rendering.typst.sanitize import sanitize_page_specs_for_typst_book_background


def _build_overlay_base_doc(source_pdf_path: Path) -> fitz.Document:
    source_doc = fitz.open(source_pdf_path)
    output_doc = fitz.open()
    try:
        output_doc.insert_pdf(source_doc)
    finally:
        source_doc.close()
    return output_doc


def _compile_render_pages_pdf_resilient(
    *,
    source_pdf_path: Path,
    background_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    page_specs: list,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    work_dir: Path,
) -> Path:
    try:
        return compile_typst_render_pages_pdf(
            background_pdf_path=background_pdf_path,
            page_specs=page_specs,
            stem="book-background-overlay",
            font_family=font_family,
            font_paths=font_paths,
            work_dir=work_dir,
        )
    except RuntimeError as exc:
        print("typst background render compile failed; sanitizing pages", flush=True)
        print(str(exc), flush=True)
        background_page_specs = collect_background_page_specs(source_pdf_path, translated_pages)
        sanitized_background_specs = sanitize_page_specs_for_typst_book_background(
            background_page_specs,
            stem="book-background-overlay",
            api_key=api_key,
            model=model,
            base_url=base_url,
            font_family=font_family,
            font_paths=font_paths,
            work_dir=work_dir,
        )
        sanitized_pages = {page_idx: items for page_idx, _w, _h, items in sanitized_background_specs}
        sanitized_render_page_specs = build_render_page_specs(
            source_pdf_path=source_pdf_path,
            translated_pages=sanitized_pages,
        )
        return compile_typst_render_pages_pdf(
            background_pdf_path=background_pdf_path,
            page_specs=sanitized_render_page_specs,
            stem="book-background-overlay-sanitized",
            font_family=font_family,
            font_paths=font_paths,
            work_dir=work_dir,
        )


def build_single_page_typst_pdf(
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_items: list[dict],
    page_idx: int,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    temp_root: Path | None = None,
    cover_only: bool = False,
) -> None:
    prepared_items = prepare_single_page_items(translated_items, page_idx)
    source_doc = fitz.open(source_pdf_path)
    temp_doc = fitz.open()
    temp_doc.insert_pdf(source_doc, from_page=page_idx, to_page=page_idx)
    page = temp_doc[0]
    strip_page_links(page)
    overlay_translated_items_on_page(
        page,
        prepared_items,
        stem=f"page-{page_idx + 1}",
        api_key=api_key,
        model=model,
        base_url=base_url,
        font_family=font_family,
        font_paths=font_paths,
        temp_root=resolve_typst_temp_root(output_pdf_path, temp_root),
        cover_only=cover_only,
    )
    save_optimized_pdf(temp_doc, output_pdf_path)
    temp_doc.close()
    source_doc.close()


def build_book_typst_pdf(
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    compile_workers: int | None = None,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    temp_root: Path | None = None,
    cover_only: bool = False,
) -> None:
    doc = _build_overlay_base_doc(source_pdf_path)
    try:
        typst_temp_root = resolve_typst_temp_root(output_pdf_path, temp_root)
        overlay_translated_pages_on_doc(
            doc,
            translated_pages,
            stem="book-overlay",
            compile_workers=compile_workers,
            api_key=api_key,
            model=model,
            base_url=base_url,
            font_family=font_family,
            font_paths=font_paths,
            temp_root=typst_temp_root,
            cover_only=cover_only,
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
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    temp_root: Path | None = None,
    cover_only: bool = False,
) -> None:
    source_doc = fitz.open(source_pdf_path)
    translated_doc = fitz.open(source_pdf_path)
    dual_doc = fitz.open()
    try:
        typst_temp_root = resolve_typst_temp_root(output_pdf_path, temp_root)
        overlay_translated_pages_on_doc(
            translated_doc,
            translated_pages,
            stem="book-overlay-dual",
            compile_workers=compile_workers,
            api_key=api_key,
            model=model,
            base_url=base_url,
            font_family=font_family,
            font_paths=font_paths,
            temp_root=typst_temp_root,
            cover_only=cover_only,
        )
        build_dual_doc_pages(
            source_doc,
            translated_doc,
            dual_doc,
            start_page=start_page,
            end_page=end_page,
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
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    temp_root: Path | None = None,
) -> None:
    work_dir = prepare_background_work_dir(output_pdf_path, temp_root)
    page_specs = build_render_page_specs(
        source_pdf_path=source_pdf_path,
        translated_pages=translated_pages,
    )
    cleaned_background_pdf = build_clean_background_pdf(
        source_pdf_path=source_pdf_path,
        translated_pages=translated_pages,
        output_pdf_path=work_dir / "book-background-cleaned.pdf",
    )
    background_pdf = _compile_render_pages_pdf_resilient(
        source_pdf_path=source_pdf_path,
        background_pdf_path=cleaned_background_pdf,
        translated_pages=translated_pages,
        page_specs=page_specs,
        api_key=api_key,
        model=model,
        base_url=base_url,
        font_family=font_family,
        font_paths=font_paths,
        work_dir=work_dir,
    )
    save_background_pdf_to_output(background_pdf, output_pdf_path)
