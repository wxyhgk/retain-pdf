from __future__ import annotations

from pathlib import Path

from pipeline.book_translation_batches import translate_pending_units
from pipeline.book_translation_pages import load_page_payloads
from pipeline.book_translation_pages import save_pages
from pipeline.book_translation_policies import apply_page_policies
from pipeline.book_translation_policies import build_page_summaries
from pipeline.book_translation_policies import finalize_page_payloads
from pipeline.book_translation_policies import review_and_apply_continuations
from translation.orchestration.document_orchestrator import finalize_orchestration_metadata_by_page
from translation.policy import TranslationPolicyConfig
from translation.payload import load_translations


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
) -> tuple[dict[int, list[dict]], list[dict]]:
    if not domain_guidance and policy_config is not None:
        domain_guidance = policy_config.domain_guidance

    translation_paths, page_payloads = load_page_payloads(
        data=data,
        output_dir=output_dir,
        page_indices=page_indices,
    )
    finalize_page_payloads(
        page_payloads=page_payloads,
        translation_paths=translation_paths,
    )
    if policy_config is None or policy_config.enable_candidate_continuation_review:
        review_and_apply_continuations(
            page_payloads=page_payloads,
            translation_paths=translation_paths,
            api_key=api_key,
            model=model,
            base_url=base_url,
            workers=workers,
        )

    classified_items = apply_page_policies(
        page_payloads=page_payloads,
        mode=mode,
        classify_batch_size=max(1, classify_batch_size),
        api_key=api_key,
        model=model,
        base_url=base_url,
        skip_title_translation=skip_title_translation,
        sci_cutoff_page_idx=sci_cutoff_page_idx,
        sci_cutoff_block_idx=sci_cutoff_block_idx,
        policy_config=policy_config,
    )
    if classified_items:
        print(f"book: classified {classified_items} items", flush=True)
    finalize_orchestration_metadata_by_page(page_payloads)
    save_pages(page_payloads, translation_paths)

    translate_pending_units(
        page_payloads=page_payloads,
        translation_paths=translation_paths,
        batch_size=batch_size,
        workers=max(1, workers),
        api_key=api_key,
        model=model,
        base_url=base_url,
        domain_guidance=domain_guidance,
    )

    translated_pages_map = {page_idx: load_translations(translation_paths[page_idx]) for page_idx in sorted(page_payloads)}
    summaries = build_page_summaries(
        translated_pages_map=translated_pages_map,
        translation_paths=translation_paths,
    )
    return translated_pages_map, summaries
