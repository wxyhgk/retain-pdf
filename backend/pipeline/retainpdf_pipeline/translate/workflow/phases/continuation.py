from __future__ import annotations

import time
from pathlib import Path

from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_progress
from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_transition
from retainpdf_pipeline.translate.artifacts import TranslationRunDiagnostics
from retainpdf_pipeline.translate.llm.shared.provider_runtime import request_chat_content
from retainpdf_pipeline.translate.workflow.page_policies import finalize_page_payloads
from retainpdf_pipeline.translate.workflow.page_policies import review_and_apply_continuations


def run_initial_continuation_pass(
    *,
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
) -> None:
    stage_started = time.perf_counter()
    finalize_page_payloads(
        page_payloads=page_payloads,
        translation_paths=translation_paths,
    )
    emit_stage_progress(
        stage="continuation_review",
        substage="continuation_review",
        message="初始连续段整理完成",
        elapsed_ms=int((time.perf_counter() - stage_started) * 1000),
        payload={"page_count": len(page_payloads)},
    )
    print(f"book: initial continuation pass in {time.perf_counter() - stage_started:.2f}s", flush=True)


def run_continuation_review(
    *,
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
    api_key: str,
    model: str,
    base_url: str,
    workers: int,
    run_diagnostics: TranslationRunDiagnostics | None,
) -> None:
    review_started = time.perf_counter()
    emit_stage_transition(
        stage="continuation_review",
        substage="continuation_review",
        message="开始复核跨栏/跨页连续段",
        progress_current=0,
        progress_total=len(page_payloads),
    )
    if run_diagnostics is not None:
        run_diagnostics.mark_phase_start("continuation_review")
    review_and_apply_continuations(
        page_payloads=page_payloads,
        translation_paths=translation_paths,
        api_key=api_key,
        model=model,
        base_url=base_url,
        workers=workers,
        request_chat_content_fn=request_chat_content,
        progress_callback=lambda current, total: emit_stage_progress(
            stage="continuation_review",
            substage="continuation_review",
            message=f"正在判断跨栏/跨页连续段，第 {current}/{total} 批",
            progress_current=current,
            progress_total=total,
            payload={"progress_unit": "page"},
        ),
    )
    if run_diagnostics is not None:
        run_diagnostics.mark_phase_end("continuation_review")
    emit_stage_progress(
        stage="continuation_review",
        substage="continuation_review",
        message="跨栏/跨页连续段复核完成",
        progress_current=len(page_payloads),
        progress_total=len(page_payloads),
        elapsed_ms=int((time.perf_counter() - review_started) * 1000),
    )
    print(f"book: continuation review in {time.perf_counter() - review_started:.2f}s", flush=True)


__all__ = [
    "run_continuation_review",
    "run_initial_continuation_pass",
]
