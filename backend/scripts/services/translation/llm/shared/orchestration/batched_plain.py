from __future__ import annotations

import json

from services.translation.diagnostics import TranslationDiagnosticsCollector
from services.translation.llm.placeholder_guard import EmptyTranslationError
from services.translation.llm.placeholder_guard import EnglishResidueError
from services.translation.llm.placeholder_guard import MathDelimiterError
from services.translation.llm.placeholder_guard import PlaceholderInventoryError
from services.translation.llm.placeholder_guard import SuspiciousKeepOriginError
from services.translation.llm.placeholder_guard import TranslationProtocolError
from services.translation.llm.placeholder_guard import UnexpectedPlaceholderError
from services.translation.llm.placeholder_guard import canonicalize_batch_result
from services.translation.llm.placeholder_guard import item_with_runtime_hard_glossary
from services.translation.llm.shared.cache import split_cached_batch
from services.translation.llm.shared.cache import store_cached_batch
from services.translation.llm.shared.orchestration.common import is_low_risk_deepseek_batch_item
from services.translation.llm.shared.orchestration.metadata import attach_result_metadata
from services.translation.llm.shared.orchestration.metadata import restore_runtime_term_tokens
from services.translation.llm.shared.orchestration.metadata import should_store_translation_result
from services.translation.llm.shared.orchestration.transport import DeferredTransportRetry
from services.translation.llm.shared.orchestration.transport import build_transport_tail_retry_context
from services.translation.llm.shared.orchestration.transport import mark_transport_result_dead_letter
from services.translation.llm.shared.provider_runtime import is_transport_error
from services.translation.llm.shared.provider_runtime import translate_batch_once
from services.translation.llm.placeholder_guard import validate_batch_result


def should_use_direct_deepseek_batch(
    batch: list[dict],
    *,
    model: str,
    base_url: str,
    context,
) -> bool:
    if len(batch) <= 1:
        return False
    if all(bool(item.get("_batched_plain_candidate")) for item in batch):
        return True
    del model, base_url
    return all(
        is_low_risk_deepseek_batch_item(
            item,
            batch_low_risk_max_placeholders=context.batch_policy.batch_low_risk_max_placeholders,
            batch_low_risk_min_chars=context.batch_policy.batch_low_risk_min_chars,
            batch_low_risk_max_chars=context.batch_policy.batch_low_risk_max_chars,
        )
        for item in batch
    )


def split_batched_plain_result_for_partial_retry(
    batch: list[dict],
    result: dict[str, dict[str, str]],
    *,
    context,
    diagnostics: TranslationDiagnosticsCollector | None,
) -> tuple[dict[str, dict[str, str]], list[dict]]:
    item_by_id = {item["item_id"]: item for item in batch}
    accepted: dict[str, dict[str, str]] = {}
    retry_items: list[dict] = []
    for item in batch:
        item_id = item["item_id"]
        payload = result.get(item_id)
        if payload is None:
            retry_items.append(item)
            continue
        try:
            canonical = canonicalize_batch_result([item], {item_id: payload})
            validate_batch_result([item], canonical, diagnostics=diagnostics)
            restored = restore_runtime_term_tokens(canonical, item=item)
            accepted.update(
                attach_result_metadata(
                    restored,
                    item=item_by_id[item_id],
                    context=context,
                    route_path=["block_level", "batched_plain"],
                    output_mode_path=["tagged"],
                )
            )
        except (
            ValueError,
            KeyError,
            json.JSONDecodeError,
            EnglishResidueError,
            EmptyTranslationError,
            MathDelimiterError,
            UnexpectedPlaceholderError,
            PlaceholderInventoryError,
            TranslationProtocolError,
            SuspiciousKeepOriginError,
        ):
            retry_items.append(item)
    return accepted, retry_items


def translate_items_plain_text(
    batch: list[dict],
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics: TranslationDiagnosticsCollector | None,
    single_item_translator,
    split_cached_batch_fn=split_cached_batch,
    store_cached_batch_fn=store_cached_batch,
    translate_batch_once_fn=translate_batch_once,
) -> dict[str, dict[str, str]]:
    batch = [item_with_runtime_hard_glossary(item, context.glossary_entries) for item in batch]
    cached_result, uncached_batch = split_cached_batch_fn(
        batch,
        model=model,
        base_url=base_url,
        domain_guidance=context.cache_guidance,
        mode=context.mode,
    )
    if request_label and cached_result:
        print(f"{request_label}: plain-text cache hit {len(cached_result)}/{len(batch)}", flush=True)

    valid_cached: dict[str, dict[str, str]] = {}
    validated_uncached = list(uncached_batch)
    for item in batch:
        item_id = item["item_id"]
        cached_item_result = cached_result.get(item_id)
        if not cached_item_result:
            continue
        try:
            canonical = canonicalize_batch_result([item], {item_id: cached_item_result})
            validate_batch_result([item], canonical, diagnostics=diagnostics)
            valid_cached.update(canonical)
        except (
            ValueError,
            KeyError,
            json.JSONDecodeError,
            EnglishResidueError,
            EmptyTranslationError,
            MathDelimiterError,
            UnexpectedPlaceholderError,
            PlaceholderInventoryError,
            TranslationProtocolError,
        ) as exc:
            validated_uncached.append(item)
            if request_label:
                print(f"{request_label}: dropped invalid cached translation for {item_id}: {type(exc).__name__}: {exc}", flush=True)

    merged = dict(valid_cached)
    uncached_batch = validated_uncached
    if not uncached_batch:
        return merged

    if should_use_direct_deepseek_batch(uncached_batch, model=model, base_url=base_url, context=context):
        try:
            if request_label:
                print(f"{request_label}: batched plain path items={len(uncached_batch)}", flush=True)
            result = translate_batch_once_fn(
                uncached_batch,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                domain_guidance=context.merged_guidance,
                mode=context.mode,
                diagnostics=diagnostics,
                timeout_s=context.timeout_policy.batch_plain_text_seconds,
            )
            restored_result: dict[str, dict[str, str]] = {}
            item_by_id = {item["item_id"]: item for item in uncached_batch}
            for item_id, payload in result.items():
                item_result = restore_runtime_term_tokens({item_id: payload}, item=item_by_id[item_id])
                restored_result.update(
                    attach_result_metadata(
                        item_result,
                        item=item_by_id[item_id],
                        context=context,
                        route_path=["block_level", "batched_plain"],
                        output_mode_path=["tagged"],
                    )
                )
            result = restored_result
            cacheable_batch = [item for item in uncached_batch if should_store_translation_result(result.get(item["item_id"], {}))]
            if cacheable_batch:
                store_cached_batch_fn(
                    cacheable_batch,
                    result,
                    model=model,
                    base_url=base_url,
                    domain_guidance=context.cache_guidance,
                    mode=context.mode,
                )
            merged.update(result)
            return merged
        except Exception as exc:
            if is_transport_error(exc):
                if diagnostics is not None:
                    for item in uncached_batch:
                        diagnostics.emit(
                            kind="batch_transport_single_retry",
                            item_id=str(item.get("item_id", "") or ""),
                            page_idx=item.get("page_idx"),
                            severity="warning",
                            message=f"Batched request transport failure, retry as single-item path: {type(exc).__name__}",
                            retryable=True,
                        )
                if request_label:
                    print(f"{request_label}: batched plain transport failure, fallback to single-item path: {type(exc).__name__}: {exc}", flush=True)
            if getattr(exc, "item_id", None) and isinstance(getattr(exc, "result", None), dict):
                partial_result = getattr(exc, "result", {}) or {}
                accepted_result, retry_batch = split_batched_plain_result_for_partial_retry(
                    uncached_batch,
                    partial_result,
                    context=context,
                    diagnostics=diagnostics,
                )
                if request_label:
                    print(f"{request_label}: batched plain partial fallback, keep={len(accepted_result)} retry_items={len(retry_batch)}", flush=True)
                cacheable_batch = [
                    item for item in uncached_batch
                    if item["item_id"] in accepted_result and should_store_translation_result(accepted_result.get(item["item_id"], {}))
                ]
                if cacheable_batch:
                    store_cached_batch_fn(
                        cacheable_batch,
                        accepted_result,
                        model=model,
                        base_url=base_url,
                        domain_guidance=context.cache_guidance,
                        mode=context.mode,
                    )
                merged.update(accepted_result)
                uncached_batch = retry_batch
                if not uncached_batch:
                    return merged
            if request_label:
                print(f"{request_label}: batched plain fallback to single-item path: {type(exc).__name__}: {exc}", flush=True)

    total_items = len(uncached_batch)
    deferred_transport_items: list[dict] = []
    for index, item in enumerate(uncached_batch, start=1):
        item_label = f"{request_label} item {index}/{total_items} {item['item_id']}" if request_label else ""
        try:
            result = single_item_translator(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=item_label,
                context=context,
                diagnostics=diagnostics,
                allow_transport_tail_defer=context.fallback_policy.transport_tail_retry_passes > 0,
            )
        except DeferredTransportRetry:
            deferred_transport_items.append(item)
            continue
        payload = result.get(item["item_id"], {})
        if should_store_translation_result(payload):
            store_cached_batch_fn(
                [item],
                result,
                model=model,
                base_url=base_url,
                domain_guidance=context.cache_guidance,
                mode=context.mode,
            )
        merged.update(result)

    if deferred_transport_items and context.fallback_policy.transport_tail_retry_passes > 0:
        tail_context = build_transport_tail_retry_context(context)
        if request_label:
            print(
                f"{request_label}: start transport tail retry pass items={len(deferred_transport_items)} timeout={tail_context.timeout_policy.plain_text_seconds}s",
                flush=True,
            )
        for index, item in enumerate(deferred_transport_items, start=1):
            item_label = f"{request_label} tail item {index}/{len(deferred_transport_items)} {item['item_id']}" if request_label else ""
            result = single_item_translator(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=item_label,
                context=tail_context,
                diagnostics=diagnostics,
                allow_transport_tail_defer=False,
            )
            result = mark_transport_result_dead_letter(
                result,
                item=item,
                context=tail_context,
                diagnostics=diagnostics,
            )
            payload = result.get(item["item_id"], {})
            if should_store_translation_result(payload):
                store_cached_batch_fn(
                    [item],
                    result,
                    model=model,
                    base_url=base_url,
                    domain_guidance=tail_context.cache_guidance,
                    mode=tail_context.mode,
                )
            merged.update(result)
    return merged
