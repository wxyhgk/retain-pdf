from __future__ import annotations

from pathlib import Path

from foundation.config import fonts
from foundation.config import layout
from foundation.config import runtime
from runtime.pipeline.render_plan import RenderPlan
from services.rendering.workflow.context import RenderExecutionContext
from services.rendering.workflow.modes import run_background_typst_render
from services.rendering.workflow.modes import run_dual_render
from services.rendering.workflow.modes import run_overlay_render
from services.rendering.workflow.modes import run_selected_pages_overlay_render
from services.rendering.source.render_source import build_render_source_pdf
from services.rendering.source.prewarm import try_load_prewarmed_render_source_pdf
from services.rendering.source.prewarm import try_load_render_payload_prewarm
from services.rendering.policy import apply_typst_cover_fallback_fields


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
    if render_source_pdf is None:
        render_source_pdf = build_render_source_pdf(
            source_pdf_path=render_plan.render_inputs.source_pdf_path,
            output_pdf_path=output_pdf_path,
            pdf_compress_dpi=pdf_compress_dpi,
            translated_pages=render_plan.selected_pages,
            strip_hidden_text=render_plan.effective_render_mode != "overlay",
            start_page=start,
            end_page=stop,
            bbox_text_strip_candidates=(
                payload_prewarm.bbox_text_strip_candidates
                if payload_prewarm is not None
                else None
            ),
            source_cleanup_strategy=cleanup_strategy,
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
    )
    render_diagnostics: dict[str, object] = {}
    try:
        pages_rendered, render_diagnostics = _dispatch_render_mode(
            mode=render_plan.effective_render_mode,
            source_pdf_path=render_source_pdf.path,
            translated_pages=_prepare_translated_pages_for_source_cleanup(
                translated_pages=render_plan.selected_pages,
                cleanup_strategy=cleanup_strategy,
                precleaned_page_indices=render_source_pdf.source_text_precleaned_page_indices,
                skipped_page_indices=render_source_pdf.bbox_text_strip_skipped_page_indices,
            ),
            context=context,
            extract_selected_pages=extract_selected_pages,
        )
        return pages_rendered
    finally:
        execute_render_plan.last_render_diagnostics = {
            **render_diagnostics,
            "render_source_prewarm_hit": render_source_prewarm_hit,
            "render_payload_prewarm_hit": payload_prewarm is not None,
            "render_source_prewarm_manifest": str(render_prewarm_manifest_path or ""),
            "source_cleanup_strategy": cleanup_strategy,
            "source_text_precleaned_pages": len(render_source_pdf.source_text_precleaned_page_indices),
            "bbox_text_stripped_pages": len(render_source_pdf.bbox_text_stripped_page_indices),
            "bbox_text_strip_skipped_pages": len(render_source_pdf.bbox_text_strip_skipped_page_indices),
        }
        for temp_source_path in render_source_pdf.temp_paths:
            temp_source_path.unlink(missing_ok=True)


def _typst_cover_fallback_page_indices(
    *,
    translated_pages: dict[int, list[dict]],
    cleanup_strategy: str,
    precleaned_page_indices: frozenset[int],
    skipped_page_indices: frozenset[int],
) -> frozenset[int]:
    if cleanup_strategy == "pikepdf_text_strip":
        return frozenset(page_idx for page_idx, items in translated_pages.items() if items) - precleaned_page_indices
    return skipped_page_indices


def _prepare_translated_pages_for_source_cleanup(
    *,
    translated_pages: dict[int, list[dict]],
    cleanup_strategy: str,
    precleaned_page_indices: frozenset[int],
    skipped_page_indices: frozenset[int],
) -> dict[int, list[dict]]:
    prepared = apply_typst_cover_fallback_fields(
        translated_pages,
        _typst_cover_fallback_page_indices(
            translated_pages=translated_pages,
            cleanup_strategy=cleanup_strategy,
            precleaned_page_indices=precleaned_page_indices,
            skipped_page_indices=skipped_page_indices,
        ),
    )
    return prepared


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
