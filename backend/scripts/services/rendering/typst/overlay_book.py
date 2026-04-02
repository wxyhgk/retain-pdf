from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import as_completed
from pathlib import Path

import fitz

from foundation.config import fonts
from foundation.config import paths
from services.rendering.typst.overlay_compile import compile_page_overlay_pdf
from services.rendering.typst.page_ops import apply_source_page_overlay
from services.rendering.typst.page_ops import mark_image_page_overlay_mode
from services.rendering.typst.page_ops import overlay_pages_from_single_pdf
from services.rendering.typst.sanitize import sanitize_page_specs_for_typst_book_overlay
from services.rendering.typst.shared import default_compile_workers


def prepare_overlay_doc_pages(
    doc: fitz.Document,
    translated_pages: dict[int, list[dict]],
) -> tuple[list[int], dict[int, list[dict]]]:
    ordered_page_indices = sorted(page_idx for page_idx in translated_pages if 0 <= page_idx < len(doc))
    if not ordered_page_indices:
        return [], translated_pages

    prepared_pages = dict(translated_pages)
    for page_idx in ordered_page_indices:
        prepared_pages[page_idx] = mark_image_page_overlay_mode(doc[page_idx], prepared_pages[page_idx])
    return ordered_page_indices, prepared_pages


def build_overlay_page_specs(
    doc: fitz.Document,
    ordered_page_indices: list[int],
    translated_pages: dict[int, list[dict]],
    *,
    stem: str,
) -> list[tuple[int, float, float, list[dict], str]]:
    page_specs: list[tuple[int, float, float, list[dict], str]] = []
    for overlay_idx, page_idx in enumerate(ordered_page_indices):
        page = doc[page_idx]
        page_specs.append(
            (page_idx, page.rect.width, page.rect.height, translated_pages[page_idx], f"{stem}-{overlay_idx:03d}")
        )
    return page_specs


def overlay_pages_via_page_fallback(
    doc: fitz.Document,
    ordered_page_indices: list[int],
    page_specs: list[tuple[int, float, float, list[dict], str]],
    translated_pages: dict[int, list[dict]],
    *,
    compile_workers: int | None = None,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
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
                compile_page_overlay_pdf,
                page_width=page_width,
                page_height=page_height,
                translated_items=items,
                stem=page_stem,
                api_key=api_key,
                model=model,
                base_url=base_url,
                font_family=font_family,
                font_paths=font_paths,
                temp_root=temp_root,
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
        apply_source_page_overlay(page, translated_pages[page_idx], cover_only=cover_only)
        overlay_doc = fitz.open(overlay_paths[page_idx])
        try:
            page.show_pdf_page(page.rect, overlay_doc, 0, overlay=True)
        finally:
            overlay_doc.close()


def sanitize_overlay_page_specs(
    page_specs: list[tuple[int, float, float, list[dict], str]],
    *,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    temp_root: Path | None = None,
) -> tuple[list[tuple[int, float, float, list[dict]]], dict[int, list[dict]], list[tuple[int, float, float, list[dict], str]]]:
    sanitized_page_specs = sanitize_page_specs_for_typst_book_overlay(
        page_specs,
        api_key=api_key,
        model=model,
        base_url=base_url,
        font_family=font_family,
        font_paths=font_paths,
        work_dir=(temp_root or paths.OUTPUT_DIR) / "book-sanitize",
    )
    sanitized_book_specs = [
        (page_width, page_height, items) for _, page_width, page_height, items, _ in sanitized_page_specs
    ]
    sanitized_translated_pages = {page_idx: items for page_idx, _w, _h, items, _stem in sanitized_page_specs}
    return sanitized_book_specs, sanitized_translated_pages, sanitized_page_specs
