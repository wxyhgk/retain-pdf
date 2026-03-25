from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import fitz

from config import fonts
from config import paths
from rendering.pdf_overlay import redact_translated_text_areas
from rendering.pdf_overlay import strip_page_links
from rendering.render_payloads import prepare_render_payloads_by_page
from rendering.typst_renderer.compiler import compile_typst_book_overlay_pdf
from rendering.typst_renderer.sanitize import compile_overlay_pdf_resilient
from rendering.typst_renderer.shared import default_compile_workers
from rendering.typst_renderer.shared import prepare_typst_work_dir


def overlay_translated_items_on_page(
    page: fitz.Page,
    translated_items: list[dict],
    stem: str,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    temp_root: Path | None = None,
    cover_only: bool = False,
) -> None:
    redact_translated_text_areas(page, translated_items, cover_only=cover_only)
    base_dir = temp_root or paths.OUTPUT_DIR
    base_dir.mkdir(parents=True, exist_ok=True)
    work_dir = prepare_typst_work_dir(base_dir, "single-page", stem)
    overlay_pdf = compile_overlay_pdf_resilient(
        page.rect.width,
        page.rect.height,
        translated_items,
        stem=stem,
        font_family=font_family,
        font_paths=font_paths,
        work_dir=work_dir,
    )
    overlay_doc = fitz.open(overlay_pdf)
    try:
        page.show_pdf_page(page.rect, overlay_doc, 0, overlay=True)
    finally:
        overlay_doc.close()


def _compile_overlay_with_fallback(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    stem: str,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    temp_root: Path | None = None,
) -> Path:
    base_dir = temp_root or paths.OUTPUT_DIR
    base_dir.mkdir(parents=True, exist_ok=True)
    work_dir = prepare_typst_work_dir(base_dir, "page-overlays", stem)
    return compile_overlay_pdf_resilient(
        page_width,
        page_height,
        translated_items,
        stem=stem,
        font_family=font_family,
        font_paths=font_paths,
        work_dir=work_dir,
    )


def _compile_book_overlay_with_fallback(
    page_specs: list[tuple[float, float, list[dict]]],
    stem: str,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    temp_root: Path | None = None,
) -> Path:
    base_dir = temp_root or paths.OUTPUT_DIR
    base_dir.mkdir(parents=True, exist_ok=True)
    # Keep book-level overlay artifacts directly under `typst/book-overlays/`
    # so each job only has one stable overlay location instead of an extra
    # nested `<stem>/` directory.
    work_dir = prepare_typst_work_dir(base_dir, "book-overlays")
    return compile_typst_book_overlay_pdf(
        page_specs,
        stem=stem,
        font_family=font_family,
        font_paths=font_paths,
        work_dir=work_dir,
    )


def _overlay_pages_from_single_pdf(
    doc: fitz.Document,
    ordered_page_indices: list[int],
    translated_pages: dict[int, list[dict]],
    overlay_pdf_path: Path,
    cover_only: bool = False,
) -> None:
    overlay_doc = fitz.open(overlay_pdf_path)
    try:
        total_pages = len(ordered_page_indices)
        for overlay_page_idx, page_idx in enumerate(ordered_page_indices):
            print(
                f"overlay merge page {overlay_page_idx + 1}/{total_pages} -> source page {page_idx + 1}",
                flush=True,
            )
            page = doc[page_idx]
            strip_page_links(page)
            redact_translated_text_areas(page, translated_pages[page_idx], cover_only=cover_only)
            page.show_pdf_page(page.rect, overlay_doc, overlay_page_idx, overlay=True)
    finally:
        overlay_doc.close()


def _overlay_pages_via_page_fallback(
    doc: fitz.Document,
    ordered_page_indices: list[int],
    page_specs: list[tuple[int, float, float, list[dict], str]],
    translated_pages: dict[int, list[dict]],
    compile_workers: int | None = None,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    temp_root: Path | None = None,
    cover_only: bool = False,
) -> None:
    overlay_paths: dict[int, Path] = {}
    max_workers = compile_workers or default_compile_workers(len(page_specs))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {
            executor.submit(
                _compile_overlay_with_fallback,
                page_width,
                page_height,
                items,
                page_stem,
                font_family,
                font_paths,
                temp_root,
            ): page_idx
            for page_idx, page_width, page_height, items, page_stem in page_specs
        }
        for future in as_completed(future_map):
            page_idx = future_map[future]
            overlay_paths[page_idx] = future.result()

    total_pages = len(ordered_page_indices)
    for overlay_page_idx, page_idx in enumerate(ordered_page_indices):
        print(
            f"overlay merge page {overlay_page_idx + 1}/{total_pages} -> source page {page_idx + 1}",
            flush=True,
        )
        page = doc[page_idx]
        strip_page_links(page)
        redact_translated_text_areas(page, translated_pages[page_idx], cover_only=cover_only)
        overlay_doc = fitz.open(overlay_paths[page_idx])
        try:
            page.show_pdf_page(page.rect, overlay_doc, 0, overlay=True)
        finally:
            overlay_doc.close()


def overlay_translated_pages_on_doc(
    doc: fitz.Document,
    translated_pages: dict[int, list[dict]],
    stem: str,
    compile_workers: int | None = None,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    temp_root: Path | None = None,
    cover_only: bool = False,
) -> None:
    translated_pages = prepare_render_payloads_by_page(translated_pages)
    ordered_page_indices = sorted(page_idx for page_idx in translated_pages if 0 <= page_idx < len(doc))
    if not ordered_page_indices:
        return

    page_specs: list[tuple[int, float, float, list[dict], str]] = []
    for overlay_idx, page_idx in enumerate(ordered_page_indices):
        page = doc[page_idx]
        page_specs.append(
            (page_idx, page.rect.width, page.rect.height, translated_pages[page_idx], f"{stem}-{overlay_idx:03d}")
        )
    book_specs = [(page_width, page_height, items) for _, page_width, page_height, items, _ in page_specs]
    try:
        overlay_pdf = _compile_book_overlay_with_fallback(
            book_specs,
            stem=stem,
            font_family=font_family,
            font_paths=font_paths,
            temp_root=temp_root,
        )
        _overlay_pages_from_single_pdf(
            doc,
            ordered_page_indices,
            translated_pages,
            overlay_pdf,
            cover_only=cover_only,
        )
    except RuntimeError:
        print("typst book compile failed; falling back to per-page compilation")
        _overlay_pages_via_page_fallback(
            doc,
            ordered_page_indices,
            page_specs,
            translated_pages,
            compile_workers=compile_workers,
            font_family=font_family,
            font_paths=font_paths,
            temp_root=temp_root,
            cover_only=cover_only,
        )
