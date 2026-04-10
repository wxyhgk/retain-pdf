from __future__ import annotations

import json
import time

from services.document_schema.semantics import is_body_structure_role
from services.translation.diagnostics import classify_provider_family
from services.translation.diagnostics import TranslationDiagnosticsCollector
from services.translation.llm.cache import split_cached_batch
from services.translation.llm.cache import store_cached_batch
from services.translation.llm.control_context import TranslationControlContext
from services.translation.llm.placeholder_guard import PlaceholderInventoryError
from services.translation.llm.placeholder_guard import SuspiciousKeepOriginError
from services.translation.llm.placeholder_guard import UnexpectedPlaceholderError
from services.translation.llm.placeholder_guard import canonicalize_batch_result
from services.translation.llm.placeholder_guard import has_formula_placeholders
from services.translation.llm.placeholder_guard import internal_keep_origin_result
from services.translation.llm.placeholder_guard import is_internal_placeholder_degraded
from services.translation.llm.placeholder_guard import item_with_placeholder_aliases
from services.translation.llm.placeholder_guard import log_placeholder_failure
from services.translation.llm.placeholder_guard import placeholder_alias_maps
from services.translation.llm.placeholder_guard import placeholder_sequence
from services.translation.llm.placeholder_guard import placeholder_stability_guidance
from services.translation.llm.placeholder_guard import restore_placeholder_aliases
from services.translation.llm.placeholder_guard import should_force_translate_body_text
from services.translation.llm.placeholder_guard import validate_batch_result
from services.translation.llm.segment_routing import formula_segment_translation_route
from services.translation.llm.segment_routing import translate_single_item_formula_segment_text_with_retries
from services.translation.llm.segment_routing import translate_single_item_formula_segment_windows_with_retries
from services.translation.llm.translation_client import translate_batch_once
from services.translation.llm.translation_client import translate_single_item_plain_text
from services.translation.llm.translation_client import translate_single_item_tagged_text


def translate_single_item_stable_placeholder_text(
    item: dict,
    *,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> dict[str, dict[str, str]]:
    original_to_alias, alias_to_original = placeholder_alias_maps(item)
    aliased_item = item_with_placeholder_aliases(item, original_to_alias)
    aliased_sequence = placeholder_sequence(
        aliased_item.get("translation_unit_protected_source_text")
        or aliased_item.get("group_protected_source_text")
        or aliased_item.get("protected_source_text")
        or aliased_item.get("source_text")
        or ""
    )
    stability_guidance = placeholder_stability_guidance(aliased_item, aliased_sequence)
    merged_guidance = "\n\n".join(part for part in [context.merged_guidance, stability_guidance.strip()] if part)
    result = translate_single_item_tagged_text(
        aliased_item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        domain_guidance=merged_guidance,
        diagnostics=diagnostics,
    )
    restored = restore_placeholder_aliases(result, alias_to_original)
    restored = canonicalize_batch_result([item], restored)
    validate_batch_result([item], restored, diagnostics=diagnostics)
    return restored


def translate_single_item_plain_text_with_retries(
    item: dict,
    *,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> dict[str, dict[str, str]]:
    formula_route = formula_segment_translation_route(item, policy=context.segmentation_policy)
    if formula_route == "single":
        try:
            return translate_single_item_formula_segment_text_with_retries(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                domain_guidance=context.merged_guidance,
                policy=context.segmentation_policy,
                diagnostics=diagnostics,
            )
        except Exception as exc:
            if request_label:
                print(
                    f"{request_label}: segmented-formula route failed, fallback to plain-text path: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            try:
                return translate_single_item_formula_segment_windows_with_retries(
                    item,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    request_label=request_label,
                    domain_guidance=context.merged_guidance,
                    policy=context.segmentation_policy,
                    diagnostics=diagnostics,
                )
            except Exception as windowed_exc:
                if request_label:
                    print(
                        f"{request_label}: windowed-formula fallback failed, continue to plain-text path: {type(windowed_exc).__name__}: {windowed_exc}",
                        flush=True,
                    )
    elif formula_route == "windowed":
        try:
            return translate_single_item_formula_segment_windows_with_retries(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                domain_guidance=context.merged_guidance,
                policy=context.segmentation_policy,
                diagnostics=diagnostics,
            )
        except Exception as exc:
            if request_label:
                print(
                    f"{request_label}: windowed-formula route failed, fallback to plain-text path: {type(exc).__name__}: {exc}",
                    flush=True,
                )
    last_error: Exception | None = None
    for attempt in range(1, context.fallback_policy.plain_text_attempts + 1):
        started = time.perf_counter()
        try:
            if request_label:
                print(
                    f"{request_label}: plain-text attempt {attempt}/{context.fallback_policy.plain_text_attempts} item={item['item_id']}",
                    flush=True,
                )
            result = translate_single_item_plain_text(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=f"{request_label} req#{attempt}" if request_label else "",
                domain_guidance=context.merged_guidance,
                mode=context.mode,
                diagnostics=diagnostics,
            )
            if request_label:
                elapsed = time.perf_counter() - started
                print(f"{request_label}: plain-text ok in {elapsed:.2f}s", flush=True)
            return result
        except (UnexpectedPlaceholderError, PlaceholderInventoryError) as exc:
            last_error = exc
            elapsed = time.perf_counter() - started
            if request_label:
                print(
                    f"{request_label}: plain-text placeholder failed attempt {attempt}/{context.fallback_policy.plain_text_attempts} after {elapsed:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
                log_placeholder_failure(request_label, item, exc, diagnostics=diagnostics)
            if has_formula_placeholders(item) and context.fallback_policy.allow_tagged_placeholder_retry:
                tagged_started = time.perf_counter()
                try:
                    if request_label:
                        print(
                            f"{request_label}: retrying with tagged single-item format for placeholder stability",
                            flush=True,
                        )
                    result = translate_single_item_stable_placeholder_text(
                        item,
                        api_key=api_key,
                        model=model,
                        base_url=base_url,
                        request_label=f"{request_label} tagged" if request_label else "",
                        context=context,
                        diagnostics=diagnostics,
                    )
                    if request_label:
                        tagged_elapsed = time.perf_counter() - tagged_started
                        print(f"{request_label}: tagged single-item ok in {tagged_elapsed:.2f}s", flush=True)
                    return result
                except (ValueError, KeyError, json.JSONDecodeError) as tagged_exc:
                    last_error = tagged_exc
                    if request_label:
                        tagged_elapsed = time.perf_counter() - tagged_started
                        print(
                            f"{request_label}: tagged single-item failed attempt {attempt}/{context.fallback_policy.plain_text_attempts} after {tagged_elapsed:.2f}s: {type(tagged_exc).__name__}: {tagged_exc}",
                            flush=True,
                        )
            if attempt >= context.fallback_policy.plain_text_attempts:
                if has_formula_placeholders(item) and context.fallback_policy.allow_keep_origin_degradation:
                    if diagnostics is not None:
                        diagnostics.emit(
                            kind="placeholder_unstable",
                            item_id=str(item.get("item_id", "") or ""),
                            page_idx=item.get("page_idx"),
                            severity="warning",
                            message="Degraded to keep_origin after repeated placeholder instability",
                            retryable=True,
                        )
                    if request_label:
                        print(f"{request_label}: degraded to keep_origin after repeated placeholder instability", flush=True)
                        log_placeholder_failure(request_label, item, exc, diagnostics=diagnostics)
                    return {item["item_id"]: internal_keep_origin_result("placeholder_unstable")}
                raise last_error
            time.sleep(min(8, 2 * attempt))
        except SuspiciousKeepOriginError as exc:
            last_error = exc
            if request_label:
                elapsed = time.perf_counter() - started
                print(f"{request_label}: unexpected keep_origin after {elapsed:.2f}s: {type(exc).__name__}: {exc}", flush=True)
            if attempt >= context.fallback_policy.plain_text_attempts:
                raise
            time.sleep(min(8, 2 * attempt))
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            last_error = exc
            if request_label:
                elapsed = time.perf_counter() - started
                print(
                    f"{request_label}: plain-text parse failed attempt {attempt}/{context.fallback_policy.plain_text_attempts} after {elapsed:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if attempt >= context.fallback_policy.plain_text_attempts:
                raise
            time.sleep(min(8, 2 * attempt))

    if last_error is not None:
        raise last_error
    raise RuntimeError("Plain-text translation failed without an exception.")


def translate_items_plain_text(
    batch: list[dict],
    *,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> dict[str, dict[str, str]]:
    cached_result, uncached_batch = split_cached_batch(
        batch,
        model=model,
        base_url=base_url,
        domain_guidance=context.merged_guidance,
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
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            validated_uncached.append(item)
            if request_label:
                print(
                    f"{request_label}: dropped invalid cached translation for {item_id}: {type(exc).__name__}: {exc}",
                    flush=True,
                )
    merged = dict(valid_cached)
    uncached_batch = validated_uncached
    if not uncached_batch:
        return merged
    if _should_use_direct_deepseek_batch(uncached_batch, model=model, base_url=base_url):
        try:
            if request_label:
                print(f"{request_label}: deepseek direct-batch path items={len(uncached_batch)}", flush=True)
            result = translate_batch_once(
                uncached_batch,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                domain_guidance=context.merged_guidance,
                mode=context.mode,
                diagnostics=diagnostics,
            )
            store_cached_batch(
                uncached_batch,
                result,
                model=model,
                base_url=base_url,
                domain_guidance=context.merged_guidance,
                mode=context.mode,
            )
            merged.update(result)
            return merged
        except Exception as exc:
            if request_label:
                print(
                    f"{request_label}: deepseek direct-batch fallback to single-item path: {type(exc).__name__}: {exc}",
                    flush=True,
                )
    total_items = len(uncached_batch)
    for index, item in enumerate(uncached_batch, start=1):
        item_label = f"{request_label} item {index}/{total_items} {item['item_id']}" if request_label else ""
        result = translate_single_item_plain_text_with_retries(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=item_label,
            context=context,
            diagnostics=diagnostics,
        )
        payload = result.get(item["item_id"], {})
        if not is_internal_placeholder_degraded(payload):
            store_cached_batch(
                [item],
                result,
                model=model,
                base_url=base_url,
                domain_guidance=context.merged_guidance,
                mode=context.mode,
            )
        merged.update(result)
    return merged


def _should_use_direct_deepseek_batch(batch: list[dict], *, model: str, base_url: str) -> bool:
    if len(batch) <= 1:
        return False
    if classify_provider_family(base_url=base_url, model=model) != "deepseek_official":
        return False
    return all(_is_low_risk_deepseek_batch_item(item) for item in batch)


def _is_low_risk_deepseek_batch_item(item: dict) -> bool:
    if str(item.get("block_type", "") or "") != "text":
        return False
    if not is_body_structure_role(item.get("metadata", {}) or {}):
        return False
    if item.get("continuation_group"):
        return False
    if item.get("formula_map") or item.get("translation_unit_formula_map"):
        return False
    if not should_force_translate_body_text(item):
        return False
    source_text = str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or "").strip()
    if not source_text:
        return False
    compact_len = len(source_text)
    if compact_len < 40 or compact_len > 1200:
        return False
    return True
