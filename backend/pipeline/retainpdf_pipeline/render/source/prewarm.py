from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import time

from retainpdf_pipeline.foundation.config import layout
from retainpdf_pipeline.render.render_mode import resolve_effective_render_mode
from retainpdf_pipeline.render.semantics.page_range import resolve_page_range
from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_progress
from retainpdf_pipeline.services.pipeline_shared.events import get_active_pipeline_event_writer
from retainpdf_pipeline.services.pipeline_shared.events import pipeline_event_writer_scope
from retainpdf_pipeline.render.source.render_source import build_render_source_pdf
from retainpdf_pipeline.render.source.prewarm_manifest import write_json_atomic
from retainpdf_pipeline.render.source.prewarm_contracts import PAYLOAD_RENDER_ALGORITHM_VERSION
from retainpdf_pipeline.render.source.prewarm_contracts import RenderPayloadPrewarm
from retainpdf_pipeline.render.source.prewarm_contracts import RenderPrewarmHandle
from retainpdf_pipeline.render.source.prewarm_contracts import RenderPrewarmSpec
from retainpdf_pipeline.render.source.prewarm_contracts import prewarm_manifest_path_from_artifacts_dir
from retainpdf_pipeline.render.source.prewarm_contracts import prewarm_manifest_path_from_translations_dir
from retainpdf_pipeline.render.source.prewarm_fingerprint import build_render_prewarm_fingerprint
from retainpdf_pipeline.render.source.prewarm_manifest_io import build_prewarm_manifest
from retainpdf_pipeline.render.source.prewarm_manifest_io import load_matching_manifest
from retainpdf_pipeline.render.source.prewarm_manifest_io import try_load_prewarmed_render_source_pdf
from retainpdf_pipeline.render.source.prewarm_manifest_io import try_load_render_payload_prewarm
from retainpdf_pipeline.render.source.prewarm_payload import build_payload_prewarm
from retainpdf_pipeline.render.source.prewarm_payload import ensure_pdf_structure_profile
from retainpdf_pipeline.render.source_cleanup.protected_blocks import protected_pages_from_document_path


def start_render_source_prewarm(spec: RenderPrewarmSpec) -> RenderPrewarmHandle:
    manifest_path = prewarm_manifest_path_from_artifacts_dir(spec.artifacts_dir)
    event_writer = get_active_pipeline_event_writer()
    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="render-prewarm")
    future = executor.submit(_run_render_source_prewarm_with_events, spec, manifest_path, event_writer)
    return RenderPrewarmHandle(manifest_path=manifest_path, future=future, executor=executor)


def _run_render_source_prewarm_with_events(spec: RenderPrewarmSpec, manifest_path: Path, event_writer) -> Path | None:
    if event_writer is None:
        return _run_render_source_prewarm(spec, manifest_path)
    with pipeline_event_writer_scope(event_writer):
        return _run_render_source_prewarm(spec, manifest_path)


def _run_render_source_prewarm(spec: RenderPrewarmSpec, manifest_path: Path) -> Path | None:
    started = time.perf_counter()
    try:
        prewarm_dir = manifest_path.parent
        prewarm_dir.mkdir(parents=True, exist_ok=True)
        resolved_start, resolved_stop = resolve_page_range(
            _prewarm_page_range_total(spec),
            spec.start_page,
            spec.end_page,
        )
        document_analysis = spec.document_analysis
        effective_render_mode = resolve_effective_render_mode(
            render_mode=spec.render_mode,
            source_pdf_path=spec.source_pdf_path,
            start_page=spec.start_page,
            end_page=spec.end_page,
            translated_pages_map=_pages_for_prewarm_mode_probe(spec.translated_pages),
            document_analysis=document_analysis,
        )
        prepared = _load_existing_render_source(
            spec,
            manifest_path,
            effective_render_mode,
            start_page=resolved_start,
            end_page=resolved_stop,
        )
        pdf_structure_profile_path = None
        if spec.include_source_cleanup:
            pdf_structure_profile_path, _pdf_structure_profile = ensure_pdf_structure_profile(
                source_pdf_path=spec.source_pdf_path,
                translated_pages=spec.translated_pages,
                manifest_path=manifest_path,
            )
        if prepared is None:
            cleanup_strategy = spec.source_cleanup_strategy if spec.include_source_cleanup else layout.SOURCE_CLEANUP_TYPST_FILL
            protected_pages = _protected_pages_for_prewarm(spec.artifacts_dir)
            prepared = build_render_source_pdf(
                source_pdf_path=spec.source_pdf_path,
                output_pdf_path=prewarm_dir / spec.output_pdf_path.name,
                pdf_compress_dpi=spec.pdf_compress_dpi,
                translated_pages=spec.translated_pages,
                protected_pages=protected_pages,
                strip_hidden_text=effective_render_mode != "overlay",
                start_page=resolved_start,
                end_page=resolved_stop,
                artifact_mode=True,
                source_cleanup_strategy=cleanup_strategy,
                document_analysis=document_analysis,
                pdf_structure_profile_path=pdf_structure_profile_path,
            )
        payload_prewarm = build_payload_prewarm(
            source_pdf_path=spec.source_pdf_path,
            translated_pages=spec.translated_pages,
            manifest_path=manifest_path,
            effective_render_mode=effective_render_mode,
            source_cleanup_strategy=(
                spec.source_cleanup_strategy
                if spec.include_source_cleanup
                else layout.SOURCE_CLEANUP_TYPST_FILL
            ),
            bbox_text_strip_candidates=prepared.bbox_text_strip_candidates if spec.include_source_cleanup else None,
        )
        manifest = build_prewarm_manifest(
            manifest_path=manifest_path,
            prepared=prepared,
            fingerprint=build_render_prewarm_fingerprint(
                source_pdf_path=spec.source_pdf_path,
                translated_pages=spec.translated_pages,
                effective_render_mode=effective_render_mode,
                start_page=resolved_start,
                end_page=resolved_stop,
                pdf_compress_dpi=spec.pdf_compress_dpi,
                source_cleanup_strategy=spec.source_cleanup_strategy if spec.include_source_cleanup else layout.SOURCE_CLEANUP_TYPST_FILL,
            ),
            elapsed=time.perf_counter() - started,
            payload_prewarm=payload_prewarm,
            document_analysis=prepared.document_analysis or document_analysis,
        )
        write_json_atomic(manifest_path, manifest)
        emit_stage_progress(
            stage="render_preprocess",
            substage="render_prewarm",
            message=f"渲染预热完成，mode={effective_render_mode} pages={len(spec.translated_pages)}",
            progress_current=3,
            progress_total=3,
            elapsed_ms=int((time.perf_counter() - started) * 1000),
            payload={
                "user_stage": "render",
                "progress_unit": "step",
                "effective_render_mode": effective_render_mode,
                "page_count": len(spec.translated_pages),
                "manifest_path": str(manifest_path),
            },
        )
        print(f"render prewarm: ready elapsed={time.perf_counter() - started:.2f}s manifest={manifest_path}", flush=True)
        return manifest_path
    except Exception as exc:
        emit_stage_progress(
            stage="render_preprocess",
            substage="render_prewarm",
            message=f"渲染预热失败：{type(exc).__name__}: {exc}",
            progress_current=3,
            progress_total=3,
            elapsed_ms=int((time.perf_counter() - started) * 1000),
            payload={
                "user_stage": "render",
                "progress_unit": "step",
                "error_type": type(exc).__name__,
            },
        )
        print(f"render prewarm: failed {type(exc).__name__}: {exc}", flush=True)
        return None


def _load_existing_render_source(
    spec: RenderPrewarmSpec,
    manifest_path: Path,
    effective_render_mode: str,
    *,
    start_page: int,
    end_page: int,
):
    if not manifest_path.exists():
        return None
    manifest = load_matching_manifest(
        manifest_path=manifest_path,
        source_pdf_path=spec.source_pdf_path,
        translated_pages=spec.translated_pages,
        effective_render_mode=effective_render_mode,
        start_page=start_page,
        end_page=end_page,
        pdf_compress_dpi=spec.pdf_compress_dpi,
        source_cleanup_strategy=spec.source_cleanup_strategy,
        match_payload=False,
    )
    if manifest is None:
        return None
    prepared = try_load_prewarmed_render_source_pdf(
        manifest_path=manifest_path,
        source_pdf_path=spec.source_pdf_path,
        translated_pages=spec.translated_pages,
        effective_render_mode=effective_render_mode,
        start_page=start_page,
        end_page=end_page,
        pdf_compress_dpi=spec.pdf_compress_dpi,
        source_cleanup_strategy=spec.source_cleanup_strategy,
    )
    if prepared is not None:
        print("render prewarm: reusing existing source; refreshing payload prewarm", flush=True)
    return prepared


def _pages_for_prewarm_mode_probe(translated_pages: dict[int, list[dict]]) -> dict[int, list[dict]]:
    probed: dict[int, list[dict]] = {}
    for page_idx, items in translated_pages.items():
        probed_items: list[dict] = []
        for item in items:
            clone = dict(item)
            if not str(
                clone.get("render_protected_text")
                or clone.get("protected_translated_text")
                or clone.get("translated_text")
                or ""
            ).strip():
                source_text = str(
                    clone.get("translation_unit_protected_source_text")
                    or clone.get("protected_source_text")
                    or clone.get("source_text")
                    or ""
                ).strip()
                if source_text:
                    clone["render_protected_text"] = source_text
            probed_items.append(clone)
        probed[page_idx] = probed_items
    return probed


def _prewarm_page_range_total(spec: RenderPrewarmSpec) -> int:
    candidates = [len(spec.translated_pages), spec.start_page + 1]
    if spec.end_page >= 0:
        candidates.append(spec.end_page + 1)
    if spec.translated_pages:
        candidates.append(max(spec.translated_pages.keys()) + 1)
    return max(candidates)


def _protected_pages_for_prewarm(artifacts_dir: Path) -> dict[int, list[dict]]:
    return protected_pages_from_document_path(
        Path(artifacts_dir).parent / "ocr" / "normalized" / "document.v1.json"
    )


__all__ = [
    "PAYLOAD_RENDER_ALGORITHM_VERSION",
    "RenderPayloadPrewarm",
    "RenderPrewarmHandle",
    "RenderPrewarmSpec",
    "build_render_prewarm_fingerprint",
    "prewarm_manifest_path_from_artifacts_dir",
    "prewarm_manifest_path_from_translations_dir",
    "start_render_source_prewarm",
    "try_load_prewarmed_render_source_pdf",
    "try_load_render_payload_prewarm",
]
