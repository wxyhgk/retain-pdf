from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from retainpdf_pipeline.translate.artifacts import TranslationRunDiagnostics
from retainpdf_pipeline.translate.core.payload import load_translations
from retainpdf_pipeline.translate.core.orchestration.units import refresh_translation_units_by_page
from retainpdf_pipeline.translate.llm.shared.control_context import (
    TranslationControlContext,
)
from retainpdf_pipeline.translate.services.context.windows import (
    annotate_translation_context_windows,
)
from retainpdf_pipeline.translate.services.continuation.orchestrator import (
    finalize_orchestration_metadata_by_page,
)
from retainpdf_pipeline.translate.services.policy import (
    TranslationPolicyConfig,
)
from retainpdf_pipeline.translate.workflow.page_policies import (
    build_page_summaries,
)
from retainpdf_pipeline.translate.workflow.pages import (
    load_page_payloads,
    save_pages,
)
from retainpdf_pipeline.translate.workflow.stages import (
    run_agent_repair_stage,
    run_continuation_review,
    run_final_untranslated_recovery_stage,
    run_garbled_reconstruction_stage,
    run_initial_continuation_pass,
    run_page_policy_stage,
    run_translation_batch_stage,
)

if TYPE_CHECKING:
    from retainpdf_pipeline.translate.workflow.checkpoint import (
        TranslationCheckpointSession,
    )


def translate_book_with_global_continuations(
    *,
    data: dict,
    output_dir: Path,
    page_indices: range,
    api_key: str,
    batch_size: int,
    workers: int,
    model: str,
    base_url: str,
    mode: str,
    classify_batch_size: int,
    skip_title_translation: bool,
    sci_cutoff_page_idx: int | None,
    sci_cutoff_block_idx: int | None,
    policy_config: TranslationPolicyConfig | None = None,
    domain_guidance: str = "",
    translation_context: TranslationControlContext | None = None,
    run_diagnostics: TranslationRunDiagnostics | None = None,
    checkpoint: TranslationCheckpointSession | None = None,
) -> tuple[dict[int, list[dict]], list[dict]]:
    if translation_context is not None:
        domain_guidance = translation_context.merged_guidance
    elif not domain_guidance and policy_config is not None:
        domain_guidance = policy_config.domain_guidance

    translation_paths, page_payloads = load_page_payloads(
        data=data,
        output_dir=output_dir,
        page_indices=page_indices,
        math_mode=(policy_config.math_mode if policy_config is not None else "placeholder"),
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
    run_translation_batch_stage(
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
        run_diagnostics=run_diagnostics,
        flush_callback=(
            lambda _pages, changed_item_ids_by_page: checkpoint.update(
                "translating",
                page_payloads,
                translation_paths,
                changed_item_ids_by_page,
            )
            if checkpoint is not None
            else None
        ),
    )
    if checkpoint is not None:
        checkpoint.update(
            "repairing",
            page_payloads,
            translation_paths,
            detect_item_changes=True,
        )

    run_garbled_reconstruction_stage(
        page_payloads=page_payloads,
        translation_paths=translation_paths,
        api_key=api_key,
        model=model,
        base_url=base_url,
        workers=workers,
        run_diagnostics=run_diagnostics,
    )
    if checkpoint is not None:
        checkpoint.update(
            "repairing",
            page_payloads,
            translation_paths,
            detect_item_changes=True,
        )

    run_agent_repair_stage(
        page_payloads=page_payloads,
        translation_paths=translation_paths,
        api_key=api_key,
        model=model,
        base_url=base_url,
        translation_context=translation_context,
        run_diagnostics=run_diagnostics,
    )
    if checkpoint is not None:
        checkpoint.update(
            "repairing",
            page_payloads,
            translation_paths,
            detect_item_changes=True,
        )

    run_final_untranslated_recovery_stage(
        page_payloads=page_payloads,
        translation_paths=translation_paths,
        api_key=api_key,
        model=model,
        base_url=base_url,
        translation_context=translation_context,
        workers=workers,
    )
    if checkpoint is not None:
        checkpoint.update(
            "validating",
            page_payloads,
            translation_paths,
            detect_item_changes=True,
        )
    translated_pages_map = {page_idx: load_translations(translation_paths[page_idx]) for page_idx in sorted(page_payloads)}
    summaries = build_page_summaries(
        translated_pages_map=translated_pages_map,
        translation_paths=translation_paths,
    )
    return translated_pages_map, summaries
