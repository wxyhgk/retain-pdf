import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from classification.page_classifier import classify_payload_items
from translation.payload_ops import apply_classification_labels
from translation.payload_ops import apply_scientific_paper_skips
from translation.payload_ops import apply_title_skip
from translation.payload_ops import apply_translated_text_map
from translation.payload_ops import pending_translation_items
from translation.payload_ops import summarize_payload
from translation.continuations import annotate_continuation_context
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
) -> dict:
    ensure_translation_template(items, translation_path, page_idx=page_idx)

    payload = load_translations(translation_path)
    label = progress_label or f"page {page_idx + 1}"
    continuation_items = annotate_continuation_context(payload)
    if continuation_items:
        save_translations(translation_path, payload)
        print(f"{label}: annotated {continuation_items} continuation-context items", flush=True)

    classified_items = 0
    if mode == "precise":
        labels = classify_payload_items(
            payload,
            api_key=api_key,
            model=model,
            base_url=base_url,
            batch_size=classify_batch_size,
        )
        classified_items = apply_classification_labels(payload, labels)
        save_translations(translation_path, payload)
        print(f"{label}: classified {classified_items} page items")

    if mode == "sci":
        skip_summary = apply_scientific_paper_skips(
            payload,
            page_idx=page_idx,
            cutoff_page_idx=sci_cutoff_page_idx,
            cutoff_block_idx=sci_cutoff_block_idx,
        )
        if skip_summary["title_skipped"] or skip_summary["tail_skipped"]:
            save_translations(translation_path, payload)
            if skip_summary["title_skipped"]:
                print(f"{label}: skipped {skip_summary['title_skipped']} title items")
            if skip_summary["tail_skipped"]:
                print(f"{label}: skipped {skip_summary['tail_skipped']} items after the last title cutoff")
    elif skip_title_translation:
        skipped_titles = apply_title_skip(payload)
        if skipped_titles:
            save_translations(translation_path, payload)
            print(f"{label}: skipped {skipped_titles} title items")

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
