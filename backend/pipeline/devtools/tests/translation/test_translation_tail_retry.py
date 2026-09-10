from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context
from retainpdf_pipeline.translate.llm.shared.control_context import FallbackPolicy
from retainpdf_pipeline.translate.llm.shared.control_context import TimeoutPolicy
from retainpdf_pipeline.translate.llm.shared.control_context import EngineProfile
from retainpdf_pipeline.translate.llm.shared.orchestration.batched_plain_single import run_translation_tail_items
from retainpdf_pipeline.translate.llm.shared.orchestration.batched_plain_single import retry_deferred_transport_items
from retainpdf_pipeline.translate.llm.shared.tail_retry_queue import TranslationTailItem
from retainpdf_pipeline.translate.llm.shared.tail_retry_queue import TranslationTailQueue


class _Diagnostics:
    def __init__(self) -> None:
        self.events: list[dict] = []

    def emit(self, **kwargs) -> None:
        self.events.append(kwargs)


def test_tail_retry_item_exception_marks_only_that_item_failed() -> None:
    context = build_translation_control_context()
    diagnostics = _Diagnostics()
    stored: list[dict] = []
    items = [
        {"item_id": "a", "page_idx": 0, "source_text": "A"},
        {"item_id": "b", "page_idx": 0, "source_text": "B"},
    ]

    def translator(item: dict, **_kwargs):
        if item["item_id"] == "a":
            raise RuntimeError("parser failed")
        return {
            "b": {
                "decision": "translate",
                "translated_text": "乙",
                "final_status": "translated",
            }
        }

    result = retry_deferred_transport_items(
        items,
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://example.test",
        request_label="tail-test",
        context=context,
        diagnostics=diagnostics,
        single_item_translator=translator,
        store_cached_batch_fn=lambda batch, payload, **_kwargs: stored.append({"batch": batch, "payload": payload}),
    )

    assert result["a"]["final_status"] == "failed"
    assert result["a"]["translation_diagnostics"]["dead_letter"] is True
    assert result["a"]["translation_diagnostics"]["degradation_reason"] == "transport_tail_retry_item_exception"
    assert result["b"]["translated_text"] == "乙"
    assert diagnostics.events[0]["kind"] == "transport_tail_retry_item_failed"
    assert len(stored) == 1
    assert stored[0]["batch"][0]["item_id"] == "b"


def test_translation_tail_queue_drains_by_priority_then_attempt() -> None:
    queue = TranslationTailQueue()
    base = {
        "api_key": "sk-test",
        "model": "deepseek-chat",
        "base_url": "https://example.test",
        "request_label": "tail-test",
        "context": object(),
        "diagnostics": None,
        "single_item_translator": lambda *_args, **_kwargs: {},
        "store_cached_batch_fn": lambda *_args, **_kwargs: None,
    }
    queue.push(TranslationTailItem(item={"item_id": "repair"}, reason="repair", priority=80, attempt=1, **base))
    queue.push(TranslationTailItem(item={"item_id": "transport-2"}, reason="transport", priority=20, attempt=2, **base))
    queue.push(TranslationTailItem(item={"item_id": "transport-1"}, reason="transport", priority=20, attempt=1, **base))
    queue.push(TranslationTailItem(item={"item_id": "batch"}, reason="batched_plain_fallback", priority=40, attempt=1, **base))

    drained = queue.drain()

    assert [item.item["item_id"] for item in drained] == ["transport-1", "transport-2", "batch", "repair"]


def test_translation_tail_queue_deduplicates_same_item_and_reason() -> None:
    queue = TranslationTailQueue()
    base = {
        "api_key": "sk-test",
        "model": "deepseek-chat",
        "base_url": "https://example.test",
        "request_label": "tail-test",
        "context": object(),
        "diagnostics": None,
        "single_item_translator": lambda *_args, **_kwargs: {},
        "store_cached_batch_fn": lambda *_args, **_kwargs: None,
    }
    queue.push(TranslationTailItem(item={"item_id": "same"}, reason="validation", priority=60, attempt=1, **base))
    queue.push(TranslationTailItem(item={"item_id": "same"}, reason="validation", priority=60, attempt=2, **base))
    queue.push(TranslationTailItem(item={"item_id": "same"}, reason="transport", priority=20, attempt=1, **base))

    drained = queue.drain()

    assert [(item.item["item_id"], item.reason, item.attempt) for item in drained] == [
        ("same", "transport", 1),
        ("same", "validation", 1),
    ]


def test_translation_context_keeps_legacy_transport_tail_queue_alias() -> None:
    context = build_translation_control_context()

    assert context.transport_tail_retry_queue is context.translation_tail_queue


def test_translation_tail_dispatcher_uses_transport_retry_context_only_for_transport_items() -> None:
    context = build_translation_control_context(
        engine_profile=EngineProfile(
            timeout_policy=TimeoutPolicy(plain_text_seconds=10, transport_tail_retry_seconds=70),
            fallback_policy=FallbackPolicy(main_http_retry_attempts=1, tail_http_retry_attempts=3),
        )
    )
    calls: list[dict] = []
    base = {
        "api_key": "sk-test",
        "model": "deepseek-chat",
        "base_url": "https://example.test",
        "request_label": "tail-test",
        "context": context,
        "diagnostics": None,
        "store_cached_batch_fn": lambda *_args, **_kwargs: None,
    }

    def translator(item: dict, **kwargs):
        call_context = kwargs["context"]
        calls.append(
            {
                "item_id": item["item_id"],
                "timeout": call_context.timeout_policy.plain_text_seconds,
                "main_attempts": call_context.fallback_policy.main_http_retry_attempts,
                "allow_defer": kwargs["allow_transport_tail_defer"],
            }
        )
        return {
            item["item_id"]: {
                "decision": "translate",
                "translated_text": f"译文 {item['item_id']}",
                "final_status": "translated",
            }
        }

    result = run_translation_tail_items(
        [
            TranslationTailItem(item={"item_id": "transport", "page_idx": 0, "source_text": "A"}, reason="transport", **base, single_item_translator=translator),
            TranslationTailItem(item={"item_id": "validation", "page_idx": 0, "source_text": "B"}, reason="validation", **base, single_item_translator=translator),
        ],
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://example.test",
        request_label="tail-test",
        context=context,
        diagnostics=None,
        single_item_translator=translator,
        store_cached_batch_fn=lambda *_args, **_kwargs: None,
    )

    assert result["transport"]["translated_text"] == "译文 transport"
    assert result["validation"]["translated_text"] == "译文 validation"
    assert calls == [
        {"item_id": "transport", "timeout": 70, "main_attempts": 3, "allow_defer": False},
        {"item_id": "validation", "timeout": 10, "main_attempts": 1, "allow_defer": False},
    ]
