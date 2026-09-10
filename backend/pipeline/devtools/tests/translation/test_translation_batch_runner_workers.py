from __future__ import annotations

import sys
import threading
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.services.results.applier import (
    TranslationResultApplier,
)
from retainpdf_pipeline.translate.workflow import batch_runner


class _FlushState:
    def __init__(self) -> None:
        self.dirty_pages: set[int] = set()
        self.progress: list[tuple[int, set[int], str]] = []
        self.flush_labels: list[str] = []
        self.final_flushed = False
        self.total_batches = 0

    def mark_dirty(self, pages: set[int], _changed_item_ids_by_page: dict[int, set[str]]) -> None:
        self.dirty_pages.update(pages)

    def record_progress(self, completed: int, touched_pages: set[int], *, substage: str = "translation_batches") -> None:
        self.progress.append((completed, set(touched_pages), substage))

    def flush_if_due(self, _completed: int, *, label: str) -> None:
        self.flush_labels.append(label)

    def final_flush(self) -> None:
        self.final_flushed = True


def test_parallel_batch_runner_only_keeps_worker_count_futures_active(monkeypatch) -> None:
    batches = [[{"item_id": f"i{index}", "page_idx": index, "source_text": str(index)}] for index in range(6)]
    payload = [
        {"item_id": f"i{index}", "page_idx": index, "source_text": str(index), "translated_text": ""}
        for index in range(6)
    ]
    lock = threading.Lock()
    active = 0
    peak_active = 0
    first_pair = threading.Barrier(2, timeout=5)

    def _translate(batch, **_kwargs):
        nonlocal active, peak_active
        with lock:
            active += 1
            peak_active = max(peak_active, active)
        if batch[0]["item_id"] in {"i0", "i1"}:
            first_pair.wait()
        with lock:
            active -= 1
        item_id = batch[0]["item_id"]
        return {item_id: {"decision": "translate", "translated_text": f"译{item_id}", "final_status": "translated"}}

    monkeypatch.setattr(batch_runner, "translate_batch", _translate)
    flush_state = _FlushState()
    applier = TranslationResultApplier(
        flat_payload=payload,
        item_to_page={item["item_id"]: item["page_idx"] for item in payload},
        duplicate_items_by_rep_id={},
        flush_state=flush_state,
        memory_store=None,
    )

    batch_runner.run_translation_batches_parallel(
        batched_fast_batches=[],
        single_fast_batches=batches,
        single_slow_batches=[],
        queue_workers={"batched_fast": 0, "single_fast": 2, "single_slow": 0},
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://example.test",
        domain_guidance="",
        mode="plain",
        translation_context=None,
        memory_store=None,
        result_applier=applier,
        flush_state=flush_state,
    )

    assert peak_active == 2
    assert flush_state.progress[-1][0] == 6


def test_parallel_batch_runner_workers_keep_pulling_when_result_apply_is_slow(monkeypatch) -> None:
    batches = [[{"item_id": f"i{index}", "page_idx": index, "source_text": str(index)}] for index in range(20)]
    payload = [
        {"item_id": f"i{index}", "page_idx": index, "source_text": str(index), "translated_text": ""}
        for index in range(20)
    ]
    lock = threading.Lock()
    started = 0
    peak_started_before_apply = 0
    apply_count = 0
    apply_started = threading.Event()
    workers_pulled_ahead = threading.Event()

    def _translate(batch, **_kwargs):
        nonlocal started, peak_started_before_apply
        with lock:
            started += 1
            request_number = started
            peak_started_before_apply = max(peak_started_before_apply, started - apply_count)
        if request_number > 4:
            assert apply_started.wait(5), "result application never started"
            workers_pulled_ahead.set()
        item_id = batch[0]["item_id"]
        return {item_id: {"decision": "translate", "translated_text": f"译{item_id}", "final_status": "translated"}}

    monkeypatch.setattr(batch_runner, "translate_batch", _translate)
    flush_state = _FlushState()
    applier = TranslationResultApplier(
        flat_payload=payload,
        item_to_page={item["item_id"]: item["page_idx"] for item in payload},
        duplicate_items_by_rep_id={},
        flush_state=flush_state,
        memory_store=None,
    )
    original_apply_batches = applier.apply_batches

    def _slow_apply_batches(*args, **kwargs):
        nonlocal apply_count
        apply_started.set()
        assert workers_pulled_ahead.wait(5), "workers stopped pulling while apply was blocked"
        result = original_apply_batches(*args, **kwargs)
        with lock:
            apply_count += 1
        return result

    applier.apply_batches = _slow_apply_batches

    batch_runner.run_translation_batches_parallel(
        batched_fast_batches=[],
        single_fast_batches=batches,
        single_slow_batches=[],
        queue_workers={"batched_fast": 0, "single_fast": 4, "single_slow": 0},
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://example.test",
        domain_guidance="",
        mode="plain",
        translation_context=None,
        memory_store=None,
        result_applier=applier,
        flush_state=flush_state,
    )

    assert flush_state.progress[-1][0] == 20
    assert peak_started_before_apply > 4


def test_parallel_batch_runner_fast_workers_share_batched_and_single_tail(monkeypatch) -> None:
    batched = [[{"item_id": f"b{index}", "page_idx": index, "source_text": str(index)}] for index in range(2)]
    singles = [[{"item_id": f"s{index}", "page_idx": index + 10, "source_text": str(index)}] for index in range(12)]
    payload = [
        {"item_id": f"b{index}", "page_idx": index, "source_text": str(index), "translated_text": ""}
        for index in range(2)
    ]
    payload.extend(
        {"item_id": f"s{index}", "page_idx": index + 10, "source_text": str(index), "translated_text": ""}
        for index in range(12)
    )
    lock = threading.Lock()
    active = 0
    peak_active = 0
    first_three = threading.Barrier(3, timeout=5)
    started = 0

    def _translate(batch, **_kwargs):
        nonlocal active, peak_active, started
        with lock:
            active += 1
            started += 1
            request_number = started
            peak_active = max(peak_active, active)
        if request_number <= 3:
            first_three.wait()
        with lock:
            active -= 1
        item_id = batch[0]["item_id"]
        return {item_id: {"decision": "translate", "translated_text": f"译{item_id}", "final_status": "translated"}}

    monkeypatch.setattr(batch_runner, "translate_batch", _translate)
    flush_state = _FlushState()
    applier = TranslationResultApplier(
        flat_payload=payload,
        item_to_page={item["item_id"]: item["page_idx"] for item in payload},
        duplicate_items_by_rep_id={},
        flush_state=flush_state,
        memory_store=None,
    )

    batch_runner.run_translation_batches_parallel(
        batched_fast_batches=batched,
        single_fast_batches=singles,
        single_slow_batches=[],
        queue_workers={"batched_fast": 10, "single_fast": 2, "single_slow": 0},
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://example.test",
        domain_guidance="",
        mode="plain",
        translation_context=None,
        memory_store=None,
        result_applier=applier,
        flush_state=flush_state,
    )

    assert flush_state.progress[-1][0] == 14
    assert peak_active > 2


def test_parallel_batch_runner_keeps_single_fast_workers_separate_from_batched_fast(monkeypatch) -> None:
    batched = [[{"item_id": f"b{index}", "page_idx": index, "source_text": str(index)}] for index in range(8)]
    singles = [[{"item_id": "s0", "page_idx": 20, "source_text": "single"}]]
    payload = [
        {"item_id": f"b{index}", "page_idx": index, "source_text": str(index), "translated_text": ""}
        for index in range(8)
    ]
    payload.append({"item_id": "s0", "page_idx": 20, "source_text": "single", "translated_text": ""})
    started: list[str] = []
    lock = threading.Lock()
    single_started = threading.Event()

    def _translate(batch, **_kwargs):
        item_id = batch[0]["item_id"]
        with lock:
            started.append(item_id)
        if item_id.startswith("b"):
            assert single_started.wait(5), "single-fast queue was starved"
        else:
            single_started.set()
        return {item_id: {"decision": "translate", "translated_text": f"译{item_id}", "final_status": "translated"}}

    monkeypatch.setattr(batch_runner, "translate_batch", _translate)
    flush_state = _FlushState()
    applier = TranslationResultApplier(
        flat_payload=payload,
        item_to_page={item["item_id"]: item["page_idx"] for item in payload},
        duplicate_items_by_rep_id={},
        flush_state=flush_state,
        memory_store=None,
    )

    batch_runner.run_translation_batches_parallel(
        batched_fast_batches=batched,
        single_fast_batches=singles,
        single_slow_batches=[],
        queue_workers={"batched_fast": 1, "single_fast": 1, "single_slow": 0},
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://example.test",
        domain_guidance="",
        mode="plain",
        translation_context=None,
        memory_store=None,
        result_applier=applier,
        flush_state=flush_state,
    )

    assert "s0" in started[:3]
    assert payload[-1]["translated_text"] == "译s0"
