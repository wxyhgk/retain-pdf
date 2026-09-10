from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import replace

from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import should_store_translation_result
import retainpdf_pipeline.translate.llm.shared.orchestration.terminal_payloads as terminal_payloads
from retainpdf_pipeline.translate.llm.shared.orchestration.transport import DeferredTransportRetry
from retainpdf_pipeline.translate.llm.shared.orchestration.transport import DeferredValidationRetry
from retainpdf_pipeline.translate.llm.shared.orchestration.transport import build_transport_tail_retry_context
from retainpdf_pipeline.translate.llm.shared.orchestration.transport import mark_transport_result_dead_letter
from retainpdf_pipeline.translate.llm.shared.tail_retry_queue import TranslationTailItem
from retainpdf_pipeline.translate.llm.shared.tail_retry_queue import translation_tail_queue_from_context


def translate_uncached_items_single(
    uncached_batch: list[dict],
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics,
    single_item_translator,
    store_cached_batch_fn,
) -> tuple[dict[str, dict[str, str]], list[dict]]:
    total_items = len(uncached_batch)
    if total_items <= 1:
        return _translate_uncached_items_single_sequential(
            uncached_batch,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            single_item_translator=single_item_translator,
            store_cached_batch_fn=store_cached_batch_fn,
        )

    merged: dict[str, dict[str, str]] = {}
    deferred_transport_items: list[dict] = []
    deferred_validation_items: list[dict] = []
    max_workers = max(1, min(total_items, 4))

    def _run(index: int, item: dict) -> tuple[dict, dict[str, dict[str, str]], str]:
        item_label = f"{request_label} item {index}/{total_items} {item['item_id']}" if request_label else ""
        item_context = context.scoped_to_item(item)
        try:
            result = single_item_translator(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=item_label,
                context=item_context,
                diagnostics=diagnostics,
                allow_transport_tail_defer=item_context.fallback_policy.transport_tail_retry_passes > 0,
            )
        except DeferredTransportRetry:
            return item, {}, "transport"
        except DeferredValidationRetry:
            return item, {}, "validation"
        payload = result.get(item["item_id"], {})
        if should_store_translation_result(payload):
            store_cached_batch_fn(
                [item],
                result,
                model=model,
                base_url=base_url,
                domain_guidance=item_context.cache_guidance,
                mode=item_context.mode,
                target_lang=item_context.target_lang,
                target_language_name=item_context.target_language_name,
            )
        return item, result, ""

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(_run, index, item): item
            for index, item in enumerate(uncached_batch, start=1)
        }
        for future in as_completed(futures):
            item, result, deferred_reason = future.result()
            if deferred_reason == "transport":
                deferred_transport_items.append(item)
            elif deferred_reason == "validation":
                deferred_validation_items.append(item)
            else:
                merged.update(result)
    if deferred_validation_items:
        enqueue_deferred_tail_items(
            deferred_validation_items,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            single_item_translator=single_item_translator,
            store_cached_batch_fn=store_cached_batch_fn,
            reason="validation",
        )
    return merged, deferred_transport_items


def _translate_uncached_items_single_sequential(
    uncached_batch: list[dict],
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics,
    single_item_translator,
    store_cached_batch_fn,
) -> tuple[dict[str, dict[str, str]], list[dict]]:
    merged: dict[str, dict[str, str]] = {}
    total_items = len(uncached_batch)
    deferred_transport_items: list[dict] = []
    for index, item in enumerate(uncached_batch, start=1):
        item_label = f"{request_label} item {index}/{total_items} {item['item_id']}" if request_label else ""
        item_context = context.scoped_to_item(item)
        try:
            result = single_item_translator(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=item_label,
                context=item_context,
                diagnostics=diagnostics,
                allow_transport_tail_defer=item_context.fallback_policy.transport_tail_retry_passes > 0,
            )
        except DeferredTransportRetry:
            deferred_transport_items.append(item)
            continue
        except DeferredValidationRetry:
            enqueue_deferred_tail_items(
                [item],
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                context=context,
                diagnostics=diagnostics,
                single_item_translator=single_item_translator,
                store_cached_batch_fn=store_cached_batch_fn,
                reason="validation",
            )
            continue
        payload = result.get(item["item_id"], {})
        if should_store_translation_result(payload):
            store_cached_batch_fn(
                [item],
                result,
                model=model,
                base_url=base_url,
                domain_guidance=item_context.cache_guidance,
                mode=item_context.mode,
                target_lang=item_context.target_lang,
                target_language_name=item_context.target_language_name,
            )
        merged.update(result)
    return merged, deferred_transport_items


def retry_deferred_transport_items(
    deferred_transport_items: list[dict],
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics,
    single_item_translator,
    store_cached_batch_fn,
) -> dict[str, dict[str, str]]:
    merged: dict[str, dict[str, str]] = {}
    if not deferred_transport_items or context.fallback_policy.transport_tail_retry_passes <= 0:
        return merged
    tail_context = build_transport_tail_retry_context(context)
    if request_label:
        print(
            f"{request_label}: start transport tail retry pass items={len(deferred_transport_items)} timeout={tail_context.timeout_policy.plain_text_seconds}s",
            flush=True,
        )
    for index, item in enumerate(deferred_transport_items, start=1):
        item_label = f"{request_label} tail item {index}/{len(deferred_transport_items)} {item['item_id']}" if request_label else ""
        item_context = replace(
            tail_context.scoped_to_item(item),
            fallback_policy=replace(
                tail_context.fallback_policy,
                main_http_retry_attempts=max(
                    tail_context.fallback_policy.main_http_retry_attempts,
                    tail_context.fallback_policy.tail_http_retry_attempts,
                ),
            ),
        )
        try:
            result = single_item_translator(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=item_label,
                context=item_context,
                diagnostics=diagnostics,
                allow_transport_tail_defer=False,
            )
            result = mark_transport_result_dead_letter(
                result,
                item=item,
                context=item_context,
                diagnostics=diagnostics,
            )
        except Exception as exc:
            if request_label:
                print(
                    f"{item_label}: tail retry item failed without blocking batch: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if diagnostics is not None:
                diagnostics.emit(
                    kind="transport_tail_retry_item_failed",
                    item_id=str(item.get("item_id", "") or ""),
                    page_idx=item.get("page_idx"),
                    severity="error",
                    message=f"Tail retry item failed: {type(exc).__name__}: {exc}",
                    retryable=True,
                )
            result = terminal_payloads.translation_failed_payload(
                item,
                context=item_context,
                route_path=["block_level", "plain_text", "tail_retry", "failed"],
                degradation_reason="transport_tail_retry_item_exception",
                error_taxonomy="transport",
                error_trace=[
                    {
                        "type": "transport",
                        "code": type(exc).__name__ or "TAIL_RETRY_EXCEPTION",
                        "message": str(exc),
                    }
                ],
                fallback_to="dead_letter_queue",
                dead_letter=True,
            )
        payload = result.get(item["item_id"], {})
        if should_store_translation_result(payload):
            store_cached_batch_fn(
                [item],
                result,
                model=model,
                base_url=base_url,
                domain_guidance=item_context.cache_guidance,
                mode=item_context.mode,
                target_lang=item_context.target_lang,
                target_language_name=item_context.target_language_name,
            )
        merged.update(result)
    return merged


def run_translation_tail_items(
    tail_items: list,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics,
    single_item_translator,
    store_cached_batch_fn,
) -> dict[str, dict[str, str]]:
    merged: dict[str, dict[str, str]] = {}
    if not tail_items:
        return merged
    transport_items = [tail_item.item for tail_item in tail_items if _tail_reason(tail_item) == "transport"]
    if transport_items:
        merged.update(
            retry_deferred_transport_items(
                transport_items,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                context=context,
                diagnostics=diagnostics,
                single_item_translator=single_item_translator,
                store_cached_batch_fn=store_cached_batch_fn,
            )
        )
    for tail_item in tail_items:
        reason = _tail_reason(tail_item)
        if reason == "transport":
            continue
        item = tail_item.item
        result = _run_non_transport_tail_item(
            item,
            reason=reason,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            single_item_translator=single_item_translator,
            store_cached_batch_fn=store_cached_batch_fn,
        )
        merged.update(result)
    return merged


def _run_non_transport_tail_item(
    item: dict,
    *,
    reason: str,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics,
    single_item_translator,
    store_cached_batch_fn,
) -> dict[str, dict[str, str]]:
    item_context = context.scoped_to_item(item)
    item_label = f"{request_label} tail {reason} {item['item_id']}" if request_label else ""
    try:
        result = single_item_translator(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=item_label,
            context=item_context,
            diagnostics=diagnostics,
            allow_transport_tail_defer=False,
        )
    except Exception as exc:
        if request_label:
            print(
                f"{item_label}: translation tail item failed without blocking batch: {type(exc).__name__}: {exc}",
                flush=True,
            )
        if diagnostics is not None:
            diagnostics.emit(
                kind="translation_tail_item_failed",
                item_id=str(item.get("item_id", "") or ""),
                page_idx=item.get("page_idx"),
                severity="error",
                message=f"Tail item failed reason={reason}: {type(exc).__name__}: {exc}",
                retryable=True,
            )
        return terminal_payloads.translation_failed_payload(
            item,
            context=item_context,
            route_path=["block_level", reason, "tail_retry", "failed"],
            degradation_reason=f"{reason}_tail_retry_item_exception",
            error_taxonomy="validation" if reason == "validation" else "protocol",
            error_trace=[
                {
                    "type": "validation" if reason == "validation" else "protocol",
                    "code": type(exc).__name__ or "TAIL_RETRY_EXCEPTION",
                    "message": str(exc),
                }
            ],
            fallback_to="dead_letter_queue",
            dead_letter=True,
        )
    payload = result.get(item["item_id"], {})
    if should_store_translation_result(payload):
        store_cached_batch_fn(
            [item],
            result,
            model=model,
            base_url=base_url,
            domain_guidance=item_context.cache_guidance,
            mode=item_context.mode,
            target_lang=item_context.target_lang,
            target_language_name=item_context.target_language_name,
        )
    return result


def _tail_reason(tail_item) -> str:
    return str(getattr(tail_item, "reason", "") or "transport").strip().lower()


def enqueue_deferred_tail_items(
    deferred_items: list[dict],
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics,
    single_item_translator,
    store_cached_batch_fn,
    reason: str = "tail_retry",
) -> bool:
    queue = translation_tail_queue_from_context(context)
    if not deferred_items or context.fallback_policy.transport_tail_retry_passes <= 0 or queue is None:
        return False
    for item in deferred_items:
        if diagnostics is not None:
            diagnostics.emit(
                kind="translation_tail_retry_queued",
                item_id=str(item.get("item_id", "") or ""),
                page_idx=item.get("page_idx"),
                severity="warning",
                message=f"Queued item for tail retry: {reason}",
                retryable=True,
            )
        queue.push(
            TranslationTailItem(
                item=item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                context=context,
                diagnostics=diagnostics,
                single_item_translator=single_item_translator,
                store_cached_batch_fn=store_cached_batch_fn,
                reason=reason,
                source_route=("block_level", reason),
                priority=_tail_retry_priority(reason),
            )
        )
    if request_label:
        print(
            f"{request_label}: queued tail retry items={len(deferred_items)} reason={reason}",
            flush=True,
        )
    return True


def enqueue_deferred_transport_items(
    deferred_transport_items: list[dict],
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics,
    single_item_translator,
    store_cached_batch_fn,
) -> bool:
    return enqueue_deferred_tail_items(
        deferred_transport_items,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        context=context,
        diagnostics=diagnostics,
        single_item_translator=single_item_translator,
        store_cached_batch_fn=store_cached_batch_fn,
        reason="transport",
    )


def _tail_retry_priority(reason: str) -> int:
    normalized = str(reason or "").strip().lower()
    if normalized == "transport":
        return 20
    if normalized == "batched_plain_fallback":
        return 40
    if normalized == "validation":
        return 60
    if normalized == "repair":
        return 80
    return 100
