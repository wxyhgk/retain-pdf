from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context
from retainpdf_pipeline.translate.llm.shared.orchestration.batched_plain import translate_items_plain_text
from retainpdf_pipeline.translate.llm.shared.orchestration.transport import DeferredTransportRetry
from retainpdf_pipeline.translate.llm.shared.orchestration.transport import DeferredValidationRetry


def _item(item_id: str, text: str, **overrides):
    item = {
        "item_id": item_id,
        "block_type": "text",
        "source_text": text,
        "protected_source_text": text,
        "should_translate": True,
    }
    item.update(overrides)
    return item


def test_single_batched_plain_candidate_uses_single_item_path_instead_of_tail_queue() -> None:
    batch = [
        _item(
            "a",
            "This body paragraph is long enough for normal single-item translation.",
            _batched_plain_candidate=True,
        )
    ]
    context = build_translation_control_context()
    calls: list[str] = []

    def _single_item_translator(item, **_kwargs):
        calls.append(item["item_id"])
        return {
            item["item_id"]: {
                "decision": "translate",
                "translated_text": "正文已翻译",
                "final_status": "translated",
            }
        }

    result = translate_items_plain_text(
        batch,
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label="test single batched candidate",
        context=context,
        diagnostics=None,
        single_item_translator=_single_item_translator,
        split_cached_batch_fn=lambda batch_arg, **_kwargs: ({}, batch_arg),
        store_cached_batch_fn=lambda *_args, **_kwargs: None,
        translate_batch_once_fn=lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("must not batch")),
    )

    assert result["a"]["translated_text"] == "正文已翻译"
    assert calls == ["a"]
    assert len(context.translation_tail_queue) == 0


def test_failed_batched_plain_request_is_queued_instead_of_retried_inline() -> None:
    batch = [
        _item(
            "a",
            "This body paragraph is long enough for the single-item translation path.",
            _batched_plain_candidate=False,
        ),
        _item(
            "b",
            "A second body paragraph should still finish before tail retry starts.",
            _batched_plain_candidate=False,
        ),
    ]
    context = build_translation_control_context()
    calls: list[str] = []

    def _single_item_translator(item, **kwargs):
        calls.append(f"{item['item_id']}:{kwargs['allow_transport_tail_defer']}")
        if item["item_id"] == "a":
            raise DeferredTransportRetry(item=item, route_path=["block_level"], cause=TimeoutError("timeout"))
        return {
            "b": {
                "decision": "translate",
                "translated_text": "第二段已翻译",
                "final_status": "translated",
            }
        }

    result = translate_items_plain_text(
        batch,
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label="test tail queue",
        context=context,
        diagnostics=None,
        single_item_translator=_single_item_translator,
        split_cached_batch_fn=lambda batch_arg, **_kwargs: ({}, batch_arg),
        store_cached_batch_fn=lambda *_args, **_kwargs: None,
        translate_batch_once_fn=lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("skip batched path")),
    )

    assert result == {}
    assert calls == []
    assert len(context.translation_tail_queue) == 2


def test_validation_failure_from_single_fallback_is_queued_instead_of_retried_inline(monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_TRANSLATION_INLINE_BATCH_FALLBACK", "1")
    batch = [
        _item(
            "a",
            "This body paragraph is long enough for the single-item translation path.",
            _batched_plain_candidate=False,
        ),
        _item(
            "b",
            "A second body paragraph should still finish before validation tail retry starts.",
            _batched_plain_candidate=False,
        ),
    ]
    context = build_translation_control_context()
    calls: list[str] = []

    def _single_item_translator(item, **kwargs):
        calls.append(f"{item['item_id']}:{kwargs['allow_transport_tail_defer']}")
        if item["item_id"] == "a":
            raise DeferredValidationRetry(item=item, route_path=["block_level", "validation"], cause=ValueError("bad output"))
        return {
            "b": {
                "decision": "translate",
                "translated_text": "第二段已翻译",
                "final_status": "translated",
            }
        }

    result = translate_items_plain_text(
        batch,
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label="test validation tail queue",
        context=context,
        diagnostics=None,
        single_item_translator=_single_item_translator,
        split_cached_batch_fn=lambda batch_arg, **_kwargs: ({}, batch_arg),
        store_cached_batch_fn=lambda *_args, **_kwargs: None,
        translate_batch_once_fn=lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("skip batched path")),
    )

    assert result == {
        "b": {
            "decision": "translate",
            "translated_text": "第二段已翻译",
            "final_status": "translated",
        }
    }
    assert calls == ["a:True", "b:True"]
    drained = context.translation_tail_queue.drain()
    assert [item.item["item_id"] for item in drained] == ["a"]
    assert [item.reason for item in drained] == ["validation"]


def test_batched_plain_fallback_queues_uncached_items_for_tail_retry_by_default() -> None:
    batch = [
        _item(
            f"item-{index}",
            "This body paragraph is long enough for the batched plain translation path.",
            _batched_plain_candidate=True,
        )
        for index in range(4)
    ]
    context = build_translation_control_context()
    calls: list[str] = []

    def _single_item_translator(item, **_kwargs):
        calls.append(item["item_id"])
        return {
            item["item_id"]: {
                "decision": "translate",
                "translated_text": f"已翻译 {item['item_id']}",
                "final_status": "translated",
            }
        }

    result = translate_items_plain_text(
        batch,
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label="test batched fallback",
        context=context,
        diagnostics=None,
        single_item_translator=_single_item_translator,
        split_cached_batch_fn=lambda batch_arg, **_kwargs: ({}, batch_arg),
        store_cached_batch_fn=lambda *_args, **_kwargs: None,
        translate_batch_once_fn=lambda *_args, **_kwargs: (_ for _ in ()).throw(ValueError("bad batch")),
    )

    assert result == {}
    assert calls == []
    assert len(context.translation_tail_queue) == len(batch)


def test_batched_plain_fallback_can_retry_uncached_items_inline_for_compatibility(monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_TRANSLATION_INLINE_BATCH_FALLBACK", "1")
    batch = [
        _item(
            f"item-{index}",
            "This body paragraph is long enough for the batched plain translation path.",
            _batched_plain_candidate=True,
        )
        for index in range(4)
    ]
    context = build_translation_control_context()
    calls: list[str] = []

    def _single_item_translator(item, **_kwargs):
        calls.append(item["item_id"])
        return {
            item["item_id"]: {
                "decision": "translate",
                "translated_text": f"已翻译 {item['item_id']}",
                "final_status": "translated",
            }
        }

    result = translate_items_plain_text(
        batch,
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label="test batched fallback",
        context=context,
        diagnostics=None,
        single_item_translator=_single_item_translator,
        split_cached_batch_fn=lambda batch_arg, **_kwargs: ({}, batch_arg),
        store_cached_batch_fn=lambda *_args, **_kwargs: None,
        translate_batch_once_fn=lambda *_args, **_kwargs: (_ for _ in ()).throw(ValueError("bad batch")),
    )

    assert sorted(result) == [item["item_id"] for item in batch]
    assert sorted(calls) == [item["item_id"] for item in batch]
