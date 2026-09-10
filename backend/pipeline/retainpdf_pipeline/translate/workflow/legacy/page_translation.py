from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import as_completed
from pathlib import Path

from retainpdf_pipeline.translate.core.payload import apply_translated_text_map
from retainpdf_pipeline.translate.core.payload import ensure_translation_template
from retainpdf_pipeline.translate.core.payload import load_translations
from retainpdf_pipeline.translate.core.payload import pending_translation_items
from retainpdf_pipeline.translate.core.payload import save_translations
from retainpdf_pipeline.translate.core.payload import summarize_payload
from retainpdf_pipeline.translate.llm.shared.orchestration import translate_batch
from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_BASE_URL
from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_MODEL
from retainpdf_pipeline.translate.services.continuation import annotate_continuation_context
from retainpdf_pipeline.translate.services.continuation import summarize_continuation_decisions
from retainpdf_pipeline.translate.services.continuation.orchestrator import annotate_payload_layout_zones
from retainpdf_pipeline.translate.services.continuation.orchestrator import finalize_payload_orchestration_metadata
from retainpdf_pipeline.translate.services.policy import TranslationPolicyConfig
from retainpdf_pipeline.translate.services.policy import build_translation_policy_config
from retainpdf_pipeline.translate.services.policy.flow import apply_translation_policies


def chunked(seq: list[dict], size: int) -> list[list[dict]]:
    return [seq[i : i + size] for i in range(0, len(seq), size)]


def default_page_translation_name(page_idx: int) -> str:
    return f"page-{page_idx + 1:03d}-deepseek.json"


def translate_items_to_path(
    items: list,
    translation_path: Path,
    page_idx: int,
    api_key: str = "",
    batch_size: int = 8,
    workers: int = 1,
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    progress_label: str = "",
    mode: str = "fast",
    classify_batch_size: int = 12,
    skip_title_translation: bool = False,
    sci_cutoff_page_idx: int | None = None,
    sci_cutoff_block_idx: int | None = None,
    rule_profile_name: str = "general_sci",
    custom_rules_text: str = "",
    policy_config: TranslationPolicyConfig | None = None,
) -> dict:
    math_mode = policy_config.math_mode if policy_config is not None else "placeholder"
    ensure_translation_template(items, translation_path, page_idx=page_idx, math_mode=math_mode)

    payload = load_translations(translation_path)
    label = progress_label or f"page {page_idx + 1}"
    annotate_payload_layout_zones(payload)
    finalize_payload_orchestration_metadata(payload)
    continuation_items = annotate_continuation_context(payload)
    continuation_summary = summarize_continuation_decisions(payload)
    if continuation_items or continuation_summary["candidate_break_items"]:
        finalize_payload_orchestration_metadata(payload)
        save_translations(translation_path, payload)
        print(
            f"{label}: continuation joined={continuation_summary['joined_items']} "
            f"provider_joined={continuation_summary.get('provider_joined_items', 0)} "
            f"candidate_break={continuation_summary['candidate_break_items']}",
            flush=True,
        )

    if policy_config is None:
        policy_config = build_translation_policy_config(
            mode=mode,
            math_mode="placeholder",
            skip_title_translation=skip_title_translation,
            sci_cutoff_page_idx=sci_cutoff_page_idx,
            sci_cutoff_block_idx=sci_cutoff_block_idx,
            rule_profile_name=rule_profile_name,
            custom_rules_text=custom_rules_text,
        )

    classified_items, skip_summary = apply_translation_policies(
        payload=payload,
        mode=mode,
        classify_batch_size=classify_batch_size,
        workers=max(1, workers),
        api_key=api_key,
        model=model,
        base_url=base_url,
        skip_title_translation=skip_title_translation,
        page_idx=page_idx,
        sci_cutoff_page_idx=sci_cutoff_page_idx,
        sci_cutoff_block_idx=sci_cutoff_block_idx,
        policy_config=policy_config,
    )
    if classified_items:
        finalize_payload_orchestration_metadata(payload)
        save_translations(translation_path, payload)
        print(f"{label}: classified {classified_items} page items")

    if policy_config.enable_reference_tail_skip:
        if skip_summary["title_skipped"] or skip_summary["reference_tail_skipped"]:
            finalize_payload_orchestration_metadata(payload)
            save_translations(translation_path, payload)
            if skip_summary["title_skipped"]:
                print(f"{label}: skipped {skip_summary['title_skipped']} title items")
            if skip_summary["reference_tail_skipped"]:
                print(f"{label}: skipped {skip_summary['reference_tail_skipped']} items in the reference tail")
    elif policy_config.enable_title_skip:
        if skip_summary["title_skipped"]:
            finalize_payload_orchestration_metadata(payload)
            save_translations(translation_path, payload)
            print(f"{label}: skipped {skip_summary['title_skipped']} title items")
    if skip_summary.get("ref_text_skipped"):
        finalize_payload_orchestration_metadata(payload)
        save_translations(translation_path, payload)
        print(f"{label}: skipped {skip_summary['ref_text_skipped']} ref_text items")
    if skip_summary.get("reference_zone_skipped"):
        finalize_payload_orchestration_metadata(payload)
        save_translations(translation_path, payload)
        print(f"{label}: skipped {skip_summary['reference_zone_skipped']} reference-zone items")
    if skip_summary.get("shared_literal_image_region_skipped"):
        finalize_payload_orchestration_metadata(payload)
        save_translations(translation_path, payload)
        print(f"{label}: skipped {skip_summary['shared_literal_image_region_skipped']} image-region items")
    if any(skip_summary.get(key) for key in ("mixed_keep_all", "mixed_translate_all", "mixed_translate_tail")):
        finalize_payload_orchestration_metadata(payload)
        save_translations(translation_path, payload)
        print(
            f"{label}: mixed literal split keep_all={skip_summary['mixed_keep_all']} "
            f"translate_all={skip_summary['mixed_translate_all']} "
            f"translate_tail={skip_summary['mixed_translate_tail']}",
            flush=True,
        )

    pending = pending_translation_items(payload)
    effective_batch_size = 1
    batches = chunked(pending, effective_batch_size)
    total_batches = len(batches)
    print(
        f"{label}: pending items={len(pending)} batches={total_batches} workers={max(1, workers)} "
        f"mode={mode} effective_batch_size={effective_batch_size}",
        flush=True,
    )
    if workers <= 1:
        for index, batch in enumerate(batches, start=1):
            batch_label = f"{label}: batch {index}/{total_batches}"
            batch_started = time.perf_counter()
            print(f"{batch_label}: start items={len(batch)}", flush=True)
            translated = translate_batch(
                batch,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=batch_label,
                mode=mode,
            )
            apply_translated_text_map(payload, translated)
            save_translations(translation_path, payload)
            batch_elapsed = time.perf_counter() - batch_started
            print(f"{batch_label}: saved in {batch_elapsed:.2f}s", flush=True)
    else:
        completed = 0
        with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
            futures = {
                executor.submit(
                    translate_batch,
                    batch,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    request_label=f"{label}: batch {index}/{total_batches}",
                    mode=mode,
                ): (index, batch)
                for index, batch in enumerate(batches, start=1)
            }
            for future in as_completed(futures):
                index, batch = futures[future]
                batch_label = f"{label}: batch {index}/{total_batches}"
                batch_started = time.perf_counter()
                translated = future.result()
                apply_translated_text_map(payload, translated)
                completed += 1
                save_translations(translation_path, payload)
                batch_elapsed = time.perf_counter() - batch_started
                print(
                    f"{batch_label}: saved after completion order={completed}/{total_batches} in {batch_elapsed:.2f}s",
                    flush=True,
                )

    finalize_payload_orchestration_metadata(payload)
    save_translations(translation_path, payload)
    return summarize_payload(
        payload,
        str(translation_path),
        page_idx,
        classified_items,
    )


__all__ = [
    "chunked",
    "default_page_translation_name",
    "translate_items_to_path",
]
