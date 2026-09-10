from __future__ import annotations

import time
from collections.abc import Callable
from pathlib import Path

from retainpdf_pipeline.translate.services.results.page_io import save_pages


class TranslationFlushState:
    def __init__(
        self,
        *,
        page_payloads: dict[int, list[dict]],
        translation_paths: dict[int, Path],
        flush_interval: int,
        total_batches: int,
        progress_callback: Callable[[int, int, set[int], str], None] | None = None,
        flush_callback: Callable[[set[int], dict[int, set[str]]], None] | None = None,
        flush_max_delay_seconds: float = 0.75,
    ) -> None:
        self.page_payloads = page_payloads
        self.translation_paths = translation_paths
        self.flush_interval = max(1, flush_interval)
        self.total_batches = total_batches
        self.progress_callback = progress_callback
        self.flush_callback = flush_callback
        self.dirty_pages: set[int] = set()
        self.dirty_item_ids_by_page: dict[int, set[str]] = {}
        self.flush_max_delay_seconds = max(0.5, min(1.0, float(flush_max_delay_seconds)))
        self._last_progress_emit_at = 0.0
        self._last_progress_emit_completed = 0
        self._last_flush_completed = 0
        self._last_flush_at = time.perf_counter()
        self.flush_count = 0
        self.flushed_page_total = 0
        self.flush_elapsed_ms = 0
        self._flush_callback_ns = 0
        self._flush_total_ns = 0
        self.flush_commit_count = 0
        self.flush_callback_failed_count = 0
        self.max_flush_pages = 0

    def mark_dirty(
        self,
        pages: set[int],
        changed_item_ids_by_page: dict[int, set[str]],
    ) -> None:
        self.dirty_pages.update(pages)
        for page_idx, item_ids in changed_item_ids_by_page.items():
            if item_ids:
                self.dirty_item_ids_by_page.setdefault(int(page_idx), set()).update(
                    str(item_id) for item_id in item_ids if str(item_id)
                )

    def record_progress(self, completed: int, touched_pages: set[int], *, substage: str = "translation_batches") -> None:
        if self.progress_callback is not None:
            now = time.perf_counter()
            if (
                completed < self.total_batches
                and completed - self._last_progress_emit_completed < 20
                and now - self._last_progress_emit_at < 1.0
            ):
                return
            self._last_progress_emit_at = now
            self._last_progress_emit_completed = completed
            self.progress_callback(completed, self.total_batches, touched_pages, substage)

    def flush_if_due(self, completed: int, *, label: str) -> None:
        count_due = completed - self._last_flush_completed >= self.flush_interval
        time_due = time.perf_counter() - self._last_flush_at >= self.flush_max_delay_seconds
        ending = completed >= self.total_batches
        if not ending and not count_due and not time_due:
            return
        self.flush(label=label)
        self._last_flush_completed = completed

    def flush(self, *, label: str) -> None:
        if not self.dirty_pages:
            return
        total_started = time.perf_counter_ns()
        try:
            self._flush(label=label)
        finally:
            self._flush_total_ns += max(0, time.perf_counter_ns() - total_started)

    def _flush(self, *, label: str) -> None:
        save_started = time.perf_counter()
        flushed_pages = set(self.dirty_pages)
        changed_item_ids_by_page = {
            page_idx: set(self.dirty_item_ids_by_page.get(page_idx, set()))
            for page_idx in flushed_pages
            if self.dirty_item_ids_by_page.get(page_idx)
        }
        if set(changed_item_ids_by_page) != flushed_pages:
            raise RuntimeError("Dirty translation pages must have precise changed item ids")
        page_count = len(flushed_pages)
        save_pages(self.page_payloads, self.translation_paths, flushed_pages, refresh_units=False)
        elapsed_ms = round((time.perf_counter() - save_started) * 1000)
        self.flush_count += 1
        self.flushed_page_total += page_count
        self.flush_elapsed_ms += max(0, elapsed_ms)
        self.max_flush_pages = max(self.max_flush_pages, page_count)
        print(
            f"book: {label} pages={page_count} in {time.perf_counter() - save_started:.2f}s",
            flush=True,
        )
        callback_started = time.perf_counter_ns()
        try:
            if self.flush_callback is not None:
                self.flush_callback(flushed_pages, changed_item_ids_by_page)
        except Exception:
            self.flush_callback_failed_count += 1
            raise
        finally:
            self._flush_callback_ns += max(0, time.perf_counter_ns() - callback_started)
        self.flush_commit_count += 1
        self.dirty_pages.clear()
        self.dirty_item_ids_by_page.clear()
        self._last_flush_at = time.perf_counter()

    def final_flush(self) -> None:
        self.flush(label="final flush")

    def stats(self) -> dict[str, int | float]:
        return {
            "flush_count": self.flush_count,
            "flushed_page_total": self.flushed_page_total,
            "flush_elapsed_ms": self.flush_elapsed_ms,
            "flush_callback_elapsed_ms": self._flush_callback_ns / 1_000_000,
            "flush_total_elapsed_ms": self._flush_total_ns / 1_000_000,
            "flush_commit_count": self.flush_commit_count,
            "flush_callback_failed_count": self.flush_callback_failed_count,
            "max_flush_pages": self.max_flush_pages,
        }


__all__ = ["TranslationFlushState"]
