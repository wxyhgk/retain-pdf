from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from services.translation.diagnostics import classify_provider_family
from services.translation.llm.control_context import TranslationControlContext
from services.translation.payload import apply_translated_text_map
from services.translation.payload import pending_translation_items
from services.translation.payload.parts.common import GROUP_ITEM_PREFIX
from services.translation.llm import translate_batch

from runtime.pipeline.book_translation_pages import save_pages


def chunked(seq: list[dict], size: int) -> list[list[dict]]:
    return [seq[i : i + size] for i in range(0, len(seq), size)]


def _save_flush_interval(*, workers: int, total_batches: int) -> int:
    if total_batches <= 1:
        return 1
    return max(2, min(12, max(1, workers) * 2))


def _effective_translation_batch_size(*, batch_size: int, model: str, base_url: str) -> int:
    configured = max(1, batch_size)
    if classify_provider_family(base_url=base_url, model=model) != "deepseek_official":
        return 1
    if configured <= 1:
        return 3
    return min(configured, 4)


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
    mode: str = "fast",
    translation_context: TranslationControlContext | None = None,
) -> dict[str, int]:
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
    effective_batch_size = _effective_translation_batch_size(
        batch_size=batch_size,
        model=model,
        base_url=base_url,
    )
    batches = chunked(pending, effective_batch_size)
    total_batches = len(batches)
    flush_interval = _save_flush_interval(workers=workers, total_batches=total_batches)
    print(
        f"book: pending items={len(pending)} batches={total_batches} workers={max(1, workers)} "
        f"mode={mode} effective_batch_size={effective_batch_size}",
        flush=True,
    )
    if total_batches:
        print(f"book: save flush interval={flush_interval} batches", flush=True)
    if workers <= 1:
        dirty_pages: set[int] = set()
        for index, batch in enumerate(batches, start=1):
            batch_label = f"book: batch {index}/{total_batches}"
            translated = translate_batch(
                batch,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=batch_label,
                domain_guidance=domain_guidance,
                mode=mode,
                context=translation_context,
            )
            apply_translated_text_map(flat_payload, translated)
            dirty_pages.update(touched_pages_for_batch(translated, item_to_page, unit_to_pages))
            if index % flush_interval == 0 and dirty_pages:
                save_started = time.perf_counter()
                save_pages(page_payloads, translation_paths, dirty_pages)
                print(
                    f"book: flushed pages={len(dirty_pages)} after batch {index}/{total_batches} in "
                    f"{time.perf_counter() - save_started:.2f}s",
                    flush=True,
                )
                dirty_pages.clear()
        if dirty_pages:
            save_started = time.perf_counter()
            save_pages(page_payloads, translation_paths, dirty_pages)
            print(
                f"book: final flush pages={len(dirty_pages)} in {time.perf_counter() - save_started:.2f}s",
                flush=True,
            )
        return {
            "pending_items": len(pending),
            "total_batches": total_batches,
            "effective_batch_size": effective_batch_size,
            "flush_interval": flush_interval,
            "effective_workers": max(1, workers),
        }

    completed = 0
    dirty_pages: set[int] = set()
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
                mode=mode,
                context=translation_context,
            ): (index, batch)
            for index, batch in enumerate(batches, start=1)
        }
        for future in as_completed(futures):
            translated = future.result()
            apply_translated_text_map(flat_payload, translated)
            completed += 1
            dirty_pages.update(touched_pages_for_batch(translated, item_to_page, unit_to_pages))
            if completed % flush_interval == 0 and dirty_pages:
                save_started = time.perf_counter()
                save_pages(page_payloads, translation_paths, dirty_pages)
                print(
                    f"book: flushed pages={len(dirty_pages)} after completed batch {completed}/{total_batches} in "
                    f"{time.perf_counter() - save_started:.2f}s",
                    flush=True,
                )
                dirty_pages.clear()
            print(f"book: completed batch {completed}/{total_batches}", flush=True)
    if dirty_pages:
        save_started = time.perf_counter()
        save_pages(page_payloads, translation_paths, dirty_pages)
        print(
            f"book: final flush pages={len(dirty_pages)} in {time.perf_counter() - save_started:.2f}s",
            flush=True,
        )
    return {
        "pending_items": len(pending),
        "total_batches": total_batches,
        "effective_batch_size": effective_batch_size,
        "flush_interval": flush_interval,
        "effective_workers": max(1, workers),
    }
