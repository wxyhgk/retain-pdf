from __future__ import annotations

import sys
import time
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.llm.shared.control_context import (
    build_translation_control_context,
)
from retainpdf_pipeline.translate.llm.shared.tail_retry_queue import (
    TranslationTailItem,
)
from retainpdf_pipeline.translate.services.results.applier import (
    TranslationResultApplier,
)
from retainpdf_pipeline.translate.workflow import batch_runner
from retainpdf_pipeline.translate.workflow.scheduling import tail_retry


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


def _push_tail_item(context, item, translated_text: str = "尾部译文") -> None:
    context.translation_tail_queue.push(
        TranslationTailItem(
            item=item,
            api_key="sk-test",
            model="deepseek-chat",
            base_url="https://example.test",
            request_label="tail",
            context=context,
            diagnostics=None,
            single_item_translator=lambda tail_item, **_kwargs: {
                tail_item["item_id"]: {
                    "decision": "translate",
                    "translated_text": translated_text,
                    "final_status": "translated",
                }
            },
            store_cached_batch_fn=lambda *_args, **_kwargs: None,
        )
    )


def test_parallel_batch_runner_drains_global_transport_tail_retry_queue(monkeypatch) -> None:
    context = build_translation_control_context()
    payload = [
        {"item_id": "a", "page_idx": 0, "source_text": "A", "translated_text": ""},
        {"item_id": "b", "page_idx": 1, "source_text": "B", "translated_text": ""},
    ]
    _push_tail_item(context, payload[1], "乙")
    monkeypatch.setattr(
        batch_runner,
        "translate_batch",
        lambda batch, **_kwargs: {
            batch[0]["item_id"]: {
                "decision": "translate",
                "translated_text": "甲",
                "final_status": "translated",
            }
        },
    )
    flush_state = _FlushState()
    flush_state.total_batches = 1
    applier = TranslationResultApplier(
        flat_payload=payload,
        item_to_page={"a": 0, "b": 1},
        duplicate_items_by_rep_id={},
        flush_state=flush_state,
        memory_store=None,
    )

    batch_runner.run_translation_batches_parallel(
        batched_fast_batches=[],
        single_fast_batches=[[payload[0]]],
        single_slow_batches=[],
        queue_workers={"batched_fast": 1, "single_fast": 1, "single_slow": 1},
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://example.test",
        domain_guidance="",
        mode="plain",
        translation_context=context,
        memory_store=None,
        result_applier=applier,
        flush_state=flush_state,
    )

    assert payload[0]["translated_text"] == "甲"
    assert payload[1]["translated_text"] == "乙"
    assert len(context.translation_tail_queue) == 0
    assert flush_state.total_batches == 2
    assert flush_state.progress[-1] == (2, {1}, "translation_tail_retry")


def test_single_worker_tail_retry_exception_marks_item_failed(monkeypatch) -> None:
    context = build_translation_control_context()
    payload = [
        {"item_id": "tail", "page_idx": 9, "source_text": "tail", "translated_text": ""},
    ]
    context.translation_tail_queue.push(
        TranslationTailItem(
            item=payload[0],
            api_key="sk-test",
            model="deepseek-chat",
            base_url="https://example.test",
            request_label="tail",
            context=context,
            diagnostics=None,
            single_item_translator=lambda *_args, **_kwargs: {},
            store_cached_batch_fn=lambda *_args, **_kwargs: None,
        )
    )
    monkeypatch.setattr(
        tail_retry,
        "_run_translation_tail_item",
        lambda _tail_item: (_ for _ in ()).throw(RuntimeError("tail boom")),
    )
    flush_state = _FlushState()
    applier = TranslationResultApplier(
        flat_payload=payload,
        item_to_page={"tail": 9},
        duplicate_items_by_rep_id={},
        flush_state=flush_state,
        memory_store=None,
    )

    tail_retry._drain_translation_tail_queue(
        translation_context=context,
        result_applier=applier,
        flush_state=flush_state,
        tail_workers=1,
    )

    assert payload[0]["final_status"] == "failed"
    assert payload[0]["translation_diagnostics"]["degradation_reason"] == "batch_unhandled_exception"
    assert flush_state.progress[-1] == (1, {9}, "translation_tail_retry")


def test_parallel_batch_runner_can_disable_early_transport_tail_retry(monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_TRANSLATION_EARLY_TAIL_RETRY", "0")
    context = build_translation_control_context()
    monkeypatch.setenv("RETAIN_TRANSLATION_EARLY_TAIL_RETRY_INTERVAL", "1")
    batches = [[{"item_id": f"i{index}", "page_idx": index, "source_text": str(index)}] for index in range(3)]
    payload = [
        {"item_id": f"i{index}", "page_idx": index, "source_text": str(index), "translated_text": ""}
        for index in range(3)
    ]
    payload.append({"item_id": "tail", "page_idx": 9, "source_text": "tail", "translated_text": ""})
    _push_tail_item(context, payload[-1])
    completed_main_when_tail_applied: list[int] = []

    def _translate(batch, **_kwargs):
        item_id = batch[0]["item_id"]
        time.sleep(0.01)
        return {item_id: {"decision": "translate", "translated_text": f"译{item_id}", "final_status": "translated"}}

    monkeypatch.setattr(batch_runner, "translate_batch", _translate)
    flush_state = _FlushState()
    flush_state.total_batches = len(batches)
    applier = TranslationResultApplier(
        flat_payload=payload,
        item_to_page={item["item_id"]: item["page_idx"] for item in payload},
        duplicate_items_by_rep_id={},
        flush_state=flush_state,
        memory_store=None,
    )
    original_apply_batch = applier.apply_batch

    def _record_tail_apply(batch, translated, **kwargs):
        if batch and batch[0].get("item_id") == "tail":
            completed_main_when_tail_applied.append(flush_state.progress[-1][0] if flush_state.progress else 0)
        return original_apply_batch(batch, translated, **kwargs)

    applier.apply_batch = _record_tail_apply

    batch_runner.run_translation_batches_parallel(
        batched_fast_batches=[],
        single_fast_batches=batches,
        single_slow_batches=[],
        queue_workers={"batched_fast": 0, "single_fast": 1, "single_slow": 0},
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://example.test",
        domain_guidance="",
        mode="plain",
        translation_context=context,
        memory_store=None,
        result_applier=applier,
        flush_state=flush_state,
    )

    assert payload[-1]["translated_text"] == "尾部译文"
    assert completed_main_when_tail_applied
    assert completed_main_when_tail_applied[0] == 3
    assert flush_state.progress[-1][0] == 4


def test_parallel_batch_runner_can_drain_transport_tail_retry_before_main_batches_finish(monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_TRANSLATION_EARLY_TAIL_RETRY", "1")
    context = build_translation_control_context()
    monkeypatch.setenv("RETAIN_TRANSLATION_EARLY_TAIL_RETRY_INTERVAL", "1")
    batches = [[{"item_id": f"i{index}", "page_idx": index, "source_text": str(index)}] for index in range(3)]
    payload = [
        {"item_id": f"i{index}", "page_idx": index, "source_text": str(index), "translated_text": ""}
        for index in range(3)
    ]
    payload.append({"item_id": "tail", "page_idx": 9, "source_text": "tail", "translated_text": ""})
    _push_tail_item(context, payload[-1])
    completed_main_when_tail_applied: list[int] = []

    def _translate(batch, **_kwargs):
        item_id = batch[0]["item_id"]
        time.sleep(0.01)
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
    original_apply_batch = applier.apply_batch

    def _record_tail_apply(batch, translated, **kwargs):
        if batch and batch[0].get("item_id") == "tail":
            completed_main_when_tail_applied.append(flush_state.progress[-1][0] if flush_state.progress else 0)
        return original_apply_batch(batch, translated, **kwargs)

    applier.apply_batch = _record_tail_apply

    batch_runner.run_translation_batches_parallel(
        batched_fast_batches=[],
        single_fast_batches=batches,
        single_slow_batches=[],
        queue_workers={"batched_fast": 0, "single_fast": 1, "single_slow": 0},
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://example.test",
        domain_guidance="",
        mode="plain",
        translation_context=context,
        memory_store=None,
        result_applier=applier,
        flush_state=flush_state,
    )

    assert payload[-1]["translated_text"] == "尾部译文"
    assert completed_main_when_tail_applied
    assert completed_main_when_tail_applied[0] < 3
    assert flush_state.progress[-1][0] == 3


def test_transport_tail_retry_workers_scale_with_main_worker_count() -> None:
    assert batch_runner._transport_tail_retry_workers({"batched_fast": 1, "single_fast": 0, "single_slow": 0}) == 1
    assert batch_runner._transport_tail_retry_workers({"batched_fast": 80, "single_fast": 20, "single_slow": 0}) == 50
    assert batch_runner._transport_tail_retry_workers({"batched_fast": 800, "single_fast": 200, "single_slow": 0}) == 128


def test_early_transport_tail_retry_is_enabled_by_default(monkeypatch) -> None:
    monkeypatch.delenv("RETAIN_TRANSLATION_EARLY_TAIL_RETRY", raising=False)

    assert tail_retry._early_tail_retry_enabled() is True


def test_early_transport_tail_retry_interval_is_configurable(monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_TRANSLATION_EARLY_TAIL_RETRY", "1")
    monkeypatch.setenv("RETAIN_TRANSLATION_EARLY_TAIL_RETRY_INTERVAL", "7")

    assert tail_retry._should_drain_translation_tail_early(7, 20) is True
    assert tail_retry._should_drain_translation_tail_early(6, 20) is False


def test_transport_tail_retry_workers_can_be_configured(monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_TRANSLATION_TAIL_RETRY_WORKERS", "32")
    assert batch_runner._transport_tail_retry_workers({"batched_fast": 1}) == 32

    monkeypatch.delenv("RETAIN_TRANSLATION_TAIL_RETRY_WORKERS", raising=False)
    monkeypatch.setenv("RETAIN_TRANSLATION_TAIL_RETRY_WORKER_DIVISOR", "4")
    monkeypatch.setenv("RETAIN_TRANSLATION_TAIL_RETRY_WORKER_LIMIT", "20")
    assert batch_runner._transport_tail_retry_workers({"batched_fast": 80, "single_fast": 20}) == 20
