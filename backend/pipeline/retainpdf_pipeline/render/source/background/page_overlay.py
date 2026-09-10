from __future__ import annotations

import time
import os
from pathlib import Path

import fitz

from retainpdf_pipeline.services.pipeline_shared.events import emit_render_page_progress
from retainpdf_pipeline.render.source.background.fill import draw_white_covers
from retainpdf_pipeline.render.source.text_redaction import remove_text_under_rects_with_pymupdf_redaction
from retainpdf_pipeline.render.source.vector_profile import page_drawing_count
from retainpdf_pipeline.render.source.vector_profile import page_is_vector_heavy_count
from retainpdf_pipeline.render.source.rects import merge_rects
from retainpdf_pipeline.render.source.background.source_overlay import apply_source_page_overlay
from retainpdf_pipeline.render.document.pikepdf_overlay import overlay_pdf_pages_with_pikepdf
from retainpdf_pipeline.render.output.typst.overlay_diagnostics import apply_merge_elapsed
from retainpdf_pipeline.render.output.typst.overlay_diagnostics import apply_redaction_diagnostics
from retainpdf_pipeline.render.output.typst.overlay_diagnostics import new_overlay_merge_diagnostics
from retainpdf_pipeline.render.visual_profile import VisualProfileRuntime
from retainpdf_pipeline.render.visual_profile import load_visual_profile_runtime


PAGE_SIZE_MISMATCH_TOLERANCE_PT = 0.5


def _overlay_visual_cover_enabled() -> bool:
    value = os.environ.get("RETAIN_PDF_OVERLAY_VISUAL_COVER", "").strip().lower()
    if not value:
        return True
    return value not in {"0", "false", "no", "off"}


def _page_size_matches(source_page: fitz.Page, overlay_page: fitz.Page) -> bool:
    return (
        abs(float(source_page.rect.width) - float(overlay_page.rect.width)) <= PAGE_SIZE_MISMATCH_TOLERANCE_PT
        and abs(float(source_page.rect.height) - float(overlay_page.rect.height)) <= PAGE_SIZE_MISMATCH_TOLERANCE_PT
    )


def _page_size_diag(source_page: fitz.Page, overlay_page: fitz.Page) -> dict[str, object]:
    return {
        "source_page_width_pt": round(float(source_page.rect.width), 3),
        "source_page_height_pt": round(float(source_page.rect.height), 3),
        "overlay_page_width_pt": round(float(overlay_page.rect.width), 3),
        "overlay_page_height_pt": round(float(overlay_page.rect.height), 3),
    }


def _draw_overlay_visual_covers(
    page: fitz.Page,
    cleanup_items: list[dict],
    *,
    visual_profile: VisualProfileRuntime | None = None,
) -> tuple[int, int]:
    sampled_cover_rects: list[fitz.Rect] = []
    profile_cover_count = 0
    for item in cleanup_items:
        bbox = item.get("bbox", [])
        if len(bbox) != 4:
            continue
        rect = fitz.Rect(bbox)
        if rect.is_empty:
            continue
        fill = visual_profile.background_fill_for_item(item) if visual_profile is not None else None
        if fill is None:
            sampled_cover_rects.append(rect)
            continue
        shape = page.new_shape()
        shape.draw_rect(rect)
        shape.finish(color=None, fill=fill)
        shape.commit(overlay=True)
        profile_cover_count += 1
    merged = merge_rects(sampled_cover_rects)
    draw_white_covers(page, merged)
    return profile_cover_count + len(merged), profile_cover_count


def _can_use_pikepdf_single_pdf_overlay(
    *,
    apply_source_overlay: bool,
    remove_source_text_by_bbox: bool,
    source_text_precleaned_page_indices: frozenset[int],
    ordered_page_indices: list[int],
    skip_visual_cover: bool,
) -> bool:
    if apply_source_overlay or remove_source_text_by_bbox:
        return False
    if skip_visual_cover:
        return True
    return not _overlay_visual_cover_enabled()


def overlay_pages_from_single_pdf(
    doc: fitz.Document,
    ordered_page_indices: list[int],
    translated_pages: dict[int, list[dict]],
    overlay_pdf_path: Path,
    *,
    cover_only: bool = False,
    apply_source_overlay: bool = True,
    remove_source_text_by_bbox: bool = False,
    redaction_strategy: str | None = None,
    redaction_pages: dict[int, list[dict]] | None = None,
    source_text_precleaned_page_indices: frozenset[int] = frozenset(),
    skip_visual_cover: bool = False,
    source_base_pdf_path: Path | None = None,
    pikepdf_output_pdf_path: Path | None = None,
    visual_profile_path: Path | None = None,
) -> dict[str, object]:
    overlay_doc = fitz.open(overlay_pdf_path)
    diagnostics = new_overlay_merge_diagnostics()
    visual_profile = load_visual_profile_runtime(visual_profile_path)
    diagnostics["visual_profile_cover"] = dict(visual_profile.diagnostics)
    try:
        total_pages = len(ordered_page_indices)
        if (
            source_base_pdf_path is not None
            and pikepdf_output_pdf_path is not None
            and _can_use_pikepdf_single_pdf_overlay(
                apply_source_overlay=apply_source_overlay,
                remove_source_text_by_bbox=remove_source_text_by_bbox,
                source_text_precleaned_page_indices=source_text_precleaned_page_indices,
                ordered_page_indices=ordered_page_indices,
                skip_visual_cover=skip_visual_cover,
            )
        ):
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
                    payload={"page_index": page_idx, "render_stage": "single_pdf_overlay_pikepdf"},
                )
                page = doc[page_idx]
                page_diag = {
                    "page_index": page_idx,
                    "source_overlay_elapsed_seconds": 0.0,
                    "overlay_merge_elapsed_seconds": 0.0,
                    "items": 0,
                    "raw_removable_rects": 0,
                    "merged_removable_rects": 0,
                    "cover_rects": 0,
                    "fast_page_cover_only": False,
                    "item_fast_cover_count": 0,
                    "route": "single_pdf_overlay_pikepdf",
                    "strategy": "prepared_source",
                    "elapsed_seconds": 0.0,
                    "source_overlay_mode": "prepared_source_pdf",
                }
                if overlay_page_idx < len(overlay_doc):
                    overlay_page = overlay_doc[overlay_page_idx]
                    if not _page_size_matches(page, overlay_page):
                        page_diag.update(
                            {
                                "route": "overlay_page_size_mismatch",
                                "source_overlay_mode": "overlay_page_size_mismatch",
                                **_page_size_diag(page, overlay_page),
                            }
                        )
                        diagnostics["overlay_page_size_mismatch_pages"] = int(
                            diagnostics.get("overlay_page_size_mismatch_pages", 0) or 0
                        ) + 1
                page_diagnostics.append(page_diag)

            pike_result = overlay_pdf_pages_with_pikepdf(
                source_pdf_path=source_base_pdf_path,
                overlay_pdf_path=overlay_pdf_path,
                output_pdf_path=pikepdf_output_pdf_path,
                source_page_indices=ordered_page_indices,
            )
            per_page_elapsed = pike_result.elapsed_seconds / max(pike_result.pages_merged, 1)
            for page_diag in page_diagnostics:
                apply_merge_elapsed(diagnostics, page_diag, per_page_elapsed)
                diagnostics["pages"].append(page_diag)
            diagnostics["mode"] = "single_pdf_overlay_pikepdf"
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
                payload={"page_index": page_idx, "render_stage": "single_pdf_overlay"},
            )
            page = doc[page_idx]
            page_diag = {
                "page_index": page_idx,
                "source_overlay_elapsed_seconds": 0.0,
                "overlay_merge_elapsed_seconds": 0.0,
            }
            if apply_source_overlay:
                redaction = apply_source_page_overlay(
                    page,
                    translated_pages[page_idx],
                    cover_only=cover_only,
                    redaction_strategy=redaction_strategy,
                    redaction_items=(redaction_pages or {}).get(page_idx),
                )
                apply_redaction_diagnostics(diagnostics, page_diag, redaction)
            elif remove_source_text_by_bbox:
                cleanup_started = time.perf_counter()
                drawing_count = page_drawing_count(page)
                if page_is_vector_heavy_count(drawing_count):
                    cleanup_elapsed = time.perf_counter() - cleanup_started
                    page_diag.update(
                        {
                            "items": 0,
                            "raw_removable_rects": 0,
                            "merged_removable_rects": 0,
                            "cover_rects": 0,
                            "fast_page_cover_only": False,
                            "item_fast_cover_count": 0,
                            "route": "bbox_text_layer_cleanup_skipped_vector_heavy",
                            "strategy": "text_layer_only",
                            "elapsed_seconds": cleanup_elapsed,
                            "source_overlay_mode": "bbox_text_layer_cleanup_skipped_vector_heavy",
                            "page_drawing_count": drawing_count,
                            "uses_pymupdf_redaction": False,
                            "legacy_pdf_write_reason": "pymupdf_show_pdf_page_overlay",
                        }
                    )
                    diagnostics["source_overlay_elapsed_seconds"] = float(
                        diagnostics.get("source_overlay_elapsed_seconds", 0.0) or 0.0
                    ) + cleanup_elapsed
                    diagnostics["bbox_text_cleanup_skipped_vector_heavy_pages"] = int(
                        diagnostics.get("bbox_text_cleanup_skipped_vector_heavy_pages", 0) or 0
                    ) + 1
                    diagnostics["bbox_text_cleanup_skipped_vector_heavy_drawings"] = int(
                        diagnostics.get("bbox_text_cleanup_skipped_vector_heavy_drawings", 0) or 0
                    ) + drawing_count
                    diagnostics["pages"].append(page_diag)
                    merge_started = time.perf_counter()
                    page.show_pdf_page(page.rect, overlay_doc, overlay_page_idx, overlay=True)
                    merge_elapsed = time.perf_counter() - merge_started
                    apply_merge_elapsed(diagnostics, page_diag, merge_elapsed)
                    diagnostics["legacy_pymupdf_overlay_pages"] = int(
                        diagnostics.get("legacy_pymupdf_overlay_pages", 0) or 0
                    ) + 1
                    reasons = diagnostics.setdefault("legacy_pdf_write_reasons", {})
                    if isinstance(reasons, dict):
                        reasons["pymupdf_show_pdf_page_overlay"] = int(
                            reasons.get("pymupdf_show_pdf_page_overlay", 0) or 0
                        ) + 1
                    continue

                cleanup_items = (redaction_pages or {}).get(page_idx) or translated_pages[page_idx]
                cleanup_rects = []
                for item in cleanup_items:
                    bbox = item.get("bbox", [])
                    if len(bbox) != 4:
                        continue
                    rect = fitz.Rect(bbox)
                    if not rect.is_empty:
                        cleanup_rects.append(rect)
                merged_rects = merge_rects(cleanup_rects)
                remove_text_under_rects_with_pymupdf_redaction(page, merged_rects)
                cleanup_elapsed = time.perf_counter() - cleanup_started
                page_diag.update(
                    {
                        "items": len(cleanup_rects),
                        "raw_removable_rects": len(cleanup_rects),
                        "merged_removable_rects": len(merged_rects),
                        "cover_rects": 0,
                        "fast_page_cover_only": False,
                        "item_fast_cover_count": 0,
                        "route": "bbox_text_layer_cleanup",
                        "strategy": "text_layer_only",
                        "elapsed_seconds": cleanup_elapsed,
                        "source_overlay_mode": "bbox_text_layer_cleanup",
                        "page_drawing_count": drawing_count,
                        "uses_pymupdf_redaction": bool(merged_rects),
                        "legacy_pdf_write_reason": "bbox_text_layer_cleanup" if merged_rects else "",
                    }
                )
                diagnostics["source_overlay_elapsed_seconds"] = float(
                    diagnostics.get("source_overlay_elapsed_seconds", 0.0) or 0.0
                ) + cleanup_elapsed
                diagnostics["raw_removable_rects"] = int(diagnostics.get("raw_removable_rects", 0) or 0) + len(cleanup_rects)
                diagnostics["merged_removable_rects"] = int(
                    diagnostics.get("merged_removable_rects", 0) or 0
                ) + len(merged_rects)
                diagnostics["bbox_text_cleanup_pages"] = int(
                    diagnostics.get("bbox_text_cleanup_pages", 0) or 0
                ) + 1
                if merged_rects:
                    diagnostics["legacy_pymupdf_redaction_pages"] = int(
                        diagnostics.get("legacy_pymupdf_redaction_pages", 0) or 0
                    ) + 1
                    reasons = diagnostics.setdefault("legacy_pdf_write_reasons", {})
                    if isinstance(reasons, dict):
                        reasons["bbox_text_layer_cleanup"] = int(reasons.get("bbox_text_layer_cleanup", 0) or 0) + 1
            elif skip_visual_cover:
                page_diag.update(
                    {
                        "items": 0,
                        "raw_removable_rects": 0,
                        "merged_removable_rects": 0,
                        "cover_rects": 0,
                        "fast_page_cover_only": False,
                        "item_fast_cover_count": 0,
                        "route": "typst_overlay_fill_skip_visual_cover",
                        "strategy": "typst_overlay_fill",
                        "elapsed_seconds": 0.0,
                        "source_overlay_mode": "typst_overlay_fill_skip_visual_cover",
                        "uses_pymupdf_redaction": False,
                        "legacy_pdf_write_reason": "",
                    }
                )
                diagnostics["typst_overlay_fill_cover_skipped_pages"] = int(
                    diagnostics.get("typst_overlay_fill_cover_skipped_pages", 0) or 0
                ) + 1
            elif _overlay_visual_cover_enabled():
                cleanup_started = time.perf_counter()
                cleanup_items = (redaction_pages or {}).get(page_idx) or translated_pages[page_idx]
                cover_count, profile_cover_count = _draw_overlay_visual_covers(
                    page,
                    cleanup_items,
                    visual_profile=visual_profile if visual_profile.loaded else None,
                )
                cleanup_elapsed = time.perf_counter() - cleanup_started
                page_diag.update(
                    {
                        "items": len(cleanup_items),
                        "raw_removable_rects": 0,
                        "merged_removable_rects": 0,
                        "cover_rects": cover_count,
                        "visual_profile_cover_rects": profile_cover_count,
                        "fast_page_cover_only": False,
                        "item_fast_cover_count": 0,
                        "route": "overlay_visual_cover",
                        "strategy": "visual_cover",
                        "elapsed_seconds": cleanup_elapsed,
                        "source_overlay_mode": "overlay_visual_cover",
                        "uses_pymupdf_redaction": False,
                        "legacy_pdf_write_reason": "",
                    }
                )
                diagnostics["source_overlay_elapsed_seconds"] = float(
                    diagnostics.get("source_overlay_elapsed_seconds", 0.0) or 0.0
                ) + cleanup_elapsed
                diagnostics["cover_rects"] = int(diagnostics.get("cover_rects", 0) or 0) + cover_count
                diagnostics["visual_profile_cover_rects"] = int(
                    diagnostics.get("visual_profile_cover_rects", 0) or 0
                ) + profile_cover_count
            merge_started = time.perf_counter()
            overlay_page = overlay_doc[overlay_page_idx]
            if not _page_size_matches(page, overlay_page):
                page_diag.update(
                    {
                        "route": "overlay_page_size_mismatch",
                        "source_overlay_mode": "overlay_page_size_mismatch",
                        **_page_size_diag(page, overlay_page),
                    }
                )
                diagnostics["overlay_page_size_mismatch_pages"] = int(
                    diagnostics.get("overlay_page_size_mismatch_pages", 0) or 0
                ) + 1
            page.show_pdf_page(page.rect, overlay_doc, overlay_page_idx, overlay=True)
            merge_elapsed = time.perf_counter() - merge_started
            apply_merge_elapsed(diagnostics, page_diag, merge_elapsed)
            diagnostics["legacy_pymupdf_overlay_pages"] = int(
                diagnostics.get("legacy_pymupdf_overlay_pages", 0) or 0
            ) + 1
            reasons = diagnostics.setdefault("legacy_pdf_write_reasons", {})
            if isinstance(reasons, dict):
                reasons["pymupdf_show_pdf_page_overlay"] = int(
                    reasons.get("pymupdf_show_pdf_page_overlay", 0) or 0
                ) + 1
            diagnostics["pages"].append(page_diag)
    finally:
        overlay_doc.close()
    return diagnostics
