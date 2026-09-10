from __future__ import annotations

import time
from pathlib import Path

from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_progress
from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_transition
from retainpdf_pipeline.translate.artifacts import TranslationRunDiagnostics
from retainpdf_pipeline.translate.llm.shared.control_context import TranslationControlContext
from retainpdf_pipeline.translate.workflow.batching.pending_units import translate_pending_units
from retainpdf_pipeline.translate.workflow.phases.events import format_translation_progress_message


def run_translation_batch_stage(
    *,
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
    batch_size: int,
    workers: int,
    api_key: str,
    model: str,
    base_url: str,
    domain_guidance: str,
    mode: str,
    translation_context: TranslationControlContext | None,
    run_diagnostics: TranslationRunDiagnostics | None,
    flush_callback=None,
) -> dict:
    translate_started = time.perf_counter()
    if run_diagnostics is not None:
        run_diagnostics.mark_phase_start("translation_batches")
    emit_stage_transition(
        stage="translating",
        substage="translation_batches",
        message="开始批量翻译",
    )
    batch_summary: dict = {}
    try:
        batch_summary = translate_pending_units(
            page_payloads=page_payloads,
            translation_paths=translation_paths,
            batch_size=batch_size,
            workers=max(1, workers),
            api_key=api_key,
            model=model,
            base_url=base_url,
            domain_guidance=domain_guidance,
            mode=mode,
            translation_context=translation_context,
            flush_callback=flush_callback,
            stats_callback=batch_summary.update,
            progress_callback=lambda current, total, touched_pages, substage: emit_stage_progress(
                stage="translating",
                substage=substage,
                message=format_translation_progress_message(current, total, touched_pages, substage=substage),
                progress_current=current,
                progress_total=total,
                payload={
                    "substage": substage,
                    "touched_page_indexes": sorted(touched_pages),
                    "touched_page_numbers": [page_idx + 1 for page_idx in sorted(touched_pages)],
                },
            ),
        )
    finally:
        if run_diagnostics is not None:
            # Phase end records duration, not successful completion. Failure
            # keeps propagating and never reaches the success event below.
            run_diagnostics.mark_phase_end("translation_batches")
            _record_batch_diagnostics(run_diagnostics, batch_summary)
    emit_stage_progress(
        stage="translating",
        substage="translation_batches",
        message="翻译批次完成",
        progress_current=batch_summary["total_batches"],
        progress_total=batch_summary["total_batches"],
        elapsed_ms=int((time.perf_counter() - translate_started) * 1000),
        payload={
            "substage": "translation_batches",
            "pending_items": batch_summary["pending_items"],
            "effective_batch_size": batch_summary["effective_batch_size"],
            "fast_queue_workers": batch_summary.get("fast_queue_workers", 0),
            "apply_elapsed_ms": batch_summary.get("apply_elapsed_ms", 0),
            "max_result_drain_batch": batch_summary.get("max_result_drain_batch", 0),
            "tail_retry_items": batch_summary.get("tail_retry_items", 0),
            "flush_elapsed_ms": batch_summary.get("flush_elapsed_ms", 0),
        },
    )
    print(f"book: translation batches in {time.perf_counter() - translate_started:.2f}s", flush=True)
    return batch_summary


def _record_batch_diagnostics(run_diagnostics: TranslationRunDiagnostics, batch_summary: dict) -> None:
    if batch_summary:
        run_diagnostics.set_effective_translation_batch_size(batch_summary["effective_batch_size"])
        run_diagnostics.set_workload(
            pending_items=batch_summary["pending_items"],
            total_batches=batch_summary["total_batches"],
        )
        run_diagnostics.set_translation_queue_workers(
            batched_fast_workers=batch_summary.get("batched_fast_workers", 0),
            single_fast_workers=batch_summary.get("single_fast_workers", 0),
            single_slow_workers=batch_summary.get("single_slow_workers", 0),
            slow_worker_limit=batch_summary.get("slow_worker_limit", 0),
            batched_fast_batches=batch_summary.get("batched_fast_batches", 0),
            single_fast_batches=batch_summary.get("single_fast_batches", 0),
            single_slow_batches=batch_summary.get("single_slow_batches", 0),
            shared_workers=batch_summary.get("shared_workers", 0),
        )
        run_diagnostics.set_translation_result_stats(
            applied_batches=batch_summary.get("applied_batches", 0),
            apply_elapsed_ms=batch_summary.get("apply_elapsed_ms", 0),
            max_result_drain_batch=batch_summary.get("max_result_drain_batch", 0),
            flush_count=batch_summary.get("flush_count", 0),
            flushed_page_total=batch_summary.get("flushed_page_total", 0),
            flush_elapsed_ms=batch_summary.get("flush_elapsed_ms", 0),
            flush_callback_elapsed_ms=batch_summary.get("flush_callback_elapsed_ms", 0),
            flush_total_elapsed_ms=batch_summary.get("flush_total_elapsed_ms", 0),
            flush_commit_count=batch_summary.get("flush_commit_count", 0),
            flush_callback_failed_count=batch_summary.get("flush_callback_failed_count", 0),
            max_flush_pages=batch_summary.get("max_flush_pages", 0),
            tail_retry_drains=batch_summary.get("tail_retry_drains", 0),
            tail_retry_items=batch_summary.get("tail_retry_items", 0),
            tail_retry_completed=batch_summary.get("tail_retry_completed", 0),
            tail_retry_failed=batch_summary.get("tail_retry_failed", 0),
            tail_retry_elapsed_ms=batch_summary.get("tail_retry_elapsed_ms", 0),
            early_tail_retry_drains=batch_summary.get("early_tail_retry_drains", 0),
            final_tail_retry_drains=batch_summary.get("final_tail_retry_drains", 0),
        )


__all__ = ["run_translation_batch_stage"]
