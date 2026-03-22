import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from translation.payload_ops import apply_translated_text_map
from translation.payload_ops import pending_translation_items
from translation.payload_ops import summarize_payload
from translation.policy_config import TranslationPolicyConfig
from translation.policy_config import build_translation_policy_config
from translation.continuations import annotate_continuation_context
from translation.policy_flow import apply_translation_policies
from translation.retrying_translator import translate_batch
from translation.translations import ensure_translation_template, load_translations, save_translations


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
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    progress_label: str = "",
    mode: str = "fast",
    classify_batch_size: int = 12,
    skip_title_translation: bool = False,
    sci_cutoff_page_idx: int | None = None,
    sci_cutoff_block_idx: int | None = None,
    policy_config: TranslationPolicyConfig | None = None,
) -> dict:
    ensure_translation_template(items, translation_path, page_idx=page_idx)

    payload = load_translations(translation_path)
    label = progress_label or f"page {page_idx + 1}"
    continuation_items = annotate_continuation_context(payload)
    if continuation_items:
        save_translations(translation_path, payload)
        print(f"{label}: annotated {continuation_items} continuation-context items", flush=True)

    if policy_config is None:
        policy_config = build_translation_policy_config(
            mode=mode,
            skip_title_translation=skip_title_translation,
            sci_cutoff_page_idx=sci_cutoff_page_idx,
            sci_cutoff_block_idx=sci_cutoff_block_idx,
        )

    classified_items, skip_summary = apply_translation_policies(
        payload=payload,
        mode=mode,
        classify_batch_size=classify_batch_size,
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
        save_translations(translation_path, payload)
        print(f"{label}: classified {classified_items} page items")

    if policy_config.enable_after_last_title_cutoff:
        if skip_summary["title_skipped"] or skip_summary["tail_skipped"]:
            save_translations(translation_path, payload)
            if skip_summary["title_skipped"]:
                print(f"{label}: skipped {skip_summary['title_skipped']} title items")
            if skip_summary["tail_skipped"]:
                print(f"{label}: skipped {skip_summary['tail_skipped']} items after the last title cutoff")
    elif policy_config.enable_title_skip:
        if skip_summary["title_skipped"]:
            save_translations(translation_path, payload)
            print(f"{label}: skipped {skip_summary['title_skipped']} title items")
    if skip_summary.get("metadata_fragment_skipped"):
        save_translations(translation_path, payload)
        print(f"{label}: skipped {skip_summary['metadata_fragment_skipped']} metadata fragments")

    pending = pending_translation_items(payload)
    batches = chunked(pending, max(1, batch_size))
    total_batches = len(batches)
    print(
        f"{label}: pending items={len(pending)} batches={total_batches} workers={max(1, workers)} mode={mode}",
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

    return summarize_payload(
        payload,
        str(translation_path),
        page_idx,
        classified_items,
    )
