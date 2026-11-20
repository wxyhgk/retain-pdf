"""两个翻译引擎共用的前半段（2026-11-20 拆包第 1 步从 `book_flow` 挪来）：读每页模板、接续段（含拿不准的问模型）、
页面策略和块分类、上下文窗口，落盘并提交 policy_ready 断点。普通翻译（`book_flow`）和 agent 引擎（`agent_flow`）
都从这里调，底座不 import 任何一个引擎。"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from retainpdf_translation.artifacts import TranslationRunDiagnostics
from retainpdf_translation.core.orchestration.units import refresh_translation_units_by_page
from retainpdf_translation.llm.shared.control_context import TranslationControlContext
from retainpdf_translation.services.context.windows import annotate_translation_context_windows
from retainpdf_translation.services.continuation.orchestrator import finalize_orchestration_metadata_by_page
from retainpdf_translation.services.policy import TranslationPolicyConfig
from retainpdf_translation.workflow.pages import load_page_payloads
from retainpdf_translation.workflow.pages import save_pages
from retainpdf_translation.workflow.phases.continuation import run_continuation_review
from retainpdf_translation.workflow.phases.continuation import run_initial_continuation_pass
from retainpdf_translation.workflow.phases.policy import run_page_policy_stage

if TYPE_CHECKING:
    from retainpdf_translation.workflow.checkpoint import TranslationCheckpointSession


def prepare_book_payloads(
    *,
    data: dict,
    output_dir: Path,
    page_indices: range,
    api_key: str,
    workers: int,
    model: str,
    base_url: str,
    mode: str,
    classify_batch_size: int,
    skip_title_translation: bool,
    sci_cutoff_page_idx: int | None,
    sci_cutoff_block_idx: int | None,
    policy_config: TranslationPolicyConfig | None = None,
    translation_context: TranslationControlContext | None = None,
    run_diagnostics: TranslationRunDiagnostics | None = None,
    checkpoint: TranslationCheckpointSession | None = None,
) -> tuple[dict[int, Path], dict[int, list[dict]]]:
    """两个翻译引擎共用的前半段：读每页模板、接续段、页面策略和块分类，落盘并提交 policy_ready 断点。"""
    translation_paths, page_payloads = load_page_payloads(
        data=data,
        output_dir=output_dir,
        page_indices=page_indices,
        math_mode=(policy_config.math_mode if policy_config is not None else "direct_typst"),
    )
    if checkpoint is not None:
        checkpoint.update("preparing", page_payloads, translation_paths)
    run_initial_continuation_pass(
        page_payloads=page_payloads,
        translation_paths=translation_paths,
    )
    # The initial continuation pass rewrites every page with deterministic
    # layout/continuation metadata. Commit that state before any provider call
    # so an upstream failure cannot leave all working pages ahead of the last
    # durable checkpoint.
    if checkpoint is not None:
        refresh_translation_units_by_page(page_payloads)
        save_pages(page_payloads, translation_paths)
        checkpoint.update("preparing", page_payloads, translation_paths)
    if policy_config is None or policy_config.enable_candidate_continuation_review:
        run_continuation_review(
            page_payloads=page_payloads,
            translation_paths=translation_paths,
            api_key=api_key,
            model=model,
            base_url=base_url,
            workers=workers,
            run_diagnostics=run_diagnostics,
            memo_dir=output_dir,
        )
        if checkpoint is not None:
            save_pages(page_payloads, translation_paths)
            checkpoint.update("preparing", page_payloads, translation_paths)

    run_page_policy_stage(
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
        run_diagnostics=run_diagnostics,
    )
    finalize_orchestration_metadata_by_page(page_payloads)
    context_window_updates = annotate_translation_context_windows(
        page_payloads,
        mode=str(getattr(translation_context, "context_mode", "needed") if translation_context is not None else "needed"),
    )
    if context_window_updates:
        print(f"book: translation context windows updated={context_window_updates}", flush=True)
    save_pages(page_payloads, translation_paths)
    if checkpoint is not None:
        checkpoint.update("policy_ready", page_payloads, translation_paths)
    return translation_paths, page_payloads
