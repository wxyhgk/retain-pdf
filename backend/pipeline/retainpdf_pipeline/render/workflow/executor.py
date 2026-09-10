from __future__ import annotations

import os
from pathlib import Path
import time

from retainpdf_pipeline.foundation.config import fonts
from retainpdf_pipeline.foundation.config import layout
from retainpdf_pipeline.foundation.config import runtime
from retainpdf_pipeline.render.render_plan import RenderPlan
from retainpdf_pipeline.render.workflow.context import RenderExecutionContext
from retainpdf_pipeline.render.workflow.cover_fallback import TypstCoverFallbackPlan
from retainpdf_pipeline.render.workflow.document_analysis import document_analysis_diagnostics
from retainpdf_pipeline.render.workflow.document_analysis import document_analysis_prewarm_hit
from retainpdf_pipeline.render.workflow.document_analysis import build_sync_workflow_document_analysis
from retainpdf_pipeline.render.workflow.document_analysis import resolve_cached_workflow_document_analysis
from retainpdf_pipeline.render.workflow.modes import run_background_typst_render
from retainpdf_pipeline.render.workflow.modes import run_dual_render
from retainpdf_pipeline.render.workflow.modes import run_overlay_render
from retainpdf_pipeline.render.workflow.modes import run_selected_pages_overlay_render
from retainpdf_pipeline.render.workflow.prewarm_cache import build_full_sync_payload_prewarm
from retainpdf_pipeline.render.workflow.prewarm_cache import build_sync_payload_prewarm
from retainpdf_pipeline.render.workflow.prewarm_cache import has_material_payload_prewarm
from retainpdf_pipeline.render.workflow.prewarm_cache import persist_sync_render_source_prewarm
from retainpdf_pipeline.render.source.render_source import build_render_source_pdf
from retainpdf_pipeline.render.source_cleanup.protected_blocks import protected_pages_from_document_path
from retainpdf_pipeline.render.source.prewarm import try_load_prewarmed_render_source_pdf
from retainpdf_pipeline.render.source.prewarm import try_load_render_payload_prewarm
from retainpdf_pipeline.render.source.prewarm_manifest_io import render_payload_prewarm_from_manifest_payload
from retainpdf_pipeline.render.source.prewarm_payload import ensure_pdf_structure_profile


def render_no_cache_enabled() -> bool:
    return str(os.environ.get("RETAINPDF_RENDER_NO_CACHE") or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def execute_render_plan(
    *,
    render_plan: RenderPlan,
    output_pdf_path: Path,
    start_page: int,
    end_page: int,
    compile_workers: int | None = None,
    extract_selected_pages: bool = False,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    typst_font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    pdf_compress_dpi: int = runtime.DEFAULT_PDF_COMPRESS_DPI,
    source_cleanup_strategy: str | None = None,
    render_prewarm_manifest_path: Path | None = None,
) -> int:
    start = max(0, start_page)
    stop = max(render_plan.selected_pages) if end_page < 0 else end_page
    cleanup_strategy = layout.normalize_source_cleanup_strategy(source_cleanup_strategy)
    no_cache = render_no_cache_enabled()
    if no_cache:
        render_prewarm_manifest_path = None
    render_source_pdf = (
        try_load_prewarmed_render_source_pdf(
            manifest_path=render_prewarm_manifest_path,
            source_pdf_path=render_plan.render_inputs.source_pdf_path,
            translated_pages=render_plan.selected_pages,
            effective_render_mode=render_plan.effective_render_mode,
            start_page=start,
            end_page=stop,
            pdf_compress_dpi=pdf_compress_dpi,
            source_cleanup_strategy=cleanup_strategy,
        )
        if render_prewarm_manifest_path is not None
        else None
    )
    payload_prewarm = (
        try_load_render_payload_prewarm(
            manifest_path=render_prewarm_manifest_path,
            source_pdf_path=render_plan.render_inputs.source_pdf_path,
            translated_pages=render_plan.selected_pages,
            effective_render_mode=render_plan.effective_render_mode,
            start_page=start,
            end_page=stop,
            pdf_compress_dpi=pdf_compress_dpi,
            source_cleanup_strategy=cleanup_strategy,
        )
        if render_prewarm_manifest_path is not None
        else None
    )
    render_source_prewarm_hit = render_source_pdf is not None
    render_document_analysis_hit = document_analysis_prewarm_hit(
        render_source_pdf=render_source_pdf,
        payload_prewarm=payload_prewarm,
    )
    document_analysis = resolve_cached_workflow_document_analysis(
        render_source_pdf=render_source_pdf,
        payload_prewarm=payload_prewarm,
    )
    if document_analysis is None:
        analysis_started = time.perf_counter()
        document_analysis = build_sync_workflow_document_analysis(
            source_pdf_path=render_plan.render_inputs.source_pdf_path,
            translated_pages=render_plan.selected_pages,
            start_page=start,
            end_page=stop,
        )
        print(
            "render document analysis: "
            f"sync pages={len(document_analysis.pages)} elapsed={time.perf_counter() - analysis_started:.2f}s",
            flush=True,
        )
    protected_pages = _protected_pages_for_render(render_plan.render_inputs.translations_dir)
    render_source_sync_cache_written = False
    if render_source_pdf is None:
        sync_prepare_started = time.perf_counter()
        pdf_structure_profile_path = (
            payload_prewarm.pdf_structure_profile_path
            if payload_prewarm is not None
            else None
        )
        if pdf_structure_profile_path is None and render_prewarm_manifest_path is not None:
            pdf_structure_profile_path, _pdf_structure_profile = ensure_pdf_structure_profile(
                source_pdf_path=render_plan.render_inputs.source_pdf_path,
                translated_pages=render_plan.selected_pages,
                manifest_path=render_prewarm_manifest_path,
            )
        render_source_pdf = build_render_source_pdf(
            source_pdf_path=render_plan.render_inputs.source_pdf_path,
            output_pdf_path=(
                render_prewarm_manifest_path.parent / output_pdf_path.name
                if render_prewarm_manifest_path is not None
                else output_pdf_path
            ),
            pdf_compress_dpi=pdf_compress_dpi,
            translated_pages=render_plan.selected_pages,
            protected_pages=protected_pages,
            strip_hidden_text=render_plan.effective_render_mode != "overlay",
            start_page=start,
            end_page=stop,
            artifact_mode=render_prewarm_manifest_path is not None,
            bbox_text_strip_candidates=(
                payload_prewarm.bbox_text_strip_candidates
                if payload_prewarm is not None
                else None
            ),
            source_cleanup_strategy=cleanup_strategy,
            document_analysis=document_analysis,
            pdf_structure_profile_path=pdf_structure_profile_path,
        )
        sync_payload_prewarm = (
            {}
            if no_cache
            else build_full_sync_payload_prewarm(
                manifest_path=render_prewarm_manifest_path,
                prepared=render_source_pdf,
                source_pdf_path=render_plan.render_inputs.source_pdf_path,
                translated_pages=render_plan.selected_pages,
                effective_render_mode=render_plan.effective_render_mode,
                source_cleanup_strategy=cleanup_strategy,
            )
        )
        merged_sync_payload_prewarm = (
            {}
            if no_cache
            else build_sync_payload_prewarm(
                manifest_path=render_prewarm_manifest_path,
                prepared=render_source_pdf,
                payload_prewarm=sync_payload_prewarm,
            )
        )
        render_source_sync_cache_written = (
            False
            if no_cache
            else persist_sync_render_source_prewarm(
                manifest_path=render_prewarm_manifest_path,
                prepared=render_source_pdf,
                source_pdf_path=render_plan.render_inputs.source_pdf_path,
                translated_pages=render_plan.selected_pages,
                effective_render_mode=render_plan.effective_render_mode,
                start_page=start,
                end_page=stop,
                pdf_compress_dpi=pdf_compress_dpi,
                source_cleanup_strategy=cleanup_strategy,
                elapsed=time.perf_counter() - sync_prepare_started,
                payload_prewarm=merged_sync_payload_prewarm,
            )
        )
        if payload_prewarm is None and not no_cache:
            payload_prewarm = render_payload_prewarm_from_manifest_payload(
                merged_sync_payload_prewarm,
                document_analysis=getattr(render_source_pdf, "document_analysis", None),
            )
    elif payload_prewarm is None and not no_cache and render_prewarm_manifest_path is not None:
        sync_prepare_started = time.perf_counter()
        sync_payload_prewarm = build_full_sync_payload_prewarm(
            manifest_path=render_prewarm_manifest_path,
            prepared=render_source_pdf,
            source_pdf_path=render_plan.render_inputs.source_pdf_path,
            translated_pages=render_plan.selected_pages,
            effective_render_mode=render_plan.effective_render_mode,
            source_cleanup_strategy=cleanup_strategy,
        )
        merged_sync_payload_prewarm = build_sync_payload_prewarm(
            manifest_path=render_prewarm_manifest_path,
            prepared=render_source_pdf,
            payload_prewarm=sync_payload_prewarm,
        )
        render_source_sync_cache_written = persist_sync_render_source_prewarm(
            manifest_path=render_prewarm_manifest_path,
            prepared=render_source_pdf,
            source_pdf_path=render_plan.render_inputs.source_pdf_path,
            translated_pages=render_plan.selected_pages,
            effective_render_mode=render_plan.effective_render_mode,
            start_page=start,
            end_page=stop,
            pdf_compress_dpi=pdf_compress_dpi,
            source_cleanup_strategy=cleanup_strategy,
            elapsed=time.perf_counter() - sync_prepare_started,
            payload_prewarm=merged_sync_payload_prewarm,
        )
        payload_prewarm = render_payload_prewarm_from_manifest_payload(
            merged_sync_payload_prewarm,
            document_analysis=getattr(render_source_pdf, "document_analysis", None),
        )

    cover_fallback_plan = TypstCoverFallbackPlan.build(
        source_pdf_path=render_plan.render_inputs.source_pdf_path,
        translated_pages=render_plan.selected_pages,
        cleanup_strategy=cleanup_strategy,
        precleaned_page_indices=render_source_pdf.source_text_precleaned_page_indices,
        skipped_page_indices=render_source_pdf.bbox_text_strip_skipped_page_indices,
        document_analysis=document_analysis,
        source_cleanup_cover_fallback_page_indices=render_source_pdf.source_cleanup_cover_fallback_page_indices,
        source_cleanup_item_fallback_ids=(
            render_source_pdf.bbox_text_strip_candidates.uncovered_unsafe_vector_item_ids
            if render_source_pdf.bbox_text_strip_candidates is not None
            else frozenset()
        ),
    )
    context = RenderExecutionContext(
        output_pdf_path=output_pdf_path,
        start_page=start,
        end_page=stop,
        compile_workers=compile_workers,
        api_key=api_key,
        model=model,
        base_url=base_url,
        typst_font_family=typst_font_family,
        pdf_compress_dpi=pdf_compress_dpi,
        source_image_compressed=render_source_pdf.image_compressed,
        indent_detection_pdf_path=render_plan.render_inputs.source_pdf_path,
        first_line_indent_lookup=(
            payload_prewarm.first_line_indent_lookup
            if payload_prewarm is not None
            else None
        ),
        effective_inner_bbox_lookup=(
            payload_prewarm.effective_inner_bbox_lookup
            if payload_prewarm is not None
            else None
        ),
        bbox_text_stripped_page_indices=render_source_pdf.bbox_text_stripped_page_indices,
        bbox_text_strip_skipped_page_indices=render_source_pdf.bbox_text_strip_skipped_page_indices,
        source_text_precleaned_page_indices=render_source_pdf.source_text_precleaned_page_indices,
        source_cleanup_strategy=cleanup_strategy,
        background_render_page_specs=(
            cover_fallback_plan.apply_to_page_specs(payload_prewarm.background_render_page_specs)
            if payload_prewarm is not None
            else None
        ),
        prepared_overlay_pages=(
            cover_fallback_plan.apply_to_translated_pages(payload_prewarm.prepared_overlay_pages)
            if payload_prewarm is not None and payload_prewarm.prepared_overlay_pages is not None
            else None
        ),
        render_colors_by_item_id=(
            payload_prewarm.render_colors_by_item_id
            if payload_prewarm is not None
            else None
        ),
        visual_profile_path=(
            payload_prewarm.visual_profile_path
            if payload_prewarm is not None
            else None
        ),
        pdf_structure_profile_path=(
            payload_prewarm.pdf_structure_profile_path
            if payload_prewarm is not None
            else None
        ),
        overlay_source_path=(
            payload_prewarm.overlay_source_path
            if payload_prewarm is not None and not no_cache
            else None
        ),
        no_cache=no_cache,
        page_routes_by_index=document_analysis.pages if document_analysis is not None else None,
        visual_cover_page_indices=cover_fallback_plan.page_indices,
    )
    render_diagnostics: dict[str, object] = {}
    try:
        pages_rendered, render_diagnostics = _dispatch_render_mode(
            mode=render_plan.effective_render_mode,
            source_pdf_path=render_source_pdf.path,
            translated_pages=cover_fallback_plan.apply_to_translated_pages(render_plan.selected_pages),
            context=context,
            extract_selected_pages=extract_selected_pages,
        )
        return pages_rendered
    finally:
        execute_render_plan.last_render_diagnostics = {
            **render_diagnostics,
            "render_source_prewarm_hit": render_source_prewarm_hit,
            "render_payload_prewarm_hit": has_material_payload_prewarm(payload_prewarm),
            "render_document_analysis_hit": render_document_analysis_hit,
            "render_source_prewarm_manifest": str(render_prewarm_manifest_path or ""),
            "render_source_sync_cache_written": render_source_sync_cache_written,
            "render_no_cache": no_cache,
            "source_cleanup_strategy": cleanup_strategy,
            "source_text_precleaned_pages": len(render_source_pdf.source_text_precleaned_page_indices),
            "bbox_text_stripped_pages": len(render_source_pdf.bbox_text_stripped_page_indices),
            "bbox_text_strip_skipped_pages": len(render_source_pdf.bbox_text_strip_skipped_page_indices),
            "bbox_text_strip_candidate_source": (
                render_source_pdf.bbox_text_strip_candidates.candidate_source
                if render_source_pdf.bbox_text_strip_candidates is not None
                else ""
            ),
            "bbox_text_strip_candidate_pages": (
                len(render_source_pdf.bbox_text_strip_candidates.page_rects)
                if render_source_pdf.bbox_text_strip_candidates is not None
                else 0
            ),
            **cover_fallback_plan.diagnostics(),
            **document_analysis_diagnostics(document_analysis),
        }
        for temp_source_path in render_source_pdf.temp_paths:
            temp_source_path.unlink(missing_ok=True)


def _dispatch_render_mode(
    *,
    mode: str,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    context: RenderExecutionContext,
    extract_selected_pages: bool,
) -> tuple[int, dict[str, object]]:
    if mode == "dual":
        return run_dual_render(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            context=context,
        )

    if extract_selected_pages:
        return run_selected_pages_overlay_render(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            context=context,
        )

    if mode == "overlay":
        return run_overlay_render(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            context=context,
        )

    if mode in {"typst", "typst_visual"}:
        return run_background_typst_render(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            context=context,
            visual_only_background=mode == "typst_visual",
        )

    return run_overlay_render(
        source_pdf_path=source_pdf_path,
        translated_pages=translated_pages,
        context=context,
    )


def _protected_pages_for_render(translations_dir: Path) -> dict[int, list[dict]]:
    return protected_pages_from_document_path(
        Path(translations_dir).parent / "ocr" / "normalized" / "document.v1.json"
    )
