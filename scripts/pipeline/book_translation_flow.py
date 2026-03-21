from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from ocr.json_extractor import extract_text_items
from translation.continuations import annotate_continuation_context_global
from translation.payload_ops import GROUP_ITEM_PREFIX
from translation.payload_ops import apply_classification_labels
from translation.payload_ops import apply_scientific_paper_skips
from translation.payload_ops import apply_title_skip
from translation.payload_ops import apply_translated_text_map
from translation.payload_ops import pending_translation_items
from translation.payload_ops import summarize_payload
from translation.retrying_translator import translate_batch
from translation.translation_workflow import default_page_translation_name
from translation.translation_workflow import translate_items_to_path
from translation.translations import ensure_translation_template, load_translations, save_translations


def translate_book_pages(
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
    progress_prefix: str,
    sci_cutoff_page_idx: int | None = None,
    sci_cutoff_block_idx: int | None = None,
) -> tuple[dict[int, list[dict]], list[dict]]:
    pages = data.get("pdf_info", [])
    summaries: list[dict] = []
    translated_pages_map: dict[int, list[dict]] = {}

    output_dir.mkdir(parents=True, exist_ok=True)
    for page_idx in page_indices:
        items = extract_text_items(data, page_idx=page_idx)
        translation_path = output_dir / default_page_translation_name(page_idx)
        summary = translate_items_to_path(
            items=items,
            translation_path=translation_path,
            page_idx=page_idx,
            api_key=api_key,
            batch_size=batch_size,
            workers=max(1, workers),
            model=model,
            base_url=base_url,
            progress_label=f"{progress_prefix} {page_idx + 1}/{len(pages)}",
            mode=mode,
            classify_batch_size=max(1, classify_batch_size),
            skip_title_translation=skip_title_translation,
            sci_cutoff_page_idx=sci_cutoff_page_idx,
            sci_cutoff_block_idx=sci_cutoff_block_idx,
        )
        summaries.append(summary)
        translated_pages_map[page_idx] = load_translations(translation_path)
    return translated_pages_map, summaries


def chunked(seq: list[dict], size: int) -> list[list[dict]]:
    return [seq[i : i + size] for i in range(0, len(seq), size)]


def load_page_payloads(
    *,
    data: dict,
    output_dir: Path,
    page_indices: range,
) -> tuple[dict[int, Path], dict[int, list[dict]]]:
    translation_paths: dict[int, Path] = {}
    page_payloads: dict[int, list[dict]] = {}
    output_dir.mkdir(parents=True, exist_ok=True)
    for page_idx in page_indices:
        items = extract_text_items(data, page_idx=page_idx)
        translation_path = output_dir / default_page_translation_name(page_idx)
        ensure_translation_template(items, translation_path, page_idx=page_idx)
        translation_paths[page_idx] = translation_path
        page_payloads[page_idx] = load_translations(translation_path)
    return translation_paths, page_payloads


def apply_page_policies(
    *,
    page_payloads: dict[int, list[dict]],
    mode: str,
    classify_batch_size: int,
    api_key: str,
    model: str,
    base_url: str,
    skip_title_translation: bool,
    sci_cutoff_page_idx: int | None,
    sci_cutoff_block_idx: int | None,
) -> int:
    from classification.page_classifier import classify_payload_items

    classified_items = 0
    for page_idx in sorted(page_payloads):
        payload = page_payloads[page_idx]
        if mode == "precise":
            labels = classify_payload_items(
                payload,
                api_key=api_key,
                model=model,
                base_url=base_url,
                batch_size=classify_batch_size,
            )
            classified_items += apply_classification_labels(payload, labels)
        if mode == "sci":
            apply_scientific_paper_skips(
                payload,
                page_idx=page_idx,
                cutoff_page_idx=sci_cutoff_page_idx,
                cutoff_block_idx=sci_cutoff_block_idx,
            )
        elif skip_title_translation:
            apply_title_skip(payload)
    return classified_items


def save_pages(
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
    page_indices: set[int] | None = None,
) -> None:
    targets = sorted(page_payloads) if page_indices is None else sorted(page_indices)
    for page_idx in targets:
        save_translations(translation_paths[page_idx], page_payloads[page_idx])


def translate_pending_units(
    *,
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
    batch_size: int,
    workers: int,
    api_key: str,
    model: str,
    base_url: str,
) -> None:
    flat_payload: list[dict] = []
    item_to_page: dict[str, int] = {}
    group_to_pages: dict[str, set[int]] = {}
    for page_idx in sorted(page_payloads):
        for item in page_payloads[page_idx]:
            flat_payload.append(item)
            item_to_page[item.get("item_id", "")] = page_idx
            group_id = item.get("continuation_group", "")
            if group_id:
                group_to_pages.setdefault(group_id, set()).add(page_idx)

    pending = pending_translation_items(flat_payload)
    batches = chunked(pending, max(1, batch_size))
    total_batches = len(batches)
    print(f"book: pending items={len(pending)} batches={total_batches} workers={max(1, workers)}", flush=True)
    if workers <= 1:
        for index, batch in enumerate(batches, start=1):
            batch_label = f"book: batch {index}/{total_batches}"
            translated = translate_batch(
                batch,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=batch_label,
            )
            apply_translated_text_map(flat_payload, translated)
            touched_pages = touched_pages_for_batch(translated, item_to_page, group_to_pages)
            save_pages(page_payloads, translation_paths, touched_pages)
        return

    completed = 0
    with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
        futures = {
            executor.submit(
                translate_batch,
                batch,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=f"book: batch {index}/{total_batches}",
            ): (index, batch)
            for index, batch in enumerate(batches, start=1)
        }
        for future in as_completed(futures):
            translated = future.result()
            apply_translated_text_map(flat_payload, translated)
            completed += 1
            touched_pages = touched_pages_for_batch(translated, item_to_page, group_to_pages)
            save_pages(page_payloads, translation_paths, touched_pages)
            print(f"book: completed batch {completed}/{total_batches}", flush=True)


def touched_pages_for_batch(
    translated: dict[str, str],
    item_to_page: dict[str, int],
    group_to_pages: dict[str, set[int]],
) -> set[int]:
    touched_pages: set[int] = set()
    for item_id in translated:
        if item_id.startswith(GROUP_ITEM_PREFIX):
            touched_pages.update(group_to_pages.get(item_id[len(GROUP_ITEM_PREFIX) :], set()))
        elif item_id in item_to_page:
            touched_pages.add(item_to_page[item_id])
    return touched_pages


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
) -> tuple[dict[int, list[dict]], list[dict]]:
    translation_paths, page_payloads = load_page_payloads(
        data=data,
        output_dir=output_dir,
        page_indices=page_indices,
    )
    continuation_items = annotate_continuation_context_global(page_payloads)
    if continuation_items:
        save_pages(page_payloads, translation_paths)
        print(f"book: annotated {continuation_items} continuation-context items", flush=True)

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
    )
    if classified_items:
        print(f"book: classified {classified_items} items", flush=True)
    save_pages(page_payloads, translation_paths)

    translate_pending_units(
        page_payloads=page_payloads,
        translation_paths=translation_paths,
        batch_size=batch_size,
        workers=max(1, workers),
        api_key=api_key,
        model=model,
        base_url=base_url,
    )

    translated_pages_map = {page_idx: load_translations(translation_paths[page_idx]) for page_idx in sorted(page_payloads)}
    summaries = [
        summarize_payload(translated_pages_map[page_idx], str(translation_paths[page_idx]), page_idx, 0)
        for page_idx in sorted(translated_pages_map)
    ]
    return translated_pages_map, summaries
