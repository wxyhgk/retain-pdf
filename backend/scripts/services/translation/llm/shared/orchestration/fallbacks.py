from __future__ import annotations

import json
import time

from services.translation.diagnostics import TranslationDiagnosticsCollector
from services.translation.llm.placeholder_guard import EmptyTranslationError
from services.translation.llm.placeholder_guard import EnglishResidueError
from services.translation.llm.placeholder_guard import MathDelimiterError
from services.translation.llm.placeholder_guard import PlaceholderInventoryError
from services.translation.llm.placeholder_guard import SuspiciousKeepOriginError
from services.translation.llm.placeholder_guard import TranslationProtocolError
from services.translation.llm.placeholder_guard import UnexpectedPlaceholderError
from services.translation.llm.placeholder_guard import canonicalize_batch_result
from services.translation.llm.placeholder_guard import has_formula_placeholders
from services.translation.llm.placeholder_guard import is_direct_math_mode
from services.translation.llm.placeholder_guard import item_with_placeholder_aliases
from services.translation.llm.placeholder_guard import item_with_runtime_hard_glossary
from services.translation.llm.placeholder_guard import log_placeholder_failure
from services.translation.llm.placeholder_guard import placeholder_alias_maps
from services.translation.llm.placeholder_guard import placeholder_sequence
from services.translation.llm.placeholder_guard import placeholder_stability_guidance
from services.translation.llm.placeholder_guard import restore_placeholder_aliases
from services.translation.llm.placeholder_guard import result_entry
from services.translation.llm.placeholder_guard import should_force_translate_body_text
from services.translation.llm.placeholder_guard import validate_batch_result
from services.translation.llm.shared.cache import split_cached_batch
from services.translation.llm.shared.cache import store_cached_batch
from services.translation.llm.shared.orchestration.batched_plain import translate_items_plain_text as _translate_items_plain_text
from services.translation.llm.shared.control_context import TranslationControlContext
from services.translation.llm.shared.orchestration.common import is_continuation_or_group_unit
from services.translation.llm.shared.orchestration.common import sentence_level_fallback_allowed
from services.translation.llm.shared.orchestration.common import should_keep_origin_on_empty_translation
from services.translation.llm.shared.orchestration.common import should_keep_origin_on_protocol_shell
from services.translation.llm.shared.orchestration.common import should_prefer_tagged_placeholder_first
from services.translation.llm.shared.orchestration.common import single_item_http_retry_attempts
from services.translation.llm.shared.orchestration.common import zh_char_count
from services.translation.llm.shared.orchestration.direct_typst import translate_direct_typst_plain_text_with_retries
from services.translation.llm.shared.orchestration.heavy_formula import heavy_formula_split_reason
from services.translation.llm.shared.orchestration.heavy_formula import translate_heavy_formula_block
from services.translation.llm.shared.orchestration.keep_origin import keep_origin_payload_for_empty_translation
from services.translation.llm.shared.orchestration.keep_origin import keep_origin_payload_for_repeated_empty_translation
from services.translation.llm.shared.orchestration.keep_origin import keep_origin_payload_for_transport_error
from services.translation.llm.shared.orchestration.keep_origin import keep_origin_payload_for_validation
from services.translation.llm.shared.orchestration.metadata import attach_result_metadata
from services.translation.llm.shared.orchestration.metadata import formula_route_diagnostics
from services.translation.llm.shared.orchestration.metadata import restore_runtime_term_tokens
from services.translation.llm.shared.orchestration.plain_text_validation import finalize_plain_text_validation_failure
from services.translation.llm.shared.orchestration.plain_text_validation import try_salvage_partial_english_residue
from services.translation.llm.shared.orchestration.plain_text_validation import try_salvage_protocol_shell_error
from services.translation.llm.shared.orchestration.segment_routing import formula_segment_translation_route
from services.translation.llm.shared.orchestration.segment_routing import translate_single_item_formula_segment_text_with_retries
from services.translation.llm.shared.orchestration.sentence_level import sentence_level_fallback
from services.translation.llm.shared.orchestration.transport import DeferredTransportRetry
from services.translation.llm.shared.orchestration.transport import defer_transport_retry
from services.translation.llm.shared.orchestration.transport import plain_text_timeout_seconds
from services.translation.llm.shared.provider_runtime import DEFAULT_BASE_URL
from services.translation.llm.shared.provider_runtime import DEFAULT_MODEL
from services.translation.llm.shared.provider_runtime import is_transport_error
from services.translation.llm.shared.provider_runtime import translate_batch_once
from services.translation.llm.shared.provider_runtime import translate_single_item_plain_text
from services.translation.llm.shared.provider_runtime import translate_single_item_plain_text_unstructured
from services.translation.llm.shared.provider_runtime import translate_single_item_tagged_text
from services.translation.llm.shared.provider_runtime import unwrap_translation_shell

_sentence_level_fallback = sentence_level_fallback
_keep_origin_payload_for_empty_translation = keep_origin_payload_for_empty_translation
_keep_origin_payload_for_repeated_empty_translation = keep_origin_payload_for_repeated_empty_translation
_keep_origin_payload_for_transport_error = keep_origin_payload_for_transport_error
_should_keep_origin_on_empty_translation = should_keep_origin_on_empty_translation
_heavy_formula_split_reason = heavy_formula_split_reason


def translate_single_item_stable_placeholder_text(
    item: dict,
    *,
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    request_label: str = "",
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> dict[str, dict[str, str]]:
    item = item_with_runtime_hard_glossary(item, context.glossary_entries)
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
        timeout_s=plain_text_timeout_seconds(item, context=context),
        http_retry_attempts=single_item_http_retry_attempts(item),
    )
    restored = restore_placeholder_aliases(result, alias_to_original)
    restored = restore_runtime_term_tokens(restored, item=item)
    restored = canonicalize_batch_result([item], restored)
    restored = attach_result_metadata(
        restored,
        item=item,
        context=context,
        route_path=["block_level"],
        output_mode_path=["tagged"],
    )
    validate_batch_result([item], restored, diagnostics=diagnostics)
    return restored


def translate_single_item_plain_text_with_retries(
    item: dict,
    *,
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    request_label: str = "",
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None = None,
    allow_transport_tail_defer: bool = False,
) -> dict[str, dict[str, str]]:
    item = item_with_runtime_hard_glossary(item, context.glossary_entries)
    if is_direct_math_mode(item):
        return _translate_direct_typst_plain_text_with_retries(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            allow_transport_tail_defer=allow_transport_tail_defer,
        )

    if not item.get("_heavy_formula_split_applied"):
        split_reason = heavy_formula_split_reason(item, context=context)
        if split_reason:
            if request_label:
                print(f"{request_label}: split heavy formula block before formula routing reason={split_reason}", flush=True)
            split_result = translate_heavy_formula_block(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                context=context,
                diagnostics=diagnostics,
                split_reason=split_reason,
                translate_single_item_fn=translate_single_item_plain_text_with_retries,
                deferred_transport_retry_type=DeferredTransportRetry,
            )
            if split_result is not None:
                return attach_result_metadata(
                    restore_runtime_term_tokens(split_result, item=item),
                    item=item,
                    context=context,
                    route_path=["block_level", "heavy_formula_split"],
                    output_mode_path=["plain_text"],
                    degradation_reason=split_reason,
                )

    formula_route = formula_segment_translation_route(item, policy=context.segmentation_policy)
    plain_attempts = context.fallback_policy.plain_text_attempts
    plain_timeout_s = plain_text_timeout_seconds(
        item,
        context=context,
        transport_tail_retry=not allow_transport_tail_defer,
    )
    route_prefix = ["block_level"]

    if formula_route == "single":
        try:
            segmented_result = translate_single_item_formula_segment_text_with_retries(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                domain_guidance=context.merged_guidance,
                policy=context.segmentation_policy,
                diagnostics=diagnostics,
                attempt_limit=context.fallback_policy.formula_segment_attempts,
                timeout_s=context.timeout_policy.formula_segment_seconds,
            )
            return attach_result_metadata(
                restore_runtime_term_tokens(segmented_result, item=item),
                item=item,
                context=context,
                route_path=["block_level", "segmented"],
                output_mode_path=["tagged"],
            )
        except Exception as exc:
            if is_transport_error(exc):
                if request_label:
                    print(
                        f"{request_label}: formula route transport failure, degrade to keep_origin: {type(exc).__name__}: {exc}",
                        flush=True,
                    )
                if allow_transport_tail_defer:
                    defer_transport_retry(
                        item,
                        route_path=["block_level", "segmented"],
                        cause=exc,
                        request_label=request_label,
                        diagnostics=diagnostics,
                    )
                return keep_origin_payload_for_transport_error(
                    item,
                    context=context,
                    route_path=["block_level", "segmented", "keep_origin"],
                )
            if request_label:
                print(
                    f"{request_label}: segmented-formula route failed, fallback to plain-text path: {type(exc).__name__}: {exc}",
                    flush=True,
                )

    if should_prefer_tagged_placeholder_first(
        item,
        allow_tagged_placeholder_retry=context.fallback_policy.allow_tagged_placeholder_retry,
    ):
        tagged_started = time.perf_counter()
        try:
            if request_label:
                print(f"{request_label}: direct tagged single-item path for placeholder stability", flush=True)
            result = translate_single_item_stable_placeholder_text(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=f"{request_label} tagged-first" if request_label else "",
                context=context,
                diagnostics=diagnostics,
            )
            if request_label:
                print(f"{request_label}: tagged-first single-item ok in {time.perf_counter() - tagged_started:.2f}s", flush=True)
            return attach_result_metadata(
                restore_runtime_term_tokens(result, item=item),
                item=item,
                context=context,
                route_path=route_prefix + ["tagged_placeholder_first"],
                output_mode_path=["tagged"],
            )
        except Exception as exc:
            if is_transport_error(exc):
                if request_label:
                    print(
                        f"{request_label}: tagged-first transport failure after {time.perf_counter() - tagged_started:.2f}s, degrade to keep_origin: {type(exc).__name__}: {exc}",
                        flush=True,
                    )
                if allow_transport_tail_defer:
                    defer_transport_retry(
                        item,
                        route_path=route_prefix + ["tagged_placeholder_first"],
                        cause=exc,
                        request_label=request_label,
                        diagnostics=diagnostics,
                    )
                return keep_origin_payload_for_transport_error(
                    item,
                    context=context,
                    route_path=route_prefix + ["tagged_placeholder_first", "keep_origin"],
                )
            if request_label:
                print(
                    f"{request_label}: tagged-first path failed after {time.perf_counter() - tagged_started:.2f}s, fallback to plain-text path: {type(exc).__name__}: {exc}",
                    flush=True,
                )

    last_error: Exception | None = None
    for attempt in range(1, plain_attempts + 1):
        started = time.perf_counter()
        try:
            if request_label:
                print(f"{request_label}: plain-text attempt {attempt}/{plain_attempts} item={item['item_id']}", flush=True)
            result = translate_single_item_plain_text(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=f"{request_label} req#{attempt}" if request_label else "",
                domain_guidance=context.merged_guidance,
                mode=context.mode,
                diagnostics=diagnostics,
                timeout_s=plain_timeout_s,
                http_retry_attempts=single_item_http_retry_attempts(item),
            )
            result = restore_runtime_term_tokens(result, item=item)
            result = attach_result_metadata(
                result,
                item=item,
                context=context,
                route_path=route_prefix,
                output_mode_path=["plain_text"],
            )
            if request_label:
                print(f"{request_label}: plain-text ok in {time.perf_counter() - started:.2f}s", flush=True)
            return result
        except (
            UnexpectedPlaceholderError,
            PlaceholderInventoryError,
            EmptyTranslationError,
            EnglishResidueError,
            MathDelimiterError,
            TranslationProtocolError,
        ) as exc:
            last_error = exc
            if request_label:
                print(
                    f"{request_label}: plain-text placeholder failed attempt {attempt}/{plain_attempts} after {time.perf_counter() - started:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
                log_placeholder_failure(request_label, item, exc, diagnostics=diagnostics)
            if isinstance(exc, TranslationProtocolError):
                salvaged = try_salvage_protocol_shell_error(
                    item,
                    exc=exc,
                    context=context,
                    diagnostics=diagnostics,
                    route_path=route_prefix + ["protocol_shell_unwrap"],
                    output_mode_path=["plain_text"],
                    unwrap_translation_shell_fn=unwrap_translation_shell,
                    result_entry_fn=result_entry,
                    canonicalize_batch_result_fn=canonicalize_batch_result,
                    validate_batch_result_fn=validate_batch_result,
                    restore_runtime_term_tokens_fn=restore_runtime_term_tokens,
                    attach_result_metadata_fn=attach_result_metadata,
                )
                if salvaged is not None:
                    if request_label:
                        print(f"{request_label}: protocol shell unwrapped successfully", flush=True)
                    return salvaged
            if has_formula_placeholders(item) and context.fallback_policy.allow_tagged_placeholder_retry:
                tagged_started = time.perf_counter()
                try:
                    if request_label:
                        print(f"{request_label}: retrying with tagged single-item format for placeholder stability", flush=True)
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
                        print(f"{request_label}: tagged single-item ok in {time.perf_counter() - tagged_started:.2f}s", flush=True)
                    return result
                except (ValueError, KeyError, json.JSONDecodeError) as tagged_exc:
                    last_error = tagged_exc
                    if request_label:
                        print(
                            f"{request_label}: tagged single-item failed attempt {attempt}/{plain_attempts} after {time.perf_counter() - tagged_started:.2f}s: {type(tagged_exc).__name__}: {tagged_exc}",
                            flush=True,
                        )
            if attempt >= plain_attempts and isinstance(last_error, (EmptyTranslationError, EnglishResidueError, MathDelimiterError, TranslationProtocolError)):
                raw_started = time.perf_counter()
                try:
                    if request_label:
                        print(f"{request_label}: retrying with raw plain-text single-item fallback", flush=True)
                    result = translate_single_item_plain_text_unstructured(
                        item,
                        api_key=api_key,
                        model=model,
                        base_url=base_url,
                        request_label=f"{request_label} raw" if request_label else "",
                        domain_guidance=context.merged_guidance,
                        mode=context.mode,
                        diagnostics=diagnostics,
                        timeout_s=plain_timeout_s,
                        http_retry_attempts=single_item_http_retry_attempts(item),
                    )
                    if request_label:
                        print(f"{request_label}: raw plain-text single-item ok in {time.perf_counter() - raw_started:.2f}s", flush=True)
                    return attach_result_metadata(
                        result,
                        item=item,
                        context=context,
                        route_path=route_prefix + ["plain_text_raw"],
                        output_mode_path=["plain_text"],
                    )
                except (
                    ValueError,
                    KeyError,
                    json.JSONDecodeError,
                    EnglishResidueError,
                    EmptyTranslationError,
                    MathDelimiterError,
                    TranslationProtocolError,
                ) as raw_exc:
                    last_error = raw_exc
                    if request_label:
                        print(
                            f"{request_label}: raw plain-text single-item failed after {time.perf_counter() - raw_started:.2f}s: {type(raw_exc).__name__}: {raw_exc}",
                            flush=True,
                        )
            if attempt >= plain_attempts:
                if isinstance(last_error, EmptyTranslationError) and should_keep_origin_on_empty_translation(item):
                    if request_label:
                        print(f"{request_label}: degraded to keep_origin for short non-body empty translation", flush=True)
                    return keep_origin_payload_for_empty_translation(item)
                if sentence_level_fallback_allowed(item):
                    try:
                        return _sentence_level_fallback(
                            item,
                            api_key=api_key,
                            model=model,
                            base_url=base_url,
                            request_label=request_label,
                            context=context,
                            diagnostics=diagnostics,
                            translate_plain_fn=translate_single_item_plain_text,
                            translate_unstructured_fn=translate_single_item_plain_text_unstructured,
                        )
                    except Exception as sentence_exc:
                        if request_label:
                            print(f"{request_label}: sentence-level fallback failed: {type(sentence_exc).__name__}: {sentence_exc}", flush=True)
                        if is_transport_error(sentence_exc):
                            if allow_transport_tail_defer:
                                defer_transport_retry(
                                    item,
                                    route_path=["block_level", "sentence_level"],
                                    cause=sentence_exc,
                                    request_label=request_label,
                                    diagnostics=diagnostics,
                                )
                            return keep_origin_payload_for_transport_error(
                                item,
                                context=context,
                                route_path=["block_level", "sentence_level", "keep_origin"],
                            )
                elif request_label:
                    print(f"{request_label}: skip sentence-level fallback for continuation/group unit", flush=True)

                final_degraded = finalize_plain_text_validation_failure(
                    item,
                    last_error=last_error,
                    context=context,
                    diagnostics=diagnostics,
                    request_label=request_label,
                    route_prefix=route_prefix,
                    should_keep_origin_on_protocol_shell_fn=should_keep_origin_on_protocol_shell,
                    should_force_translate_body_text_fn=should_force_translate_body_text,
                    has_formula_placeholders_fn=has_formula_placeholders,
                    try_salvage_partial_english_residue_fn=lambda inner_item, *, exc, context: try_salvage_partial_english_residue(
                        inner_item,
                        exc=exc,
                        context=context,
                        zh_char_count_fn=zh_char_count,
                        is_direct_math_mode_fn=is_direct_math_mode,
                        is_continuation_or_group_unit_fn=is_continuation_or_group_unit,
                        has_formula_placeholders_fn=has_formula_placeholders,
                        canonicalize_batch_result_fn=canonicalize_batch_result,
                        result_entry_fn=result_entry,
                        restore_runtime_term_tokens_fn=restore_runtime_term_tokens,
                        attach_result_metadata_fn=attach_result_metadata,
                    ),
                )
                if final_degraded is not None:
                    if isinstance(last_error, (UnexpectedPlaceholderError, PlaceholderInventoryError)) and request_label:
                        log_placeholder_failure(request_label, item, last_error, diagnostics=diagnostics)
                    return final_degraded
                raise last_error
            time.sleep(min(8, 2 * attempt))
        except SuspiciousKeepOriginError as exc:
            last_error = exc
            if request_label:
                print(f"{request_label}: unexpected keep_origin after {time.perf_counter() - started:.2f}s: {type(exc).__name__}: {exc}", flush=True)
            if attempt >= context.fallback_policy.plain_text_attempts:
                raise
            time.sleep(min(8, 2 * attempt))
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            last_error = exc
            if request_label:
                print(
                    f"{request_label}: plain-text parse failed attempt {attempt}/{context.fallback_policy.plain_text_attempts} after {time.perf_counter() - started:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if attempt >= context.fallback_policy.plain_text_attempts:
                raise
            time.sleep(min(8, 2 * attempt))
        except Exception as exc:
            if not is_transport_error(exc):
                raise
            last_error = exc
            if diagnostics is not None:
                diagnostics.emit(
                    kind="transport_degraded",
                    item_id=str(item.get("item_id", "") or ""),
                    page_idx=item.get("page_idx"),
                    severity="warning",
                    message=f"Degraded to keep_origin after transport failure: {type(exc).__name__}",
                    retryable=True,
                )
            if request_label:
                print(
                    f"{request_label}: transport failure after {time.perf_counter() - started:.2f}s, degrade to keep_origin: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if allow_transport_tail_defer:
                defer_transport_retry(
                    item,
                    route_path=["block_level", "plain_text"],
                    cause=exc,
                    request_label=request_label,
                    diagnostics=diagnostics,
                )
            return keep_origin_payload_for_transport_error(
                item,
                context=context,
                route_path=["block_level", "plain_text", "keep_origin"],
            )

    if last_error is not None:
        raise last_error
    raise RuntimeError("Plain-text translation failed without an exception.")


def translate_items_plain_text(
    batch: list[dict],
    *,
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    request_label: str = "",
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> dict[str, dict[str, str]]:
    return _translate_items_plain_text(
        batch,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        context=context,
        diagnostics=diagnostics,
        single_item_translator=translate_single_item_plain_text_with_retries,
        split_cached_batch_fn=split_cached_batch,
        store_cached_batch_fn=store_cached_batch,
        translate_batch_once_fn=translate_batch_once,
    )


def _translate_direct_typst_plain_text_with_retries(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None,
    allow_transport_tail_defer: bool = False,
) -> dict[str, dict[str, str]]:
    return translate_direct_typst_plain_text_with_retries(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        context=context,
        diagnostics=diagnostics,
        allow_transport_tail_defer=allow_transport_tail_defer,
        translator=translate_single_item_plain_text_with_retries,
        translate_plain_fn=translate_single_item_plain_text,
        translate_unstructured_fn=translate_single_item_plain_text_unstructured,
        sentence_level_fallback_fn=_sentence_level_fallback,
        validate_batch_result_fn=validate_batch_result,
    )
