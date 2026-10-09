from __future__ import annotations

import os
from pathlib import Path
import time

from retainpdf_pipeline.foundation.config import fonts
from retainpdf_pipeline.foundation.config import layout
from retainpdf_pipeline.foundation.config import runtime
from retainpdf_pipeline.foundation.config.output_layout import ARTIFACTS_DIR_NAME
from retainpdf_pipeline.render.prepare.hooks import prepare_hooks
from retainpdf_pipeline.render.prepare.routes import route_prepare_needs
from retainpdf_pipeline.render.visual_profile.io import visual_profile_path_from_prewarm_manifest
from retainpdf_pipeline.render.workflow.route_visual_profile import build_route_visual_profile
from retainpdf_pipeline.render.prepare.store import PREPARE_DIR_NAME
from retainpdf_pipeline.render.render_plan import RenderPlan
from retainpdf_pipeline.render.workflow.context import RenderExecutionContext
from retainpdf_pipeline.render.workflow.cover_fallback import TypstCoverFallbackPlan
from retainpdf_pipeline.render.workflow.document_analysis import document_analysis_diagnostics
from retainpdf_pipeline.render.workflow.document_analysis import document_analysis_prewarm_hit
from retainpdf_pipeline.render.workflow.document_analysis import build_sync_workflow_document_analysis
from retainpdf_pipeline.render.workflow.document_analysis import resolve_cached_workflow_document_analysis
from retainpdf_pipeline.render.workflow.engine_dispatch import dispatch_with_render_engine
from retainpdf_pipeline.render.workflow.modes import RENDER_MODE_HANDLERS
from retainpdf_pipeline.render.workflow.modes import _compress_final_pdf_if_needed
from retainpdf_pipeline.render.workflow.modes import _should_fast_save
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
from retainpdf_pipeline.services.pipeline_shared.events import emit_render_prepare_progress


RENDER_PREPARE_STEPS: tuple[tuple[str, str], ...] = (
    ("document_analysis", "分析页面结构"),
    ("source_cleanup", "清理文字层"),
    ("payload_layout_color", "计算版式与配色"),
    ("background_specs", "生成背景规格"),
)


class _RenderPrepareProgress:
    """Main-lane progress for the synchronous (cold) render preparation.

    Each step reports ``index - 1`` completed steps when it starts; ``finish``
    reports all steps done. Nothing is emitted when every input came from the
    prewarm cache, so warm renders go straight to page progress.
    """

    def __init__(self) -> None:
        self._last_index = 0

    @property
    def started(self) -> bool:
        return self._last_index > 0

    def step(self, index: int) -> None:
        if index <= self._last_index:
            return
        self._last_index = index
        key, label = RENDER_PREPARE_STEPS[index - 1]
        total = len(RENDER_PREPARE_STEPS)
        emit_render_prepare_progress(
            current=index - 1,
            total=total,
            message=f"渲染准备：正在{label}（{index}/{total}）",
            payload={"render_prepare_step": key, "render_prepare_step_label": label},
        )

    def finish(self) -> None:
        if not self.started:
            return
        total = len(RENDER_PREPARE_STEPS)
        self.step(total)
        self._last_index = total + 1
        emit_render_prepare_progress(
            current=total,
            total=total,
            message="渲染准备完成",
            payload={"render_prepare_step": "done"},
        )


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
    render_engine: str = "typst",
) -> int:
    start = max(0, start_page)
    stop = max(render_plan.selected_pages) if end_page < 0 else end_page
    cleanup_strategy = layout.normalize_source_cleanup_strategy(source_cleanup_strategy)
    no_cache = render_no_cache_enabled()
    if no_cache:
        render_prewarm_manifest_path = None
    # 渲染准备步骤的缓存（render/prepare）；no_cache 时不读不写。
    prepare_dir = (
        None
        if no_cache
        else Path(render_plan.render_inputs.translations_dir).parent / ARTIFACTS_DIR_NAME / PREPARE_DIR_NAME
    )
    hooks = prepare_hooks(prepare_dir)
    # 路线声明：rpr_fit 不要完整版式 payload（⑤），只读不写 prewarm manifest，底色 / 字色单独算。
    needs = route_prepare_needs(render_engine)
    lean = not needs.payload_layout and not no_cache and render_prewarm_manifest_path is not None
    lean_visual_profile_path: Path | None = None
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
    prepare_progress = _RenderPrepareProgress()
    if document_analysis is None:
        prepare_progress.step(1)
        analysis_started = time.perf_counter()
        document_analysis = build_sync_workflow_document_analysis(
            source_pdf_path=render_plan.render_inputs.source_pdf_path,
            translated_pages=render_plan.selected_pages,
            start_page=start,
            end_page=stop,
            prepare_dir=prepare_dir,
        )
        print(
            "render document analysis: "
            f"sync pages={len(document_analysis.pages)} elapsed={time.perf_counter() - analysis_started:.2f}s",
            flush=True,
        )
    protected_pages = _protected_pages_for_render(render_plan.render_inputs.translations_dir)
    render_source_sync_cache_written = False
    if render_source_pdf is None:
        prepare_progress.step(2)
        sync_prepare_started = time.perf_counter()
        pdf_structure_profile_path = (
            payload_prewarm.pdf_structure_profile_path
            if payload_prewarm is not None
            else None
        )
        if pdf_structure_profile_path is None and render_prewarm_manifest_path is not None and not lean:
            pdf_structure_profile_path, _pdf_structure_profile = ensure_pdf_structure_profile(
                source_pdf_path=render_plan.render_inputs.source_pdf_path,
                translated_pages=render_plan.selected_pages,
                manifest_path=render_prewarm_manifest_path,
                prepare_hooks=hooks,
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
            prepare_hooks=hooks,
        )
        if not no_cache:
            prepare_progress.step(3)
        if lean:
            lean_visual_profile_path = _route_visual_profile(render_plan, prepare_dir, render_prewarm_manifest_path)
        sync_payload_prewarm = (
            {}
            if no_cache or lean
            else build_full_sync_payload_prewarm(
                manifest_path=render_prewarm_manifest_path,
                prepared=render_source_pdf,
                source_pdf_path=render_plan.render_inputs.source_pdf_path,
                translated_pages=render_plan.selected_pages,
                effective_render_mode=render_plan.effective_render_mode,
                source_cleanup_strategy=cleanup_strategy,
                prepare_hooks=hooks,
            )
        )
        prepare_progress.step(4)
        merged_sync_payload_prewarm = (
            {}
            if no_cache or lean
            else build_sync_payload_prewarm(
                manifest_path=render_prewarm_manifest_path,
                prepared=render_source_pdf,
                payload_prewarm=sync_payload_prewarm,
            )
        )
        render_source_sync_cache_written = (
            False
            if no_cache or lean
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
        if payload_prewarm is None and not no_cache and not lean:
            payload_prewarm = render_payload_prewarm_from_manifest_payload(
                merged_sync_payload_prewarm,
                document_analysis=getattr(render_source_pdf, "document_analysis", None),
            )
    elif payload_prewarm is None and lean:
        prepare_progress.step(3)
        lean_visual_profile_path = _route_visual_profile(render_plan, prepare_dir, render_prewarm_manifest_path)
    elif payload_prewarm is None and not no_cache and render_prewarm_manifest_path is not None:
        prepare_progress.step(3)
        sync_prepare_started = time.perf_counter()
        sync_payload_prewarm = build_full_sync_payload_prewarm(
            manifest_path=render_prewarm_manifest_path,
            prepared=render_source_pdf,
            source_pdf_path=render_plan.render_inputs.source_pdf_path,
            translated_pages=render_plan.selected_pages,
            effective_render_mode=render_plan.effective_render_mode,
            source_cleanup_strategy=cleanup_strategy,
            prepare_hooks=hooks,
        )
        prepare_progress.step(4)
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

    if prepare_progress.started:
        prepare_progress.step(4)
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
            else lean_visual_profile_path
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
        visual_cover_page_indices=cover_fallback_plan.page_indices,
        render_engine=render_engine,
        document_path=_document_path_for_render(render_plan.render_inputs.translations_dir),
        prepare_dir=prepare_dir,
    )
    prepare_progress.finish()
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
            "render_prepare_lean": lean,
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


def _route_visual_profile(render_plan: RenderPlan, prepare_dir: Path, manifest_path: Path) -> Path | None:
    return build_route_visual_profile(
        prepare_dir=prepare_dir,
        source_pdf_path=render_plan.render_inputs.source_pdf_path,
        translated_pages=render_plan.selected_pages,
        target_path=visual_profile_path_from_prewarm_manifest(manifest_path),
    )


def _dispatch_render_mode(
    *,
    mode: str,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    context: RenderExecutionContext,
    extract_selected_pages: bool,
) -> tuple[int, dict[str, object]]:
    return dispatch_with_render_engine(
        mode=mode,
        source_pdf_path=source_pdf_path,
        translated_pages=translated_pages,
        context=context,
        extract_selected_pages=extract_selected_pages,
        typst_dispatch=lambda: _dispatch_typst_render_mode(
            mode=mode,
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            context=context,
            extract_selected_pages=extract_selected_pages,
        ),
        compress_final=lambda ctx, label: _compress_final_pdf_if_needed(ctx, mode=label),
        fast_save=_should_fast_save(context),
    )


def _dispatch_typst_render_mode(
    *,
    mode: str,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    context: RenderExecutionContext,
    extract_selected_pages: bool,
) -> tuple[int, dict[str, object]]:
    if extract_selected_pages:
        return run_selected_pages_overlay_render(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            context=context,
        )
    try:
        handler = RENDER_MODE_HANDLERS[mode]
    except KeyError:
        raise ValueError(
            f"unknown render mode: {mode!r} (expected one of {sorted(RENDER_MODE_HANDLERS)})"
        ) from None
    return handler(
        source_pdf_path=source_pdf_path,
        translated_pages=translated_pages,
        context=context,
    )


def _document_path_for_render(translations_dir: Path) -> Path:
    return Path(translations_dir).parent / "ocr" / "normalized" / "document.v1.json"


def _protected_pages_for_render(translations_dir: Path) -> dict[int, list[dict]]:
    return protected_pages_from_document_path(_document_path_for_render(translations_dir))
