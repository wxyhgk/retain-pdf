from __future__ import annotations

import os
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import as_completed

from retainpdf_pipeline.translate.llm.shared.orchestration.batched_plain_single import run_translation_tail_items
from retainpdf_pipeline.translate.llm.shared.tail_retry_queue import TranslationTailItem
from retainpdf_pipeline.translate.llm.shared.tail_retry_queue import translation_tail_queue_from_context
from retainpdf_pipeline.translate.services.results.applier import TranslationResultApplier
from retainpdf_pipeline.translate.services.results.flush import TranslationFlushState
from retainpdf_pipeline.translate.workflow.scheduling.failures import _failed_results_for_unhandled_batch_exception

TAIL_RETRY_WORKER_DIVISOR = 2
TAIL_RETRY_WORKER_LIMIT = 128
EARLY_TAIL_RETRY_DRAIN_INTERVAL = 20


def _env_flag(name: str, default: bool) -> bool:
    value = str(os.environ.get(name, "") or "").strip().lower()
    if not value:
        return default
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return default


def _env_int(name: str, default: int, *, minimum: int = 1) -> int:
    value = str(os.environ.get(name, "") or "").strip()
    if not value:
        return max(minimum, int(default))
    try:
        parsed = int(value)
    except ValueError:
        return max(minimum, int(default))
    return max(minimum, parsed)


def _drain_translation_tail_queue(
    *,
    translation_context,
    result_applier: TranslationResultApplier,
    flush_state: TranslationFlushState,
    tail_workers: int,
    allow_tail_retry: bool = True,
    update_total_batches: bool = True,
    label_prefix: str = "translation tail retry",
) -> dict[str, int | bool | str]:
    stats = {
        "items": 0,
        "completed": 0,
        "failed": 0,
        "elapsed_ms": 0,
        "workers": max(1, tail_workers),
        "updated_total_batches": bool(update_total_batches),
        "label_prefix": label_prefix,
    }
    if not allow_tail_retry:
        # Rust owns transport retries. Never replay ambiguous work in Python.
        return stats
    started = time.perf_counter()
    queue = translation_tail_queue_from_context(translation_context)
    if queue is None:
        return stats
    tail_items = queue.drain()
    if not tail_items:
        return stats
    stats["items"] = len(tail_items)
    print(
        f"book: translation tail queue start items={len(tail_items)} workers={max(1, tail_workers)}",
        flush=True,
    )
    completed = 0
    base_completed = int(flush_state.total_batches)
    if update_total_batches:
        flush_state.total_batches = base_completed + len(tail_items)
    if max(1, tail_workers) <= 1:
        for tail_item in tail_items:
            try:
                translated = _run_translation_tail_item(tail_item)
            except Exception as exc:
                stats["failed"] += 1
                print(
                    f"book: translation tail item failed for {tail_item.item.get('item_id', '')} reason={tail_item.reason}: {type(exc).__name__}: {exc}",
                    flush=True,
                )
                translated = _failed_results_for_unhandled_batch_exception([tail_item.item], exc)
            touched_pages = result_applier.apply_batch([tail_item.item], translated)
            completed += 1
            stats["completed"] = completed
            if update_total_batches:
                flush_state.record_progress(base_completed + completed, touched_pages, substage="translation_tail_retry")
            flush_state.flush_if_due(completed, label=f"flushed after {label_prefix} {completed}/{len(tail_items)}")
        stats["elapsed_ms"] = int(round((time.perf_counter() - started) * 1000))
        return stats

    with ThreadPoolExecutor(max_workers=max(1, tail_workers)) as executor:
        futures = {
            executor.submit(_run_translation_tail_item, tail_item): tail_item
            for tail_item in tail_items
        }
        for future in as_completed(futures):
            tail_item = futures[future]
            try:
                translated = future.result()
            except Exception as exc:
                stats["failed"] += 1
                print(
                    f"book: translation tail item failed for {tail_item.item.get('item_id', '')} reason={tail_item.reason}: {type(exc).__name__}: {exc}",
                    flush=True,
                )
                translated = _failed_results_for_unhandled_batch_exception([tail_item.item], exc)
            touched_pages = result_applier.apply_batch([tail_item.item], translated)
            completed += 1
            stats["completed"] = completed
            if update_total_batches:
                flush_state.record_progress(base_completed + completed, touched_pages, substage="translation_tail_retry")
            flush_state.flush_if_due(completed, label=f"flushed after {label_prefix} {completed}/{len(tail_items)}")
    stats["elapsed_ms"] = int(round((time.perf_counter() - started) * 1000))
    return stats


def _should_drain_translation_tail_early(completed: int, total_batches: int) -> bool:
    if not _early_tail_retry_enabled():
        return False
    if completed <= 0 or completed >= total_batches:
        return False
    return completed % _early_tail_retry_drain_interval() == 0


def _early_tail_retry_enabled() -> bool:
    return _env_flag("RETAIN_TRANSLATION_EARLY_TAIL_RETRY", True)


def _early_tail_retry_drain_interval() -> int:
    return _env_int(
        "RETAIN_TRANSLATION_EARLY_TAIL_RETRY_INTERVAL",
        EARLY_TAIL_RETRY_DRAIN_INTERVAL,
    )


def _run_translation_tail_item(tail_item: TranslationTailItem) -> dict[str, dict[str, str]]:
    if tail_item.request_label:
        print(
            f"{tail_item.request_label}: run translation tail item reason={tail_item.reason} item={tail_item.item.get('item_id', '')}",
            flush=True,
        )
    return run_translation_tail_items(
        [tail_item],
        api_key=tail_item.api_key,
        model=tail_item.model,
        base_url=tail_item.base_url,
        request_label=tail_item.request_label,
        context=tail_item.context,
        diagnostics=tail_item.diagnostics,
        single_item_translator=tail_item.single_item_translator,
        store_cached_batch_fn=tail_item.store_cached_batch_fn,
    )


def _transport_tail_retry_workers(queue_workers: dict[str, int]) -> int:
    explicit_workers = str(os.environ.get("RETAIN_TRANSLATION_TAIL_RETRY_WORKERS", "") or "").strip()
    if explicit_workers:
        return _env_int("RETAIN_TRANSLATION_TAIL_RETRY_WORKERS", 1)
    total_workers = sum(max(0, int(value or 0)) for value in queue_workers.values())
    divisor = _env_int("RETAIN_TRANSLATION_TAIL_RETRY_WORKER_DIVISOR", TAIL_RETRY_WORKER_DIVISOR)
    limit = _env_int("RETAIN_TRANSLATION_TAIL_RETRY_WORKER_LIMIT", TAIL_RETRY_WORKER_LIMIT)
    return max(1, min(limit, total_workers // divisor or 1))


__all__ = [
    "EARLY_TAIL_RETRY_DRAIN_INTERVAL",
    "TAIL_RETRY_WORKER_DIVISOR",
    "TAIL_RETRY_WORKER_LIMIT",
    "_drain_translation_tail_queue",
    "_early_tail_retry_enabled",
    "_early_tail_retry_drain_interval",
    "_run_translation_tail_item",
    "_should_drain_translation_tail_early",
    "_transport_tail_retry_workers",
]
