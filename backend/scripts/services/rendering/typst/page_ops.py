from __future__ import annotations

import time
from pathlib import Path

import fitz

from services.rendering.api.background_image_route import replace_background_image_page
from services.rendering.api.pdf_overlay import redact_translated_text_areas
from services.rendering.api.pdf_overlay import strip_page_links
from services.rendering.redaction.shared import iter_valid_translated_items
from services.rendering.redaction.vector_text_cleanup import collect_vector_text_rects
from services.rendering.redaction.redaction_analysis import page_has_large_background_image


def mark_image_page_overlay_mode(page: fitz.Page, translated_items: list[dict]) -> list[dict]:
    if not translated_items:
        return translated_items
    if not page_has_large_background_image(page):
        return translated_items
    return translated_items


def should_redact_source_page(page: fitz.Page) -> bool:
    return not page_has_large_background_image(page)


def should_use_cover_only_for_vector_text(page: fitz.Page, translated_items: list[dict]) -> bool:
    target_rects = [rect for rect, _item, _translated_text in iter_valid_translated_items(translated_items)]
    if not target_rects:
        return False
    return bool(collect_vector_text_rects(page, target_rects))


def apply_source_page_overlay(
    page: fitz.Page,
    translated_items: list[dict],
    *,
    cover_only: bool = False,
) -> dict[str, object]:
    started = time.perf_counter()
    strip_page_links(page)
    if not should_redact_source_page(page):
        replace_background_image_page(page, translated_items)
        # Pseudo-scan pages can still carry visible vector text above the background image.
        # After patching the image itself, remove any touched source text within translated rects.
        redaction = redact_translated_text_areas(page, translated_items, cover_only=False)
        redaction["elapsed_seconds"] = time.perf_counter() - started
        redaction["source_overlay_mode"] = "background_image"
        return redaction

    vector_cover_only = should_use_cover_only_for_vector_text(page, translated_items)
    redaction = redact_translated_text_areas(page, translated_items, cover_only=cover_only or vector_cover_only)
    redaction["elapsed_seconds"] = time.perf_counter() - started
    redaction["source_overlay_mode"] = "cover_only" if (cover_only or vector_cover_only) else "standard"
    return redaction


def overlay_pages_from_single_pdf(
    doc: fitz.Document,
    ordered_page_indices: list[int],
    translated_pages: dict[int, list[dict]],
    overlay_pdf_path: Path,
    *,
    cover_only: bool = False,
    apply_source_overlay: bool = True,
) -> dict[str, object]:
    overlay_doc = fitz.open(overlay_pdf_path)
    diagnostics = {
        "pages": [],
        "source_overlay_elapsed_seconds": 0.0,
        "overlay_merge_elapsed_seconds": 0.0,
        "raw_removable_rects": 0,
        "merged_removable_rects": 0,
        "cover_rects": 0,
        "item_fast_cover_count": 0,
        "fast_page_cover_pages": 0,
    }
    try:
        total_pages = len(ordered_page_indices)
        for overlay_page_idx, page_idx in enumerate(ordered_page_indices):
            print(
                f"overlay merge page {overlay_page_idx + 1}/{total_pages} -> source page {page_idx + 1}",
                flush=True,
            )
            page = doc[page_idx]
            page_diag = {
                "page_index": page_idx,
                "source_overlay_elapsed_seconds": 0.0,
                "overlay_merge_elapsed_seconds": 0.0,
            }
            if apply_source_overlay:
                redaction = apply_source_page_overlay(page, translated_pages[page_idx], cover_only=cover_only)
                page_diag.update(redaction)
                diagnostics["source_overlay_elapsed_seconds"] += float(redaction.get("elapsed_seconds", 0.0) or 0.0)
                diagnostics["raw_removable_rects"] += int(redaction.get("raw_removable_rects", 0) or 0)
                diagnostics["merged_removable_rects"] += int(redaction.get("merged_removable_rects", 0) or 0)
                diagnostics["cover_rects"] += int(redaction.get("cover_rects", 0) or 0)
                diagnostics["item_fast_cover_count"] += int(redaction.get("item_fast_cover_count", 0) or 0)
                if bool(redaction.get("fast_page_cover_only")):
                    diagnostics["fast_page_cover_pages"] += 1
            merge_started = time.perf_counter()
            page.show_pdf_page(page.rect, overlay_doc, overlay_page_idx, overlay=True)
            merge_elapsed = time.perf_counter() - merge_started
            page_diag["overlay_merge_elapsed_seconds"] = merge_elapsed
            diagnostics["overlay_merge_elapsed_seconds"] += merge_elapsed
            diagnostics["pages"].append(page_diag)
    finally:
        overlay_doc.close()
    return diagnostics
