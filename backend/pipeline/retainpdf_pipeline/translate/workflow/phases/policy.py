from __future__ import annotations

import time

from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_progress
from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_transition
from retainpdf_pipeline.translate.artifacts import TranslationRunDiagnostics
from retainpdf_pipeline.translate.llm.shared.provider_runtime import request_chat_content
from retainpdf_pipeline.translate.services.policy import TranslationPolicyConfig
from retainpdf_pipeline.translate.workflow.page_policies import apply_page_policies


def run_page_policy_stage(
    *,
    page_payloads: dict[int, list[dict]],
    mode: str,
    classify_batch_size: int,
    workers: int,
    api_key: str,
    model: str,
    base_url: str,
    skip_title_translation: bool,
    sci_cutoff_page_idx: int | None,
    sci_cutoff_block_idx: int | None,
    policy_config: TranslationPolicyConfig | None,
    run_diagnostics: TranslationRunDiagnostics | None,
) -> int:
    policy_started = time.perf_counter()
    if run_diagnostics is not None:
        run_diagnostics.mark_phase_start("page_policies")
    emit_stage_transition(
        stage="page_policies",
        substage="page_policies",
        message="开始执行页面策略和块分类",
        progress_current=0,
        progress_total=len(page_payloads),
    )
    print("book: page policies start", flush=True)
    print(f"book: page policies mode={mode} total_pages={len(page_payloads)}", flush=True)
    classified_items = apply_page_policies(
        page_payloads=page_payloads,
        mode=mode,
        classify_batch_size=max(1, classify_batch_size),
        workers=max(1, workers),
        api_key=api_key,
        model=model,
        base_url=base_url,
        skip_title_translation=skip_title_translation,
        sci_cutoff_page_idx=sci_cutoff_page_idx,
        sci_cutoff_block_idx=sci_cutoff_block_idx,
        policy_config=policy_config,
        request_chat_content_fn=request_chat_content,
        progress_callback=lambda current, total, page_idx, page_classified: emit_stage_progress(
            stage="page_policies",
            substage="page_policies",
            message=f"正在执行页面策略，第 {current}/{total} 页",
            progress_current=current,
            progress_total=total,
            payload={
                "page_idx": page_idx,
                "page_number": page_idx + 1,
                "page_classified_items": page_classified,
            },
        ),
    )
    if classified_items:
        print(f"book: classified {classified_items} items", flush=True)
    if run_diagnostics is not None:
        run_diagnostics.mark_phase_end("page_policies")
    emit_stage_progress(
        stage="page_policies",
        substage="page_policies",
        message="页面策略和块分类完成",
        progress_current=len(page_payloads),
        progress_total=len(page_payloads),
        elapsed_ms=int((time.perf_counter() - policy_started) * 1000),
        payload={"classified_items": classified_items},
    )
    print(f"book: page policies in {time.perf_counter() - policy_started:.2f}s", flush=True)
    return int(classified_items)


__all__ = ["run_page_policy_stage"]
