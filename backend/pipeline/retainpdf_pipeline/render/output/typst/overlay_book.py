from __future__ import annotations

from pathlib import Path
import time
from typing import Callable

import fitz

from retainpdf_pipeline.foundation.config import fonts
from retainpdf_pipeline.foundation.config import paths
from retainpdf_pipeline.render.document.pikepdf_overlay import overlay_page_pdfs_with_pikepdf
from retainpdf_pipeline.render.output.typst.overlay_diagnostics import apply_merge_elapsed
from retainpdf_pipeline.render.output.typst.overlay_diagnostics import apply_redaction_diagnostics
from retainpdf_pipeline.render.output.typst.overlay_diagnostics import new_overlay_merge_diagnostics
from retainpdf_pipeline.render.output.typst.page_compile import compile_overlay_page_specs
from retainpdf_pipeline.render.output.typst.source_page_overlay import apply_source_page_overlay
from retainpdf_pipeline.render.output.typst.sanitize import sanitize_page_specs_for_typst_book_overlay
from retainpdf_pipeline.services.pipeline_shared.events import emit_render_page_progress

TypstRepairRequestFn = Callable[..., str]


def prepare_overlay_doc_pages(
    doc: fitz.Document,
    translated_pages: dict[int, list[dict]],
) -> tuple[list[int], dict[int, list[dict]]]:
    ordered_page_indices = sorted(page_idx for page_idx in translated_pages if 0 <= page_idx < len(doc))
    if not ordered_page_indices:
        return [], translated_pages
    return ordered_page_indices, translated_pages


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
    apply_source_overlay: bool = True,
    redaction_strategy: str | None = None,
    source_base_pdf_path: Path | None = None,
    pikepdf_output_pdf_path: Path | None = None,
    visual_profile_path: Path | None = None,
    request_chat_content_fn: TypstRepairRequestFn | None = None,
) -> dict[str, object]:
    overlay_paths, page_compile_diagnostics, compile_elapsed = compile_overlay_page_specs(
        page_specs,
        compile_workers=compile_workers,
        api_key=api_key,
        model=model,
        base_url=base_url,
        font_family=font_family,
        font_paths=font_paths,
        temp_root=temp_root,
        request_chat_content_fn=request_chat_content_fn,
    )
    diagnostics = new_overlay_merge_diagnostics()
    diagnostics["page_overlay_compile_elapsed_seconds"] = compile_elapsed
    total_pages = len(ordered_page_indices)
    if not apply_source_overlay and source_base_pdf_path is not None and pikepdf_output_pdf_path is not None:
        page_diagnostics: list[dict[str, object]] = []
        for overlay_page_idx, page_idx in enumerate(ordered_page_indices):
            print(
                f"overlay merge page {overlay_page_idx + 1}/{total_pages} -> source page {page_idx + 1}",
                flush=True,
            )
            emit_render_page_progress(
                current=overlay_page_idx + 1,
                total=total_pages,
                message=f"正在渲染第 {overlay_page_idx + 1}/{total_pages} 页",
                payload={"page_index": page_idx, "render_stage": "page_overlay_pikepdf"},
            )
            page_diag = {
                "page_index": page_idx,
                "source_overlay_elapsed_seconds": 0.0,
                "overlay_merge_elapsed_seconds": 0.0,
                "route": "page_overlay_pikepdf",
                "strategy": "prepared_source",
                "source_overlay_mode": "prepared_source_pdf",
            }
            compile_diag = page_compile_diagnostics.get(page_idx)
            if compile_diag is not None:
                diagnostics["page_compile_diagnostics"].append(compile_diag)
            page_diagnostics.append(page_diag)
        pike_result = overlay_page_pdfs_with_pikepdf(
            source_pdf_path=source_base_pdf_path,
            overlay_paths_by_page_index={page_idx: overlay_paths[page_idx] for page_idx in ordered_page_indices},
            output_pdf_path=pikepdf_output_pdf_path,
        )
        per_page_elapsed = pike_result.elapsed_seconds / max(pike_result.pages_merged, 1)
        for page_diag in page_diagnostics:
            apply_merge_elapsed(diagnostics, page_diag, per_page_elapsed)
            diagnostics["pages"].append(page_diag)
        diagnostics["mode"] = "page_overlay_fallback_pikepdf"
        diagnostics["pikepdf_overlay_output_pdf_path"] = str(pike_result.output_pdf_path)
        diagnostics["pikepdf_overlay_pages"] = pike_result.pages_merged
        diagnostics["pikepdf_overlay_elapsed_seconds"] = pike_result.elapsed_seconds
        return diagnostics
    for overlay_page_idx, page_idx in enumerate(ordered_page_indices):
        print(
            f"overlay merge page {overlay_page_idx + 1}/{total_pages} -> source page {page_idx + 1}",
            flush=True,
        )
        emit_render_page_progress(
            current=overlay_page_idx + 1,
            total=total_pages,
            message=f"正在渲染第 {overlay_page_idx + 1}/{total_pages} 页",
            payload={"page_index": page_idx, "render_stage": "book_overlay"},
        )
        page = doc[page_idx]
        page_diag = {
            "page_index": page_idx,
            "source_overlay_elapsed_seconds": 0.0,
            "overlay_merge_elapsed_seconds": 0.0,
        }
        compile_diag = page_compile_diagnostics.get(page_idx)
        if compile_diag is not None:
            diagnostics["page_compile_diagnostics"].append(compile_diag)
        if apply_source_overlay:
            redaction = apply_source_page_overlay(
                page,
                translated_pages[page_idx],
                cover_only=cover_only,
                redaction_strategy=redaction_strategy,
                visual_profile_path=visual_profile_path,
            )
            apply_redaction_diagnostics(diagnostics, page_diag, redaction)
        overlay_doc = fitz.open(overlay_paths[page_idx])
        try:
            merge_started = time.perf_counter()
            page.show_pdf_page(page.rect, overlay_doc, 0, overlay=True)
            merge_elapsed = time.perf_counter() - merge_started
            apply_merge_elapsed(diagnostics, page_diag, merge_elapsed)
        finally:
            overlay_doc.close()
        diagnostics["pages"].append(page_diag)
    return diagnostics


def sanitize_overlay_page_specs(
    page_specs: list[tuple[int, float, float, list[dict], str]],
    *,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    temp_root: Path | None = None,
    page_diagnostics: list[dict] | None = None,
    overlay_indices: set[int] | None = None,
    request_chat_content_fn: TypstRepairRequestFn | None = None,
) -> tuple[list[tuple[int, float, float, list[dict]]], dict[int, list[dict]], list[tuple[int, float, float, list[dict], str]]]:
    sanitized_page_specs = sanitize_page_specs_for_typst_book_overlay(
        page_specs,
        api_key=api_key,
        model=model,
        base_url=base_url,
        font_family=font_family,
        font_paths=font_paths,
        work_dir=(temp_root or paths.OUTPUT_DIR) / "book-sanitize",
        page_diagnostics=page_diagnostics,
        overlay_indices=overlay_indices,
        request_chat_content_fn=request_chat_content_fn,
    )
    sanitized_book_specs = [
        (page_width, page_height, items) for _, page_width, page_height, items, _ in sanitized_page_specs
    ]
    sanitized_translated_pages = {page_idx: items for page_idx, _w, _h, items, _stem in sanitized_page_specs}
    return sanitized_book_specs, sanitized_translated_pages, sanitized_page_specs
