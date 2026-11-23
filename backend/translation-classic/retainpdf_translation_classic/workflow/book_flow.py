from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from retainpdf_translation.artifacts import TranslationRunDiagnostics
from retainpdf_translation.core.payload import load_translations
from retainpdf_translation.core.orchestration.units import refresh_translation_units_by_page
from retainpdf_translation.llm.shared.control_context import (
    TranslationControlContext,
)
from retainpdf_translation.llm.shared.upstream_resilience import raise_if_credential_rejected
from retainpdf_translation.services.context.windows import (
    annotate_translation_context_windows,
)
from retainpdf_translation.services.continuation.orchestrator import (
    finalize_orchestration_metadata_by_page,
)
from retainpdf_translation.services.policy import (
    TranslationPolicyConfig,
)
from retainpdf_translation.workflow.page_policies import (
    build_page_summaries,
)
from retainpdf_translation.workflow.prepare import prepare_book_payloads  # noqa: F401  两个引擎共用的前半段
from retainpdf_translation.workflow.pages import (
    load_page_payloads,
    save_pages,
)
from retainpdf_translation_classic.workflow.stages import (
    run_agent_repair_stage,
    run_continuation_review,
    run_final_untranslated_recovery_stage,
    run_garbled_reconstruction_stage,
    run_initial_continuation_pass,
    run_page_policy_stage,
    run_translation_batch_stage,
)

if TYPE_CHECKING:
    from retainpdf_translation.workflow.checkpoint import (
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

    translation_paths, page_payloads = prepare_book_payloads(
        data=data,
        output_dir=output_dir,
        page_indices=page_indices,
        api_key=api_key,
        workers=workers,
        model=model,
        base_url=base_url,
        mode=mode,
        classify_batch_size=classify_batch_size,
        skip_title_translation=skip_title_translation,
        sci_cutoff_page_idx=sci_cutoff_page_idx,
        sci_cutoff_block_idx=sci_cutoff_block_idx,
        policy_config=policy_config,
        translation_context=translation_context,
        run_diagnostics=run_diagnostics,
        checkpoint=checkpoint,
    )
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
        checkpoint_progress=(
            checkpoint.progress_snapshot if checkpoint is not None else None
        ),
    )
    return finish_book_translation(
        page_payloads=page_payloads,
        translation_paths=translation_paths,
        api_key=api_key,
        model=model,
        base_url=base_url,
        workers=workers,
        translation_context=translation_context,
        run_diagnostics=run_diagnostics,
        checkpoint=checkpoint,
    )


def finish_book_translation(
    *,
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
    api_key: str,
    model: str,
    base_url: str,
    workers: int,
    translation_context: TranslationControlContext | None,
    run_diagnostics: TranslationRunDiagnostics | None,
    checkpoint: TranslationCheckpointSession | None,
) -> tuple[dict[int, list[dict]], list[dict]]:
    """批量翻译之后的收尾：乱码修复、agent 修复、漏翻补救，各提交一次断点，最后出每页小结。整本一次翻和跟着 OCR 流式翻（`streaming_flow.py`）共用。"""
    # 翻译 Key 已被上游拒绝：修复和补翻也都会被拒，直接失败
    raise_if_credential_rejected(run_diagnostics, base_url=base_url, api_key=api_key, model=model)
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
