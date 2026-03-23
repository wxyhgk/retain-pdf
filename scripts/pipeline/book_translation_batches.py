from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from translation.payload import apply_translated_text_map
from translation.payload import pending_translation_items
from translation.payload.parts.common import GROUP_ITEM_PREFIX
from translation.llm import translate_batch

from pipeline.book_translation_pages import save_pages


def chunked(seq: list[dict], size: int) -> list[list[dict]]:
    return [seq[i : i + size] for i in range(0, len(seq), size)]


def touched_pages_for_batch(
    translated: dict[str, str],
    item_to_page: dict[str, int],
    unit_to_pages: dict[str, set[int]],
) -> set[int]:
    touched_pages: set[int] = set()
    for item_id in translated:
        if item_id.startswith(GROUP_ITEM_PREFIX):
            touched_pages.update(unit_to_pages.get(item_id, set()))
        elif item_id in item_to_page:
            touched_pages.add(item_to_page[item_id])
    return touched_pages


def translate_pending_units(
    *,
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
    batch_size: int,
    workers: int,
    api_key: str,
    model: str,
    base_url: str,
    domain_guidance: str = "",
) -> None:
    flat_payload: list[dict] = []
    item_to_page: dict[str, int] = {}
    unit_to_pages: dict[str, set[int]] = {}
    for page_idx in sorted(page_payloads):
        for item in page_payloads[page_idx]:
            flat_payload.append(item)
            item_to_page[item.get("item_id", "")] = page_idx
            unit_id = str(item.get("translation_unit_id") or item.get("item_id") or "")
            if unit_id:
                unit_to_pages.setdefault(unit_id, set()).add(page_idx)

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
                domain_guidance=domain_guidance,
            )
            apply_translated_text_map(flat_payload, translated)
            touched_pages = touched_pages_for_batch(translated, item_to_page, unit_to_pages)
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
                domain_guidance=domain_guidance,
            ): (index, batch)
            for index, batch in enumerate(batches, start=1)
        }
        for future in as_completed(futures):
            translated = future.result()
            apply_translated_text_map(flat_payload, translated)
            completed += 1
            touched_pages = touched_pages_for_batch(translated, item_to_page, unit_to_pages)
            save_pages(page_payloads, translation_paths, touched_pages)
            print(f"book: completed batch {completed}/{total_batches}", flush=True)
