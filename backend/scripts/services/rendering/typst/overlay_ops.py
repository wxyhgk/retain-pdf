from __future__ import annotations

from pathlib import Path
import time

import fitz

from foundation.config import fonts
from services.rendering.api.render_payloads import prepare_render_payloads_by_page
from services.rendering.typst.color_adapt import apply_adaptive_overlay_colors
from services.rendering.typst.compiler import TypstCompileError
from services.rendering.typst.overlay_book import build_overlay_page_specs
from services.rendering.typst.overlay_book import overlay_pages_via_page_fallback
from services.rendering.typst.overlay_book import prepare_overlay_doc_pages
from services.rendering.typst.overlay_book import sanitize_overlay_page_specs
from services.rendering.typst.overlay_compile import compile_book_overlay_pdf
from services.rendering.typst.overlay_compile import compile_page_overlay_pdf
from services.rendering.typst.page_ops import apply_source_page_overlay
from services.rendering.typst.page_ops import mark_image_page_overlay_mode
from services.rendering.typst.page_ops import overlay_pages_from_single_pdf


def overlay_translated_items_on_page(
    page: fitz.Page,
    translated_items: list[dict],
    stem: str,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    temp_root: Path | None = None,
    cover_only: bool = False,
    apply_source_overlay: bool = True,
    redaction_strategy: str | None = None,
) -> None:
    translated_items = mark_image_page_overlay_mode(page, translated_items)
    if apply_source_overlay:
        apply_source_page_overlay(
            page,
            translated_items,
            cover_only=cover_only,
            redaction_strategy=redaction_strategy,
        )
    overlay_pdf = compile_page_overlay_pdf(
        page.rect.width,
        page.rect.height,
        translated_items,
        stem=stem,
        api_key=api_key,
        model=model,
        base_url=base_url,
        font_family=font_family,
        include_cover_rect=False,
        font_paths=font_paths,
        temp_root=temp_root,
        work_subdir="single-page",
    )
    overlay_doc = fitz.open(overlay_pdf)
    try:
        page.show_pdf_page(page.rect, overlay_doc, 0, overlay=True)
    finally:
        overlay_doc.close()


def overlay_translated_pages_on_doc(
    doc: fitz.Document,
    translated_pages: dict[int, list[dict]],
    stem: str,
    compile_workers: int | None = None,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    temp_root: Path | None = None,
    cover_only: bool = False,
    apply_source_overlay: bool = True,
    redaction_strategy: str | None = None,
) -> dict[str, object]:
    translated_pages = prepare_render_payloads_by_page(translated_pages)
    ordered_page_indices, translated_pages = prepare_overlay_doc_pages(doc, translated_pages)
    if not ordered_page_indices:
        return {
            "compile_elapsed_seconds": 0.0,
            "sanitize_elapsed_seconds": 0.0,
            "source_overlay_elapsed_seconds": 0.0,
            "overlay_merge_elapsed_seconds": 0.0,
            "raw_removable_rects": 0,
            "merged_removable_rects": 0,
            "cover_rects": 0,
            "item_fast_cover_count": 0,
            "fast_page_cover_pages": 0,
            "page_count": 0,
            "mode": "empty",
            "pages": [],
            "compile_errors": [],
            "sanitize_page_diagnostics": [],
        }

    translated_pages = {
        page_idx: apply_adaptive_overlay_colors(doc[page_idx], translated_pages[page_idx])
        for page_idx in ordered_page_indices
    }
    page_specs = build_overlay_page_specs(doc, ordered_page_indices, translated_pages, stem=stem)
    book_specs = [(page_width, page_height, items) for _, page_width, page_height, items, _ in page_specs]
    compile_started = time.perf_counter()
    try:
        overlay_pdf = compile_book_overlay_pdf(
            book_specs,
            stem=stem,
            font_family=font_family,
            font_paths=font_paths,
            temp_root=temp_root,
        )
        diagnostics = overlay_pages_from_single_pdf(
            doc,
            ordered_page_indices,
            translated_pages,
            overlay_pdf,
            cover_only=cover_only,
            apply_source_overlay=apply_source_overlay,
            redaction_strategy=redaction_strategy,
        )
        diagnostics["compile_elapsed_seconds"] = time.perf_counter() - compile_started
        diagnostics["sanitize_elapsed_seconds"] = 0.0
        diagnostics["page_count"] = len(ordered_page_indices)
        diagnostics["mode"] = "book_overlay"
        diagnostics.setdefault("compile_errors", [])
        diagnostics.setdefault("sanitize_page_diagnostics", [])
        return diagnostics
    except RuntimeError as exc:
        first_compile_elapsed = time.perf_counter() - compile_started
        print("typst book compile failed; sanitizing pages before per-page fallback", flush=True)
        print(str(exc), flush=True)
        compile_errors = [exc.to_dict() if isinstance(exc, TypstCompileError) else str(exc)]

    sanitize_started = time.perf_counter()
    sanitize_page_diagnostics: list[dict] = []
    sanitized_book_specs, sanitized_translated_pages, sanitized_page_specs = sanitize_overlay_page_specs(
        page_specs,
        api_key=api_key,
        model=model,
        base_url=base_url,
        font_family=font_family,
        font_paths=font_paths,
        page_diagnostics=sanitize_page_diagnostics,
    )
    sanitize_elapsed = time.perf_counter() - sanitize_started
    sanitized_compile_started = time.perf_counter()
    try:
        overlay_pdf = compile_book_overlay_pdf(
            sanitized_book_specs,
            stem=stem,
            font_family=font_family,
            font_paths=font_paths,
            temp_root=temp_root,
        )
        diagnostics = overlay_pages_from_single_pdf(
            doc,
            ordered_page_indices,
            sanitized_translated_pages,
            overlay_pdf,
            cover_only=cover_only,
            apply_source_overlay=apply_source_overlay,
            redaction_strategy=redaction_strategy,
        )
        diagnostics["compile_elapsed_seconds"] = first_compile_elapsed + (time.perf_counter() - sanitized_compile_started)
        diagnostics["sanitize_elapsed_seconds"] = sanitize_elapsed
        diagnostics["page_count"] = len(ordered_page_indices)
        diagnostics["mode"] = "book_overlay_sanitized"
        diagnostics["compile_errors"] = compile_errors
        diagnostics["sanitize_page_diagnostics"] = sanitize_page_diagnostics
        return diagnostics
    except RuntimeError as exc:
        print("typst sanitized book compile failed; falling back to per-page compilation", flush=True)
        print(str(exc), flush=True)
        compile_errors.append(exc.to_dict() if isinstance(exc, TypstCompileError) else str(exc))

    diagnostics = overlay_pages_via_page_fallback(
        doc,
        ordered_page_indices,
        sanitized_page_specs,
        sanitized_translated_pages,
        compile_workers=compile_workers,
        api_key=api_key,
        model=model,
        base_url=base_url,
        font_family=font_family,
        font_paths=font_paths,
        temp_root=temp_root,
        cover_only=cover_only,
        apply_source_overlay=apply_source_overlay,
        redaction_strategy=redaction_strategy,
    )
    diagnostics["compile_elapsed_seconds"] = first_compile_elapsed + diagnostics.get("page_overlay_compile_elapsed_seconds", 0.0)
    diagnostics["sanitize_elapsed_seconds"] = sanitize_elapsed
    diagnostics["page_count"] = len(ordered_page_indices)
    diagnostics["mode"] = "page_overlay_fallback"
    diagnostics["compile_errors"] = compile_errors
    diagnostics["sanitize_page_diagnostics"] = sanitize_page_diagnostics
    return diagnostics
