from __future__ import annotations

from pathlib import Path
import time
from typing import Callable

import fitz

from foundation.config import fonts
from services.rendering.output.pdf_writer import save_fast_pdf
from services.rendering.output.pdf_writer import save_optimized_pdf
from services.rendering.output.pdf_writer import strip_page_links
from services.rendering.source.background.stage import build_clean_background_pdf
from services.rendering.document.page_map import RenderPageMap
from services.rendering.document.metadata import copy_toc
from services.rendering.document.pikepdf_pages import extract_pages_with_pikepdf
from services.rendering.output.typst.book_support import build_dual_doc_pages
from services.rendering.output.typst.book_support import collect_background_page_specs
from services.rendering.output.typst.book_support import prepare_background_work_dir
from services.rendering.output.typst.book_support import prepare_single_page_items
from services.rendering.output.typst.book_support import prepare_translated_pages_for_render
from services.rendering.output.typst.book_support import resolve_typst_temp_root
from services.rendering.output.typst.book_support import save_background_pdf_to_output
from services.rendering.layout.page_specs import build_render_page_specs
from services.rendering.layout.page_specs import expand_page_specs_for_flow_rebuild
from services.rendering.layout.model.models import RenderPageSpec
from services.rendering.output.typst.compiler import compile_typst_render_pages_pdf
from services.rendering.output.typst.color_adapt import apply_adaptive_overlay_colors
from services.rendering.output.typst.overlay_ops import overlay_translated_items_on_page
from services.rendering.output.typst.overlay_ops import overlay_translated_pages_on_doc
from services.rendering.output.typst.sanitize import sanitize_page_specs_for_typst_book_background
from services.pipeline_shared.events import emit_render_compile_progress
from services.pipeline_shared.events import emit_render_page_progress


_BACKGROUND_SANITIZE_ALL_THRESHOLD = 64
TypstRepairRequestFn = Callable[..., str]


def _emit_page_spec_progress(completed: int, total_pages: int, page_index: int) -> None:
    emit_render_page_progress(
        current=completed,
        total=total_pages,
        message=f"正在准备渲染页面，第 {completed}/{total_pages} 页",
        payload={
            "render_stage": "layout_page_specs",
            "page_index": page_index,
            "substage": "render_pages",
        },
    )


def _apply_background_page_color_adapt(
    *,
    sample_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    precomputed_colors_by_item_id: dict[str, dict[str, tuple[float, float, float]]] | None = None,
) -> dict[int, list[dict]]:
    sample_doc = fitz.open(sample_pdf_path)
    try:
        adapted: dict[int, list[dict]] = {}
        for page_idx, items in translated_pages.items():
            if 0 <= page_idx < len(sample_doc):
                adapted[page_idx] = apply_adaptive_overlay_colors(
                    sample_doc[page_idx],
                    items,
                    precomputed_colors_by_item_id=precomputed_colors_by_item_id,
                )
            else:
                adapted[page_idx] = list(items)
        return adapted
    finally:
        sample_doc.close()


def _compile_render_page_subset(
    *,
    background_pdf_path: Path,
    page_specs: list,
    page_indices: list[int],
    stem: str,
    font_family: str,
    font_paths: list[Path] | None,
    work_dir: Path,
) -> None:
    subset_specs = [page_specs[index] for index in page_indices]
    compile_typst_render_pages_pdf(
        background_pdf_path=background_pdf_path,
        page_specs=subset_specs,
        stem=stem,
        font_family=font_family,
        font_paths=font_paths,
        work_dir=work_dir,
    )


def _locate_bad_render_page_indices(
    *,
    background_pdf_path: Path,
    page_specs: list,
    font_family: str,
    font_paths: list[Path] | None,
    work_dir: Path,
) -> list[int]:
    bad_indices: list[int] = []
    probe_counter = 0

    def probe(indices: list[int]) -> None:
        nonlocal probe_counter
        if not indices:
            return
        probe_counter += 1
        try:
            _compile_render_page_subset(
                background_pdf_path=background_pdf_path,
                page_specs=page_specs,
                page_indices=indices,
                stem=f"book-background-overlay-probe-{probe_counter:04d}",
                font_family=font_family,
                font_paths=font_paths,
                work_dir=work_dir,
            )
            return
        except RuntimeError:
            if len(indices) == 1:
                bad_indices.append(indices[0])
                return
            midpoint = len(indices) // 2
            probe(indices[:midpoint])
            probe(indices[midpoint:])

    probe(list(range(len(page_specs))))
    return sorted(set(bad_indices))


def _build_overlay_base_doc(source_pdf_path: Path) -> fitz.Document:
    started = time.perf_counter()
    doc = fitz.open(source_pdf_path)
    print(f"overlay base doc: open source elapsed={time.perf_counter() - started:.2f}s", flush=True)
    return doc


def _compile_render_pages_pdf_resilient(
    *,
    source_pdf_path: Path,
    color_sample_pdf_path: Path,
    background_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    page_specs: list,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    work_dir: Path,
    flow_rebuild_page_indices: frozenset[int] = frozenset(),
    request_chat_content_fn: TypstRepairRequestFn | None = None,
) -> tuple[Path, dict[str, object]]:
    diagnostics: dict[str, object] = {
        "background_compile_retried": False,
        "background_compile_failed": False,
        "background_first_compile_elapsed_seconds": 0.0,
        "background_sanitize_elapsed_seconds": 0.0,
        "background_sanitized_compile_elapsed_seconds": 0.0,
    }
    page_specs = expand_page_specs_for_flow_rebuild(
        page_specs,
        flow_rebuild_page_indices=flow_rebuild_page_indices,
    )
    compile_started = time.perf_counter()
    try:
        emit_render_compile_progress(
            current=1,
            total=4,
            message=f"正在编译整本 Typst 渲染，共 {len(page_specs)} 页",
            payload={"render_stage": "background_typst_compile_start"},
        )
        compiled_path = compile_typst_render_pages_pdf(
            background_pdf_path=background_pdf_path,
            page_specs=page_specs,
            stem="book-background-overlay",
            font_family=font_family,
            font_paths=font_paths,
            work_dir=work_dir,
        )
        diagnostics["background_first_compile_elapsed_seconds"] = time.perf_counter() - compile_started
        emit_render_compile_progress(
            current=4,
            total=4,
            message=f"整本 Typst 渲染编译完成，共 {len(page_specs)} 页",
            payload={"render_stage": "background_typst_compile_done"},
        )
        return compiled_path, diagnostics
    except RuntimeError as exc:
        diagnostics["background_compile_retried"] = True
        diagnostics["background_compile_failed"] = True
        diagnostics["background_first_compile_elapsed_seconds"] = time.perf_counter() - compile_started
        print("typst background render compile failed; sanitizing pages", flush=True)
        print(str(exc), flush=True)
        emit_render_compile_progress(
            current=2,
            total=5,
            message="整本 Typst 渲染编译失败，开始定位不兼容页面",
            payload={"render_stage": "background_typst_compile_failed"},
        )
        locate_started = time.perf_counter()
        failed_page_indices = _locate_bad_render_page_indices(
            background_pdf_path=background_pdf_path,
            page_specs=page_specs,
            font_family=font_family,
            font_paths=font_paths,
            work_dir=work_dir,
        )
        diagnostics["background_bad_page_indices"] = list(failed_page_indices)
        diagnostics["background_bad_page_count"] = len(failed_page_indices)
        diagnostics["background_bad_page_locate_elapsed_seconds"] = time.perf_counter() - locate_started
        if failed_page_indices and len(failed_page_indices) <= _BACKGROUND_SANITIZE_ALL_THRESHOLD:
            sanitize_page_indices: set[int] | None = set(failed_page_indices)
            message = f"已定位 {len(failed_page_indices)} 个 Typst 不兼容页面，开始定向修复"
        else:
            sanitize_page_indices = None
            message = "无法小范围定位 Typst 不兼容页面，开始全量修复"
        emit_render_compile_progress(
            current=3,
            total=5,
            message=message,
            payload={
                "render_stage": "background_typst_bad_pages_located",
                "bad_page_count": len(failed_page_indices),
                "bad_page_indices": list(failed_page_indices[:50]),
                "targeted_sanitize": sanitize_page_indices is not None,
            },
        )
        background_page_specs = collect_background_page_specs(source_pdf_path, translated_pages)
        sanitize_started = time.perf_counter()
        sanitized_background_specs = sanitize_page_specs_for_typst_book_background(
            background_page_specs,
            stem="book-background-overlay",
            api_key=api_key,
            model=model,
            base_url=base_url,
            font_family=font_family,
            font_paths=font_paths,
            work_dir=work_dir,
            page_indices=sanitize_page_indices,
            request_chat_content_fn=request_chat_content_fn,
        )
        diagnostics["background_sanitize_elapsed_seconds"] = time.perf_counter() - sanitize_started
        emit_render_compile_progress(
            current=4,
            total=5,
            message="Typst 不兼容页面检查完成，开始重新编译",
            payload={"render_stage": "background_typst_sanitize_done"},
        )
        sanitized_pages = {page_idx: items for page_idx, _w, _h, items in sanitized_background_specs}
        sanitized_pages = _apply_background_page_color_adapt(
            sample_pdf_path=color_sample_pdf_path,
            translated_pages=sanitized_pages,
        )
        sanitized_render_page_specs = build_render_page_specs(
            source_pdf_path=source_pdf_path,
            translated_pages=sanitized_pages,
            prepared=True,
            flow_rebuild_page_indices=flow_rebuild_page_indices,
            on_page_spec_built=_emit_page_spec_progress,
        )
        sanitized_compile_started = time.perf_counter()
        compiled_path = compile_typst_render_pages_pdf(
            background_pdf_path=background_pdf_path,
            page_specs=sanitized_render_page_specs,
            stem="book-background-overlay-sanitized",
            font_family=font_family,
            font_paths=font_paths,
            work_dir=work_dir,
        )
        diagnostics["background_sanitized_compile_elapsed_seconds"] = (
            time.perf_counter() - sanitized_compile_started
        )
        emit_render_compile_progress(
            current=5,
            total=5,
            message=f"修复后的整本 Typst 渲染编译完成，共 {len(sanitized_render_page_specs)} 页",
            payload={"render_stage": "background_typst_sanitized_compile_done"},
        )
        return compiled_path, diagnostics


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
    redaction_strategy: str | None = None,
    request_chat_content_fn: TypstRepairRequestFn | None = None,
) -> None:
    prepared_items = prepare_single_page_items(translated_items, page_idx, source_pdf_path=source_pdf_path)
    temp_source_path = resolve_typst_temp_root(output_pdf_path, temp_root) / f"page-{page_idx + 1}-source.pdf"
    extract_pages_with_pikepdf(
        source_pdf_path=source_pdf_path,
        output_pdf_path=temp_source_path,
        start_page=page_idx,
        end_page=page_idx,
    )
    source_doc = fitz.open(source_pdf_path)
    temp_doc = fitz.open(temp_source_path)
    copy_toc(source_doc, temp_doc, start_page=page_idx, end_page=page_idx)
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
        redaction_strategy=redaction_strategy,
        request_chat_content_fn=request_chat_content_fn,
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
    redaction_strategy: str | None = None,
    fast_save: bool = False,
    indent_detection_pdf_path: Path | None = None,
    first_line_indent_lookup: dict[str, float] | None = None,
    effective_inner_bbox_lookup: dict[str, list[float]] | None = None,
    source_text_precleaned_page_indices: frozenset[int] = frozenset(),
    prebuilt_source_path: Path | None = None,
    source_cleanup_strategy: str = "typst_fill",
    extra_cover_fallback_page_indices: frozenset[int] = frozenset(),
    precomputed_colors_by_item_id: dict[str, dict[str, tuple[float, float, float]]] | None = None,
    request_chat_content_fn: TypstRepairRequestFn | None = None,
) -> dict[str, object]:
    doc = _build_overlay_base_doc(source_pdf_path)
    try:
        typst_temp_root = resolve_typst_temp_root(output_pdf_path, temp_root)
        overlay_started = time.perf_counter()
        overlay_diagnostics = overlay_translated_pages_on_doc(
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
            redaction_strategy=redaction_strategy,
            source_pdf_path=indent_detection_pdf_path or source_pdf_path,
            first_line_indent_lookup=first_line_indent_lookup,
            effective_inner_bbox_lookup=effective_inner_bbox_lookup,
            source_text_precleaned_page_indices=source_text_precleaned_page_indices,
            prebuilt_source_path=prebuilt_source_path,
            source_base_pdf_path=source_pdf_path,
            color_sample_pdf_path=indent_detection_pdf_path or source_pdf_path,
            precomputed_colors_by_item_id=precomputed_colors_by_item_id,
            pikepdf_output_pdf_path=output_pdf_path,
            source_cleanup_strategy=source_cleanup_strategy,
            extra_cover_fallback_page_indices=extra_cover_fallback_page_indices,
            request_chat_content_fn=request_chat_content_fn,
        )
        overlay_elapsed = time.perf_counter() - overlay_started
        print(
            "overlay diagnostics: "
            f"mode={overlay_diagnostics.get('mode')} "
            f"pages={overlay_diagnostics.get('page_count', 0)} "
            f"sanitize={float(overlay_diagnostics.get('sanitize_elapsed_seconds', 0.0) or 0.0):.2f}s "
            f"prepare={float(overlay_diagnostics.get('payload_prepare_elapsed_seconds', 0.0) or 0.0):.2f}s "
            f"color={float(overlay_diagnostics.get('color_adapt_elapsed_seconds', 0.0) or 0.0):.2f}s "
            f"specs={float(overlay_diagnostics.get('page_specs_elapsed_seconds', 0.0) or 0.0):.2f}s "
            f"compile={float(overlay_diagnostics.get('compile_elapsed_seconds', 0.0) or 0.0):.2f}s "
            f"source_cleanup={float(overlay_diagnostics.get('source_overlay_elapsed_seconds', 0.0) or 0.0):.2f}s "
            f"merge={float(overlay_diagnostics.get('overlay_merge_elapsed_seconds', 0.0) or 0.0):.2f}s "
            f"raw_rects={int(overlay_diagnostics.get('raw_removable_rects', 0) or 0)} "
            f"merged_rects={int(overlay_diagnostics.get('merged_removable_rects', 0) or 0)} "
            f"cover_rects={int(overlay_diagnostics.get('cover_rects', 0) or 0)} "
            f"fast_cover_pages={int(overlay_diagnostics.get('fast_page_cover_pages', 0) or 0)} "
            f"item_fast_cover={int(overlay_diagnostics.get('item_fast_cover_count', 0) or 0)} "
            f"legacy_redaction_pages={int(overlay_diagnostics.get('legacy_pymupdf_redaction_pages', 0) or 0)} "
            f"legacy_overlay_pages={int(overlay_diagnostics.get('legacy_pymupdf_overlay_pages', 0) or 0)} "
            f"total={overlay_elapsed:.2f}s",
            flush=True,
        )
        if "pikepdf" in str(overlay_diagnostics.get("mode", "")):
            return overlay_diagnostics
        if fast_save:
            save_fast_pdf(doc, output_pdf_path)
        else:
            save_optimized_pdf(doc, output_pdf_path)
        return overlay_diagnostics
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
    redaction_strategy: str | None = None,
    indent_detection_pdf_path: Path | None = None,
    first_line_indent_lookup: dict[str, float] | None = None,
    effective_inner_bbox_lookup: dict[str, list[float]] | None = None,
    request_chat_content_fn: TypstRepairRequestFn | None = None,
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
            redaction_strategy=redaction_strategy,
            source_pdf_path=indent_detection_pdf_path or source_pdf_path,
            first_line_indent_lookup=first_line_indent_lookup,
            effective_inner_bbox_lookup=effective_inner_bbox_lookup,
            request_chat_content_fn=request_chat_content_fn,
        )
        build_dual_doc_pages(
            source_doc,
            translated_doc,
            dual_doc,
            start_page=start_page,
            end_page=end_page,
        )
        copy_toc(source_doc, dual_doc, start_page=start_page, end_page=end_page)
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
    redaction_strategy: str | None = None,
    indent_detection_pdf_path: Path | None = None,
    first_line_indent_lookup: dict[str, float] | None = None,
    effective_inner_bbox_lookup: dict[str, list[float]] | None = None,
    compile_workers: int | None = None,
    source_text_precleaned_page_indices: frozenset[int] = frozenset(),
    prebuilt_page_specs: list[RenderPageSpec] | None = None,
    flow_rebuild_page_indices: frozenset[int] = frozenset(),
    precomputed_colors_by_item_id: dict[str, dict[str, tuple[float, float, float]]] | None = None,
    request_chat_content_fn: TypstRepairRequestFn | None = None,
) -> dict[str, object]:
    del compile_workers
    diagnostics: dict[str, object] = {"mode": "typst"}
    total_started = time.perf_counter()
    work_dir = prepare_background_work_dir(output_pdf_path, temp_root)
    color_sample_pdf_path = indent_detection_pdf_path or source_pdf_path
    if prebuilt_page_specs:
        page_specs = prebuilt_page_specs
        diagnostics["background_prepare_elapsed_seconds"] = 0.0
        diagnostics["background_color_adapt_elapsed_seconds"] = 0.0
        diagnostics["background_page_specs_elapsed_seconds"] = 0.0
        diagnostics["background_page_specs_prewarm_hit"] = True
    else:
        prepare_started = time.perf_counter()
        translated_pages = prepare_translated_pages_for_render(
            indent_detection_pdf_path or source_pdf_path,
            translated_pages,
            first_line_indent_lookup=first_line_indent_lookup,
            effective_inner_bbox_lookup=effective_inner_bbox_lookup,
        )
        diagnostics["background_prepare_elapsed_seconds"] = time.perf_counter() - prepare_started
        color_started = time.perf_counter()
        translated_pages = _apply_background_page_color_adapt(
            sample_pdf_path=color_sample_pdf_path,
            translated_pages=translated_pages,
            precomputed_colors_by_item_id=precomputed_colors_by_item_id,
        )
        diagnostics["background_color_adapt_elapsed_seconds"] = time.perf_counter() - color_started
        specs_started = time.perf_counter()
        page_specs = build_render_page_specs(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            prepared=True,
            flow_rebuild_page_indices=flow_rebuild_page_indices,
            on_page_spec_built=_emit_page_spec_progress,
        )
        diagnostics["background_page_specs_elapsed_seconds"] = time.perf_counter() - specs_started
        diagnostics["background_page_specs_prewarm_hit"] = False
    page_specs = expand_page_specs_for_flow_rebuild(
        page_specs,
        flow_rebuild_page_indices=flow_rebuild_page_indices,
    )
    flow_continuation_page_count = sum(1 for spec in page_specs if spec.is_flow_continuation)
    diagnostics["flow_rebuild_page_indices"] = sorted(flow_rebuild_page_indices)
    diagnostics["flow_rebuild_pages"] = len(flow_rebuild_page_indices)
    diagnostics["flow_continuation_pages"] = flow_continuation_page_count
    page_map = RenderPageMap.from_page_specs(page_specs)
    cleanup_started = time.perf_counter()
    cleaned_background_pdf = build_clean_background_pdf(
        source_pdf_path=source_pdf_path,
        translated_pages=translated_pages,
        output_pdf_path=work_dir / "book-background-cleaned.pdf",
        redaction_strategy=redaction_strategy,
        page_specs=page_specs,
        source_text_precleaned_page_indices=source_text_precleaned_page_indices,
    )
    diagnostics["background_source_cleanup_elapsed_seconds"] = time.perf_counter() - cleanup_started
    background_pdf, compile_diagnostics = _compile_render_pages_pdf_resilient(
        source_pdf_path=source_pdf_path,
        color_sample_pdf_path=color_sample_pdf_path,
        background_pdf_path=cleaned_background_pdf,
        translated_pages=translated_pages,
        page_specs=page_specs,
        api_key=api_key,
        model=model,
        base_url=base_url,
        font_family=font_family,
        font_paths=font_paths,
        work_dir=work_dir,
        flow_rebuild_page_indices=flow_rebuild_page_indices,
        request_chat_content_fn=request_chat_content_fn,
    )
    diagnostics.update(compile_diagnostics)
    save_started = time.perf_counter()
    save_background_pdf_to_output(
        background_pdf,
        output_pdf_path,
        source_pdf_path=source_pdf_path,
        page_map=page_map,
    )
    diagnostics["background_save_elapsed_seconds"] = time.perf_counter() - save_started
    diagnostics["background_total_elapsed_seconds"] = time.perf_counter() - total_started
    return diagnostics
