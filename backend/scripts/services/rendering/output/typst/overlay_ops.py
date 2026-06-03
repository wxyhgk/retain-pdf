from __future__ import annotations

from pathlib import Path
import time
from typing import Callable

import fitz

from foundation.config import fonts
from services.rendering.document.pikepdf_overlay import overlay_pdf_pages_with_pikepdf
from services.rendering.output.typst.compiler import TypstCompileError
from services.rendering.output.typst.book_support import prepare_translated_pages_for_render
from services.rendering.output.typst.overlay_book import build_overlay_page_specs
from services.rendering.output.typst.overlay_book import overlay_pages_via_page_fallback
from services.rendering.output.typst.overlay_book import prepare_overlay_doc_pages
from services.rendering.output.typst.overlay_book import sanitize_overlay_page_specs
from services.rendering.output.typst.overlay_compile import compile_book_overlay_pdf
from services.rendering.output.typst.overlay_compile import compile_page_overlay_pdf
from services.rendering.output.typst.overlay_color import apply_overlay_page_colors
from services.rendering.output.typst.overlay_diagnostics import new_overlay_merge_diagnostics
from services.rendering.output.typst.overlay_runtime import can_use_pikepdf_book_overlay
from services.rendering.output.typst.overlay_runtime import extract_failed_overlay_indices
from services.rendering.output.typst.overlay_runtime import FAST_PATCH_PAGE_THRESHOLD
from services.rendering.output.typst.overlay_runtime import overlay_pdf_size_mismatches
from services.rendering.output.typst.overlay_source_cache import resolve_prebuilt_overlay_source
from services.rendering.output.typst.source_page_overlay import apply_source_page_overlay
from services.rendering.output.typst.source_page_overlay import mark_image_page_overlay_mode
from services.rendering.output.typst.source_page_overlay import overlay_pages_from_single_pdf
from services.rendering.policy import apply_typst_cover_fallback_fields
from services.pipeline_shared.events import emit_render_compile_progress
from services.pipeline_shared.events import emit_render_page_progress


_can_use_pikepdf_book_overlay = can_use_pikepdf_book_overlay
_extract_failed_overlay_indices = extract_failed_overlay_indices
TypstRepairRequestFn = Callable[..., str]


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
    request_chat_content_fn: TypstRepairRequestFn | None = None,
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
        request_chat_content_fn=request_chat_content_fn,
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
    source_pdf_path: Path | None = None,
    first_line_indent_lookup: dict[str, float] | None = None,
    effective_inner_bbox_lookup: dict[str, list[float]] | None = None,
    source_text_precleaned_page_indices: frozenset[int] = frozenset(),
    prebuilt_source_path: Path | None = None,
    source_base_pdf_path: Path | None = None,
    color_sample_pdf_path: Path | None = None,
    precomputed_colors_by_item_id: dict[str, dict[str, tuple[float, float, float]]] | None = None,
    pikepdf_output_pdf_path: Path | None = None,
    source_cleanup_strategy: str = "typst_fill",
    extra_cover_fallback_page_indices: frozenset[int] = frozenset(),
    request_chat_content_fn: TypstRepairRequestFn | None = None,
) -> dict[str, object]:
    prepare_started = time.perf_counter()
    translated_pages = prepare_translated_pages_for_render(
        source_pdf_path,
        translated_pages,
        first_line_indent_lookup=first_line_indent_lookup,
        effective_inner_bbox_lookup=effective_inner_bbox_lookup,
        skip_policy_page_indices=source_text_precleaned_page_indices,
    )
    ordered_page_indices, translated_pages = prepare_overlay_doc_pages(doc, translated_pages)
    cover_fallback_page_indices = frozenset(
        page_idx
        for page_idx in ordered_page_indices
        if source_cleanup_strategy == "pikepdf_text_strip"
        and page_idx not in source_text_precleaned_page_indices
        and translated_pages.get(page_idx)
    )
    cover_fallback_page_indices = cover_fallback_page_indices | frozenset(
        page_idx
        for page_idx in extra_cover_fallback_page_indices
        if page_idx in ordered_page_indices and translated_pages.get(page_idx)
    )
    if cover_fallback_page_indices:
        translated_pages = apply_typst_cover_fallback_fields(
            translated_pages,
            cover_fallback_page_indices,
        )
    prepare_elapsed = time.perf_counter() - prepare_started
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

    color_started = time.perf_counter()
    if color_sample_pdf_path is not None:
        sample_doc = fitz.open(color_sample_pdf_path)
        try:
            translated_pages = apply_overlay_page_colors(
                sample_doc,
                ordered_page_indices,
                translated_pages,
                precomputed_colors_by_item_id=precomputed_colors_by_item_id,
            )
        finally:
            sample_doc.close()
    else:
        translated_pages = apply_overlay_page_colors(
            doc,
            ordered_page_indices,
            translated_pages,
            precomputed_colors_by_item_id=precomputed_colors_by_item_id,
        )
    color_elapsed = time.perf_counter() - color_started
    specs_started = time.perf_counter()
    page_specs = build_overlay_page_specs(doc, ordered_page_indices, translated_pages, stem=stem)
    book_specs = [(page_width, page_height, items) for _, page_width, page_height, items, _ in page_specs]
    specs_elapsed = time.perf_counter() - specs_started
    use_typst_overlay_fill_only = len(ordered_page_indices) >= FAST_PATCH_PAGE_THRESHOLD
    include_cover_rect_in_overlay = bool(cover_fallback_page_indices or use_typst_overlay_fill_only)
    active_prebuilt_source_path, source_prepare_elapsed = resolve_prebuilt_overlay_source(
        prebuilt_source_path=prebuilt_source_path,
        temp_root=temp_root,
        stem=stem,
        book_specs=book_specs,
        font_family=font_family,
        include_cover_rect=include_cover_rect_in_overlay,
    )
    compile_started = time.perf_counter()
    try:
        emit_render_compile_progress(
            current=1,
            total=4,
            message=f"正在编译整本 Typst overlay，共 {len(ordered_page_indices)} 页",
            payload={"render_stage": "typst_book_compile_start"},
        )
        overlay_pdf = compile_book_overlay_pdf(
            book_specs,
            stem=stem,
            font_family=font_family,
            include_cover_rect=include_cover_rect_in_overlay,
            font_paths=font_paths,
            temp_root=temp_root,
            prebuilt_source_path=active_prebuilt_source_path,
        )
        compile_elapsed = time.perf_counter() - compile_started
        emit_render_compile_progress(
            current=4,
            total=4,
            message=f"整本 Typst overlay 编译完成，共 {len(ordered_page_indices)} 页",
            payload={"render_stage": "typst_book_compile_done"},
        )
        page_size_mismatches = overlay_pdf_size_mismatches(doc, ordered_page_indices, overlay_pdf)
        if page_size_mismatches:
            print(
                f"typst book overlay page-size mismatch; using per-page fallback pages={len(page_size_mismatches)}",
                flush=True,
            )
            diagnostics = overlay_pages_via_page_fallback(
                doc,
                ordered_page_indices,
                page_specs,
                translated_pages,
                compile_workers=compile_workers,
                api_key=api_key,
                model=model,
                base_url=base_url,
                font_family=font_family,
                font_paths=font_paths,
                temp_root=temp_root,
                cover_only=cover_only,
                apply_source_overlay=False,
                redaction_strategy=redaction_strategy,
                source_base_pdf_path=source_base_pdf_path,
                pikepdf_output_pdf_path=pikepdf_output_pdf_path,
                request_chat_content_fn=request_chat_content_fn,
            )
            diagnostics["compile_elapsed_seconds"] = compile_elapsed
            diagnostics["sanitize_elapsed_seconds"] = 0.0
            diagnostics["page_count"] = len(ordered_page_indices)
            if diagnostics.get("mode") != "page_overlay_fallback_pikepdf":
                diagnostics["mode"] = "page_overlay_after_book_size_mismatch"
            diagnostics["typst_cover_blocks"] = False
            diagnostics["source_overlay_skipped_reason"] = "prepared_source_pdf"
            diagnostics["payload_prepare_elapsed_seconds"] = prepare_elapsed
            diagnostics["color_adapt_elapsed_seconds"] = color_elapsed
            diagnostics["page_specs_elapsed_seconds"] = specs_elapsed
            diagnostics["typst_cover_fallback_pages"] = sorted(cover_fallback_page_indices)
            diagnostics["typst_source_prepare_elapsed_seconds"] = source_prepare_elapsed
            diagnostics["typst_prebuilt_source_path"] = str(active_prebuilt_source_path or "")
            diagnostics["overlay_page_size_mismatches"] = page_size_mismatches
            diagnostics.setdefault("compile_errors", [])
            diagnostics.setdefault("sanitize_page_diagnostics", [])
            return diagnostics
        if (
            source_base_pdf_path is not None
            and pikepdf_output_pdf_path is not None
            and _can_use_pikepdf_book_overlay(
                apply_source_overlay=False,
                use_typst_overlay_fill_only=use_typst_overlay_fill_only,
                source_cleanup_strategy=source_cleanup_strategy,
                source_text_precleaned_page_indices=source_text_precleaned_page_indices,
                ordered_page_indices=ordered_page_indices,
                translated_pages=translated_pages,
            )
        ):
            merge_started = time.perf_counter()
            pike_result = overlay_pdf_pages_with_pikepdf(
                source_pdf_path=source_base_pdf_path,
                overlay_pdf_path=overlay_pdf,
                output_pdf_path=pikepdf_output_pdf_path,
                source_page_indices=ordered_page_indices,
            )
            merge_elapsed = time.perf_counter() - merge_started
            diagnostics = new_overlay_merge_diagnostics()
            diagnostics["compile_elapsed_seconds"] = compile_elapsed
            diagnostics["sanitize_elapsed_seconds"] = 0.0
            diagnostics["source_overlay_elapsed_seconds"] = 0.0
            diagnostics["overlay_merge_elapsed_seconds"] = merge_elapsed
            diagnostics["page_count"] = len(ordered_page_indices)
            diagnostics["mode"] = "book_overlay_pikepdf"
            diagnostics["typst_cover_blocks"] = False
            diagnostics["source_overlay_skipped_reason"] = "prepared_source_pdf"
            diagnostics["payload_prepare_elapsed_seconds"] = prepare_elapsed
            diagnostics["color_adapt_elapsed_seconds"] = color_elapsed
            diagnostics["page_specs_elapsed_seconds"] = specs_elapsed
            diagnostics["typst_cover_fallback_pages"] = sorted(cover_fallback_page_indices)
            diagnostics["typst_source_prepare_elapsed_seconds"] = source_prepare_elapsed
            diagnostics["typst_prebuilt_source_path"] = str(active_prebuilt_source_path or "")
            diagnostics["pikepdf_overlay_output_pdf_path"] = str(pike_result.output_pdf_path)
            diagnostics["pikepdf_overlay_pages"] = pike_result.pages_merged
            diagnostics["pikepdf_overlay_elapsed_seconds"] = pike_result.elapsed_seconds
            diagnostics.setdefault("compile_errors", [])
            diagnostics.setdefault("sanitize_page_diagnostics", [])
            return diagnostics
        diagnostics = overlay_pages_from_single_pdf(
            doc,
            ordered_page_indices,
            translated_pages,
            overlay_pdf,
            cover_only=cover_only,
            apply_source_overlay=False,
            redaction_strategy=redaction_strategy,
            source_text_precleaned_page_indices=source_text_precleaned_page_indices,
            skip_visual_cover=use_typst_overlay_fill_only,
            source_base_pdf_path=source_base_pdf_path,
            pikepdf_output_pdf_path=pikepdf_output_pdf_path,
        )
        diagnostics["compile_elapsed_seconds"] = compile_elapsed
        diagnostics["sanitize_elapsed_seconds"] = 0.0
        diagnostics["page_count"] = len(ordered_page_indices)
        diagnostics["mode"] = "book_overlay"
        diagnostics["typst_cover_blocks"] = False
        diagnostics["source_overlay_skipped_reason"] = "prepared_source_pdf"
        diagnostics["payload_prepare_elapsed_seconds"] = prepare_elapsed
        diagnostics["color_adapt_elapsed_seconds"] = color_elapsed
        diagnostics["page_specs_elapsed_seconds"] = specs_elapsed
        diagnostics["typst_cover_fallback_pages"] = sorted(cover_fallback_page_indices)
        diagnostics["typst_source_prepare_elapsed_seconds"] = source_prepare_elapsed
        diagnostics["typst_prebuilt_source_path"] = str(active_prebuilt_source_path or "")
        diagnostics.setdefault("compile_errors", [])
        diagnostics.setdefault("sanitize_page_diagnostics", [])
        return diagnostics
    except RuntimeError as exc:
        first_compile_elapsed = time.perf_counter() - compile_started
        failed_overlay_indices = _extract_failed_overlay_indices(exc, page_specs)
        print("typst book compile failed; sanitizing pages before per-page fallback", flush=True)
        print(str(exc), flush=True)
        if failed_overlay_indices:
            failed_pages_text = ", ".join(
                str(page_specs[index][0] + 1) for index in sorted(failed_overlay_indices)
            )
            print(f"typst targeted sanitize pages={failed_pages_text}", flush=True)
            emit_render_compile_progress(
                current=1,
                total=max(len(failed_overlay_indices), 1),
                message=f"整本 Typst 编译失败，优先修复不兼容页面：第 {failed_pages_text} 页",
                payload={
                    "render_stage": "typst_targeted_sanitize",
                    "candidate_pages": [page_specs[index][0] for index in sorted(failed_overlay_indices)],
                },
            )
        else:
            print("typst compile failure page unknown; sanitizing all pages", flush=True)
        emit_render_compile_progress(
            current=2,
            total=4,
            message="整本 Typst 编译失败，开始检查不兼容页面",
            payload={"render_stage": "typst_book_compile_failed"},
        )
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
        overlay_indices=failed_overlay_indices or None,
        request_chat_content_fn=request_chat_content_fn,
    )
    sanitize_elapsed = time.perf_counter() - sanitize_started
    emit_render_compile_progress(
        current=3,
        total=4,
        message="Typst 不兼容页面检查完成",
        payload={"render_stage": "typst_sanitize_done"},
    )
    sanitized_compile_started = time.perf_counter()
    sanitized_compile_elapsed = 0.0
    retry_sanitized_book_compile = len(ordered_page_indices) <= 120 or 0 < len(failed_overlay_indices) <= 8
    if retry_sanitized_book_compile:
        try:
            emit_render_compile_progress(
                current=3,
                total=4,
                message="正在重新编译修复后的整本 Typst overlay",
                payload={"render_stage": "typst_sanitized_book_compile_start"},
            )
            overlay_pdf = compile_book_overlay_pdf(
                sanitized_book_specs,
                stem=stem,
                font_family=font_family,
                include_cover_rect=include_cover_rect_in_overlay,
                font_paths=font_paths,
                temp_root=temp_root,
            )
            sanitized_compile_elapsed = time.perf_counter() - sanitized_compile_started
            emit_render_compile_progress(
                current=4,
                total=4,
                message=f"修复后的整本 Typst overlay 编译完成，共 {len(ordered_page_indices)} 页",
                payload={"render_stage": "typst_sanitized_book_compile_done"},
            )
            if (
                source_base_pdf_path is not None
                and pikepdf_output_pdf_path is not None
                and _can_use_pikepdf_book_overlay(
                    apply_source_overlay=False,
                    use_typst_overlay_fill_only=use_typst_overlay_fill_only,
                    source_cleanup_strategy=source_cleanup_strategy,
                    source_text_precleaned_page_indices=source_text_precleaned_page_indices,
                    ordered_page_indices=ordered_page_indices,
                    translated_pages=sanitized_translated_pages,
                )
            ):
                merge_started = time.perf_counter()
                pike_result = overlay_pdf_pages_with_pikepdf(
                    source_pdf_path=source_base_pdf_path,
                    overlay_pdf_path=overlay_pdf,
                    output_pdf_path=pikepdf_output_pdf_path,
                    source_page_indices=ordered_page_indices,
                )
                merge_elapsed = time.perf_counter() - merge_started
                diagnostics = new_overlay_merge_diagnostics()
                diagnostics["compile_elapsed_seconds"] = first_compile_elapsed + sanitized_compile_elapsed
                diagnostics["sanitize_elapsed_seconds"] = sanitize_elapsed
                diagnostics["source_overlay_elapsed_seconds"] = 0.0
                diagnostics["overlay_merge_elapsed_seconds"] = merge_elapsed
                diagnostics["page_count"] = len(ordered_page_indices)
                diagnostics["mode"] = "book_overlay_sanitized_pikepdf"
                diagnostics["typst_cover_blocks"] = False
                diagnostics["source_overlay_skipped_reason"] = "prepared_source_pdf"
                diagnostics["payload_prepare_elapsed_seconds"] = prepare_elapsed
                diagnostics["color_adapt_elapsed_seconds"] = color_elapsed
                diagnostics["page_specs_elapsed_seconds"] = specs_elapsed
                diagnostics["typst_cover_fallback_pages"] = sorted(cover_fallback_page_indices)
                diagnostics["typst_source_prepare_elapsed_seconds"] = source_prepare_elapsed
                diagnostics["typst_prebuilt_source_path"] = str(active_prebuilt_source_path or "")
                diagnostics["compile_errors"] = compile_errors
                diagnostics["sanitize_page_diagnostics"] = sanitize_page_diagnostics
                diagnostics["targeted_sanitize_overlay_indices"] = sorted(failed_overlay_indices)
                diagnostics["pikepdf_overlay_output_pdf_path"] = str(pike_result.output_pdf_path)
                diagnostics["pikepdf_overlay_pages"] = pike_result.pages_merged
                diagnostics["pikepdf_overlay_elapsed_seconds"] = pike_result.elapsed_seconds
                return diagnostics
            diagnostics = overlay_pages_from_single_pdf(
                doc,
                ordered_page_indices,
                sanitized_translated_pages,
                overlay_pdf,
                cover_only=cover_only,
                apply_source_overlay=False,
                redaction_strategy=redaction_strategy,
                source_text_precleaned_page_indices=source_text_precleaned_page_indices,
                skip_visual_cover=use_typst_overlay_fill_only,
                source_base_pdf_path=source_base_pdf_path,
                pikepdf_output_pdf_path=pikepdf_output_pdf_path,
            )
            diagnostics["compile_elapsed_seconds"] = first_compile_elapsed + sanitized_compile_elapsed
            diagnostics["sanitize_elapsed_seconds"] = sanitize_elapsed
            diagnostics["page_count"] = len(ordered_page_indices)
            diagnostics["mode"] = "book_overlay_sanitized"
            diagnostics["typst_cover_blocks"] = False
            diagnostics["source_overlay_skipped_reason"] = "prepared_source_pdf"
            diagnostics["payload_prepare_elapsed_seconds"] = prepare_elapsed
            diagnostics["color_adapt_elapsed_seconds"] = color_elapsed
            diagnostics["page_specs_elapsed_seconds"] = specs_elapsed
            diagnostics["typst_cover_fallback_pages"] = sorted(cover_fallback_page_indices)
            diagnostics["typst_source_prepare_elapsed_seconds"] = source_prepare_elapsed
            diagnostics["typst_prebuilt_source_path"] = str(active_prebuilt_source_path or "")
            diagnostics["compile_errors"] = compile_errors
            diagnostics["sanitize_page_diagnostics"] = sanitize_page_diagnostics
            diagnostics["targeted_sanitize_overlay_indices"] = sorted(failed_overlay_indices)
            return diagnostics
        except RuntimeError as exc:
            print("typst sanitized book compile failed; falling back to per-page compilation", flush=True)
            print(str(exc), flush=True)
            compile_errors.append(exc.to_dict() if isinstance(exc, TypstCompileError) else str(exc))
    else:
        print(
            f"typst sanitized book compile skipped for large document pages={len(ordered_page_indices)}; "
            "falling back to per-page compilation",
            flush=True,
        )
        emit_render_page_progress(
            current=0,
            total=len(ordered_page_indices),
            message=f"大文档跳过整本重编译，改为逐页编译 {len(ordered_page_indices)} 页",
            payload={"render_stage": "large_doc_page_overlay_compile"},
        )

    fallback_apply_source_overlay = apply_source_overlay
    if _can_use_pikepdf_book_overlay(
        apply_source_overlay=False,
        use_typst_overlay_fill_only=use_typst_overlay_fill_only,
        source_cleanup_strategy=source_cleanup_strategy,
        source_text_precleaned_page_indices=source_text_precleaned_page_indices,
        ordered_page_indices=ordered_page_indices,
        translated_pages=sanitized_translated_pages,
    ):
        fallback_apply_source_overlay = False

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
        apply_source_overlay=fallback_apply_source_overlay,
        redaction_strategy=redaction_strategy,
        source_base_pdf_path=source_base_pdf_path,
        pikepdf_output_pdf_path=pikepdf_output_pdf_path,
        request_chat_content_fn=request_chat_content_fn,
    )
    diagnostics["compile_elapsed_seconds"] = (
        first_compile_elapsed
        + sanitized_compile_elapsed
        + diagnostics.get("page_overlay_compile_elapsed_seconds", 0.0)
    )
    diagnostics["sanitize_elapsed_seconds"] = sanitize_elapsed
    diagnostics["page_count"] = len(ordered_page_indices)
    if diagnostics.get("mode") != "page_overlay_fallback_pikepdf":
        diagnostics["mode"] = "page_overlay_fallback"
    diagnostics["compile_errors"] = compile_errors
    diagnostics["sanitize_page_diagnostics"] = sanitize_page_diagnostics
    return diagnostics
