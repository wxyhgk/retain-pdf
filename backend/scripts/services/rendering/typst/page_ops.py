from __future__ import annotations

from pathlib import Path

import fitz

from services.rendering.api.background_image_route import replace_background_image_page
from services.rendering.api.pdf_overlay import redact_translated_text_areas
from services.rendering.api.pdf_overlay import strip_page_links
from services.rendering.redaction.redaction_analysis import page_has_large_background_image


def mark_image_page_overlay_mode(page: fitz.Page, translated_items: list[dict]) -> list[dict]:
    if not translated_items:
        return translated_items
    if not page_has_large_background_image(page):
        return translated_items
    return translated_items


def should_redact_source_page(page: fitz.Page) -> bool:
    return not page_has_large_background_image(page)


def apply_source_page_overlay(
    page: fitz.Page,
    translated_items: list[dict],
    *,
    cover_only: bool = False,
) -> None:
    strip_page_links(page)
    if should_redact_source_page(page):
        redact_translated_text_areas(page, translated_items, cover_only=cover_only)
    else:
        replace_background_image_page(page, translated_items)


def overlay_pages_from_single_pdf(
    doc: fitz.Document,
    ordered_page_indices: list[int],
    translated_pages: dict[int, list[dict]],
    overlay_pdf_path: Path,
    *,
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
            apply_source_page_overlay(page, translated_pages[page_idx], cover_only=cover_only)
            page.show_pdf_page(page.rect, overlay_doc, overlay_page_idx, overlay=True)
    finally:
        overlay_doc.close()
