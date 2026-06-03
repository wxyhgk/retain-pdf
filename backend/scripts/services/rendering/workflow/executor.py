from __future__ import annotations

from pathlib import Path
import time

from foundation.config import fonts
from foundation.config import layout
from foundation.config import runtime
from runtime.pipeline.render_plan import RenderPlan
from services.rendering.layout.model.models import RenderLayoutBlock
from services.rendering.layout.model.models import RenderPageSpec
from services.rendering.workflow.context import RenderExecutionContext
from services.rendering.workflow.modes import run_background_typst_render
from services.rendering.workflow.modes import run_dual_render
from services.rendering.workflow.modes import run_overlay_render
from services.rendering.workflow.modes import run_selected_pages_overlay_render
from services.rendering.source.render_source import build_render_source_pdf
from services.rendering.source.prewarm import try_load_prewarmed_render_source_pdf
from services.rendering.source.prewarm import try_load_render_payload_prewarm
from services.rendering.source.prewarm_fingerprint import build_render_prewarm_fingerprint
from services.rendering.source.prewarm_manifest import write_json_atomic
from services.rendering.source.prewarm_manifest_io import build_prewarm_manifest
from services.rendering.policy import apply_typst_cover_fallback_fields
from services.rendering.analysis.risk.report import default_render_risk_report_path
from services.rendering.analysis.risk.report import write_render_risk_report
from services.rendering.analysis.risk.scanner import scan_render_risk


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
    render_source_sync_cache_written = False
    if render_source_pdf is None:
        sync_prepare_started = time.perf_counter()
        render_source_pdf = build_render_source_pdf(
            source_pdf_path=render_plan.render_inputs.source_pdf_path,
            output_pdf_path=(
                render_prewarm_manifest_path.parent / output_pdf_path.name
                if render_prewarm_manifest_path is not None
                else output_pdf_path
            ),
            pdf_compress_dpi=pdf_compress_dpi,
            translated_pages=render_plan.selected_pages,
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
        )
        render_source_sync_cache_written = _persist_sync_render_source_prewarm(
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
        )

    render_risk_diagnostics = _scan_and_write_render_risk_report(
        source_pdf_path=render_plan.render_inputs.source_pdf_path,
        output_pdf_path=output_pdf_path,
        translated_pages=render_plan.selected_pages,
        start_page=start,
        end_page=stop,
        source_text_precleaned_page_indices=render_source_pdf.source_text_precleaned_page_indices,
        bbox_text_strip_skipped_page_indices=render_source_pdf.bbox_text_strip_skipped_page_indices,
    )
    risk_cover_fallback_page_indices = _risk_cover_fallback_page_indices_from_diagnostics(render_risk_diagnostics)
    flow_rebuild_page_indices = _flow_rebuild_page_indices_from_diagnostics(render_risk_diagnostics)
    source_cleanup_fallback_page_indices = _typst_cover_fallback_page_indices(
        translated_pages=render_plan.selected_pages,
        cleanup_strategy=cleanup_strategy,
        precleaned_page_indices=render_source_pdf.source_text_precleaned_page_indices,
        skipped_page_indices=render_source_pdf.bbox_text_strip_skipped_page_indices,
    )
    fallback_page_indices = source_cleanup_fallback_page_indices | risk_cover_fallback_page_indices
    if risk_cover_fallback_page_indices:
        print(
            "render risk fallback: "
            f"cover_pages={len(risk_cover_fallback_page_indices)} "
            f"pages={sorted(risk_cover_fallback_page_indices)}",
            flush=True,
        )
    if flow_rebuild_page_indices:
        print(
            "render risk flow rebuild: "
            f"pages={len(flow_rebuild_page_indices)} "
            f"indices={sorted(flow_rebuild_page_indices)}",
            flush=True,
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
        cover_fallback_page_indices=fallback_page_indices,
        flow_rebuild_page_indices=flow_rebuild_page_indices,
        background_render_page_specs=(
            _apply_cover_fallback_to_page_specs(
                payload_prewarm.background_render_page_specs,
                fallback_page_indices,
            )
            if payload_prewarm is not None
            else None
        ),
        render_colors_by_item_id=(
            payload_prewarm.render_colors_by_item_id
            if payload_prewarm is not None
            else None
        ),
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
                fallback_page_indices=fallback_page_indices,
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
            "render_source_sync_cache_written": render_source_sync_cache_written,
            "source_cleanup_strategy": cleanup_strategy,
            "source_text_precleaned_pages": len(render_source_pdf.source_text_precleaned_page_indices),
            "bbox_text_stripped_pages": len(render_source_pdf.bbox_text_stripped_page_indices),
            "bbox_text_strip_skipped_pages": len(render_source_pdf.bbox_text_strip_skipped_page_indices),
            "source_cleanup_cover_fallback_pages": len(source_cleanup_fallback_page_indices),
            "render_cover_fallback_page_indices": sorted(fallback_page_indices),
            "render_cover_fallback_pages": len(fallback_page_indices),
            "render_flow_rebuild_page_indices": sorted(flow_rebuild_page_indices),
            "render_flow_rebuild_pages": len(flow_rebuild_page_indices),
            **render_risk_diagnostics,
        }
        for temp_source_path in render_source_pdf.temp_paths:
            temp_source_path.unlink(missing_ok=True)


def _scan_and_write_render_risk_report(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    start_page: int,
    end_page: int,
    source_text_precleaned_page_indices: frozenset[int],
    bbox_text_strip_skipped_page_indices: frozenset[int],
) -> dict[str, object]:
    try:
        report = scan_render_risk(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            start_page=start_page,
            end_page=end_page,
            source_text_precleaned_page_indices=source_text_precleaned_page_indices,
            bbox_text_strip_skipped_page_indices=bbox_text_strip_skipped_page_indices,
        )
        report_path = write_render_risk_report(default_render_risk_report_path(output_pdf_path), report)
        summary = report.summary()
        risk_cover_fallback_page_indices = _risk_cover_fallback_page_indices_from_report(report)
        hard_trigger_page_indices = frozenset(
            page.page_index
            for page in report.pages
            if page.hard_triggers
        )
        flow_rebuild_page_indices = frozenset(
            page.page_index
            for page in report.pages
            if page.suggested_action in {"partial_reflow", "full_rebuild"}
        )
        print(
            "render risk scan: "
            f"pages={summary['page_count']} high_or_hard={summary['high_or_hard_page_count']} "
            f"hard_triggers={summary['hard_trigger_count']} "
            f"risk_cover_pages={len(risk_cover_fallback_page_indices)} "
            f"flow_rebuild_pages={len(flow_rebuild_page_indices)} report={report_path}",
            flush=True,
        )
        return {
            "render_risk_report_path": str(report_path),
            "render_risk_summary": summary,
            "render_risk_cover_fallback_page_indices": sorted(risk_cover_fallback_page_indices),
            "render_risk_cover_fallback_pages": len(risk_cover_fallback_page_indices),
            "render_risk_hard_trigger_page_indices": sorted(hard_trigger_page_indices),
            "render_risk_flow_rebuild_page_indices": sorted(flow_rebuild_page_indices),
            "render_risk_flow_rebuild_pages": len(flow_rebuild_page_indices),
        }
    except Exception as exc:
        print(f"render risk scan: failed {type(exc).__name__}: {exc}", flush=True)
        return {
            "render_risk_scan_failed": True,
            "render_risk_scan_error": f"{type(exc).__name__}: {exc}",
        }


def _risk_cover_fallback_page_indices_from_report(report) -> frozenset[int]:
    return frozenset(
        page.page_index
        for page in report.pages
        if page.risk_level in {"high", "extreme"}
        or bool(page.hard_triggers)
        or page.suggested_action == "full_rebuild"
    )


def _risk_cover_fallback_page_indices_from_diagnostics(diagnostics: dict[str, object]) -> frozenset[int]:
    values = diagnostics.get("render_risk_cover_fallback_page_indices")
    if not isinstance(values, (list, tuple, set, frozenset)):
        return frozenset()
    page_indices: set[int] = set()
    for value in values:
        try:
            page_indices.add(int(value))
        except (TypeError, ValueError):
            continue
    return frozenset(page_indices)


def _flow_rebuild_page_indices_from_diagnostics(diagnostics: dict[str, object]) -> frozenset[int]:
    values = diagnostics.get("render_risk_flow_rebuild_page_indices")
    if values is None:
        values = diagnostics.get("render_risk_full_rebuild_page_indices")
    if not isinstance(values, (list, tuple, set, frozenset)):
        return frozenset()
    page_indices: set[int] = set()
    for value in values:
        try:
            page_indices.add(int(value))
        except (TypeError, ValueError):
            continue
    return frozenset(page_indices)


def _persist_sync_render_source_prewarm(
    *,
    manifest_path: Path | None,
    prepared,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    effective_render_mode: str,
    start_page: int,
    end_page: int,
    pdf_compress_dpi: int,
    source_cleanup_strategy: str,
    elapsed: float,
) -> bool:
    if manifest_path is None:
        return False
    try:
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest = build_prewarm_manifest(
            manifest_path=manifest_path,
            prepared=prepared,
            fingerprint=build_render_prewarm_fingerprint(
                source_pdf_path=source_pdf_path,
                translated_pages=translated_pages,
                effective_render_mode=effective_render_mode,
                start_page=start_page,
                end_page=end_page,
                pdf_compress_dpi=pdf_compress_dpi,
                source_cleanup_strategy=source_cleanup_strategy,
            ),
            elapsed=elapsed,
        )
        write_json_atomic(manifest_path, manifest)
        print(f"render prewarm: cached synchronous source manifest={manifest_path}", flush=True)
        return True
    except Exception as exc:
        print(f"render prewarm: sync source cache write failed {type(exc).__name__}: {exc}", flush=True)
        return False


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
    fallback_page_indices: frozenset[int] | None = None,
) -> dict[int, list[dict]]:
    page_indices = (
        fallback_page_indices
        if fallback_page_indices is not None
        else _typst_cover_fallback_page_indices(
            translated_pages=translated_pages,
            cleanup_strategy=cleanup_strategy,
            precleaned_page_indices=precleaned_page_indices,
            skipped_page_indices=skipped_page_indices,
        )
    )
    prepared = apply_typst_cover_fallback_fields(
        translated_pages,
        page_indices,
    )
    return prepared


def _apply_cover_fallback_to_page_specs(
    page_specs: list[RenderPageSpec] | None,
    page_indices: frozenset[int],
) -> list[RenderPageSpec] | None:
    if not page_specs or not page_indices:
        return page_specs
    patched_specs: list[RenderPageSpec] = []
    for spec in page_specs:
        if spec.page_index not in page_indices:
            patched_specs.append(spec)
            continue
        patched_specs.append(
            RenderPageSpec(
                page_index=spec.page_index,
                page_width_pt=spec.page_width_pt,
                page_height_pt=spec.page_height_pt,
                background_pdf_path=spec.background_pdf_path,
                blocks=[
                    RenderLayoutBlock(
                        **{
                            **block.__dict__,
                            "use_cover_fill": True,
                            "skip_reason": block.skip_reason or "typst_cover_fallback",
                        }
                    )
                    for block in spec.blocks
                ],
                source_page_index=spec.source_page_index,
                background_page_index=spec.background_page_index,
                is_flow_continuation=spec.is_flow_continuation,
            )
        )
    return patched_specs


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

    if context.flow_rebuild_page_indices and mode not in {"typst", "typst_visual"}:
        print(
            "render mode upgrade: flow rebuild requires typst_visual background render",
            flush=True,
        )
        return run_background_typst_render(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            context=context,
            visual_only_background=True,
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
