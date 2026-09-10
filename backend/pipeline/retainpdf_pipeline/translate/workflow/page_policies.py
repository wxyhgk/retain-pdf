from __future__ import annotations

from pathlib import Path
from typing import Callable

from retainpdf_pipeline.translate.services.continuation import annotate_continuation_context_global
from retainpdf_pipeline.translate.services.continuation import summarize_continuation_decisions
from retainpdf_pipeline.translate.services.continuation.orchestrator import annotate_layout_zones_by_page
from retainpdf_pipeline.translate.services.continuation.orchestrator import finalize_orchestration_metadata_by_page
from retainpdf_pipeline.translate.services.continuation.orchestrator import review_candidate_continuation_pairs
from retainpdf_pipeline.translate.services.policy import TranslationPolicyConfig
from retainpdf_pipeline.translate.services.policy.flow import apply_translation_policies
from retainpdf_pipeline.translate.core.payload import summarize_payload
from retainpdf_pipeline.translate.core.orchestration.abstract_groups import annotate_abstract_translation_groups

from retainpdf_pipeline.translate.workflow.pages import save_pages


def apply_page_policies(
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
    policy_config: TranslationPolicyConfig | None = None,
    request_chat_content_fn: Callable[..., str] | None = None,
    progress_callback=None,
) -> int:
    classified_items = 0
    ordered_pages = sorted(page_payloads)
    total_pages = len(ordered_pages)
    for order, page_idx in enumerate(ordered_pages, start=1):
        print(
            f"book: page policy page {order}/{total_pages} -> source page {page_idx + 1}",
            flush=True,
        )
        payload = page_payloads[page_idx]
        page_classified, _ = apply_translation_policies(
            payload=payload,
            mode=mode,
            classify_batch_size=classify_batch_size,
            workers=workers,
            api_key=api_key,
            model=model,
            base_url=base_url,
            skip_title_translation=skip_title_translation,
            page_idx=page_idx,
            sci_cutoff_page_idx=sci_cutoff_page_idx,
            sci_cutoff_block_idx=sci_cutoff_block_idx,
            policy_config=policy_config,
            request_chat_content_fn=request_chat_content_fn,
        )
        classified_items += page_classified
        print(
            f"book: page policy done {order}/{total_pages} -> source page {page_idx + 1} classified={page_classified}",
            flush=True,
        )
        if progress_callback is not None:
            progress_callback(order, total_pages, page_idx, page_classified)
    return classified_items


def finalize_page_payloads(
    *,
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
) -> dict[str, int]:
    annotate_layout_zones_by_page(page_payloads)
    flat_payload = [item for page_idx in sorted(page_payloads) for item in page_payloads[page_idx]]
    abstract_grouped_items = annotate_abstract_translation_groups(flat_payload)
    continuation_items = annotate_continuation_context_global(page_payloads)
    continuation_summary = summarize_continuation_decisions(flat_payload)
    if abstract_grouped_items or continuation_items or continuation_summary["candidate_break_items"]:
        finalize_orchestration_metadata_by_page(page_payloads)
        save_pages(page_payloads, translation_paths)
        print(
            f"book: continuation joined={continuation_summary['joined_items']} "
            f"provider_joined={continuation_summary.get('provider_joined_items', 0)} "
            f"candidate_break={continuation_summary['candidate_break_items']}",
            flush=True,
        )
    return continuation_summary


def review_and_apply_continuations(
    *,
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
    api_key: str,
    model: str,
    base_url: str,
    workers: int,
    request_chat_content_fn: Callable[..., str],
    progress_callback=None,
) -> None:
    review_candidate_continuation_pairs(
        page_payloads=page_payloads,
        translation_paths=translation_paths,
        api_key=api_key,
        model=model,
        base_url=base_url,
        workers=min(max(1, workers), 8),
        save_pages_fn=save_pages,
        request_chat_content_fn=request_chat_content_fn,
        progress_callback=progress_callback,
    )


def build_page_summaries(
    *,
    translated_pages_map: dict[int, list[dict]],
    translation_paths: dict[int, Path],
) -> list[dict]:
    return [
        summarize_payload(translated_pages_map[page_idx], str(translation_paths[page_idx]), page_idx, 0)
        for page_idx in sorted(translated_pages_map)
    ]
