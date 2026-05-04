from __future__ import annotations

import json
import time

from services.translation.diagnostics import TranslationDiagnosticsCollector
from services.translation.llm.placeholder_guard import validate_batch_result
from services.translation.llm.shared.orchestration.common import is_continuation_or_group_unit
from services.translation.llm.shared.orchestration.common import looks_like_cjk_dominant_body_text
from services.translation.llm.shared.orchestration.common import sentence_level_fallback_allowed
from services.translation.llm.shared.orchestration.common import should_keep_origin_on_empty_translation
from services.translation.llm.shared.orchestration.direct_typst_long_text import should_split_direct_typst_long_text
from services.translation.llm.shared.orchestration.direct_typst_long_text import translate_direct_typst_long_text_chunks
from services.translation.llm.shared.orchestration.direct_typst_repair import try_repair_direct_typst_math_delimiters
from services.translation.llm.shared.orchestration.direct_typst_salvage import try_salvage_direct_typst_protocol_shell_error
from services.translation.llm.shared.orchestration.keep_origin import keep_origin_payload_for_direct_typst_validation_failure
from services.translation.llm.shared.orchestration.keep_origin import keep_origin_payload_for_transport_error
from services.translation.llm.shared.orchestration.metadata import attach_result_metadata
from services.translation.llm.shared.orchestration.metadata import restore_runtime_term_tokens
from services.translation.llm.shared.orchestration.sentence_level import sentence_level_fallback
from services.translation.llm.shared.orchestration.transport import defer_transport_retry
from services.translation.llm.shared.orchestration.transport import plain_text_timeout_seconds
from services.translation.llm.shared.provider_runtime import is_transport_error
from services.translation.llm.shared.provider_runtime import translate_single_item_plain_text
from services.translation.llm.shared.provider_runtime import translate_single_item_plain_text_unstructured
from services.translation.llm.placeholder_guard import should_force_translate_body_text


def _is_named_validation_exception(exc: Exception, *names: str) -> bool:
    return type(exc).__name__ in set(names)


def _sentence_level_fallback_or_keep_origin(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics: TranslationDiagnosticsCollector | None,
    route_path: list[str],
    translate_plain,
    translate_unstructured,
    sentence_level_fallback_fn,
    keep_origin_on_failure_fn=keep_origin_payload_for_transport_error,
) -> dict[str, dict[str, str]]:
    try:
        fallback_impl = sentence_level_fallback_fn or sentence_level_fallback
        return fallback_impl(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            translate_plain_fn=translate_plain,
            translate_unstructured_fn=translate_unstructured,
        )
    except Exception as sentence_exc:
        if request_label:
            print(
                f"{request_label}: sentence-level fallback failed, degrade to keep_origin: {type(sentence_exc).__name__}: {sentence_exc}",
                flush=True,
            )
        return keep_origin_on_failure_fn(
            item,
            context=context,
            route_path=route_path,
        )


def _handle_direct_typst_validation_failure(
    item: dict,
    *,
    exc: Exception,
    route_prefix: list[str],
    request_label: str,
    context,
    diagnostics,
    validate_batch_result_fn,
    allow_transport_tail_defer: bool,
    translate_plain,
    translate_unstructured,
    sentence_level_fallback_fn,
    repair_math_delimiters_fn,
    api_key: str,
    model: str,
    base_url: str,
) -> tuple[dict[str, dict[str, str]] | None, Exception]:
    last_error = exc
    if request_label:
        print(
            f"{request_label}: direct_typst plain-text failed: {type(exc).__name__}: {exc}",
            flush=True,
        )
    if _is_named_validation_exception(exc, "TranslationProtocolError"):
        salvaged = try_salvage_direct_typst_protocol_shell_error(
            item,
            exc=exc,
            context=context,
            diagnostics=diagnostics,
            route_path=route_prefix + ["protocol_shell_unwrap"],
            output_mode_path=["plain_text"],
            allow_partial_accept=is_continuation_or_group_unit(item),
            validate_batch_result_fn=validate_batch_result_fn,
        )
        if salvaged is not None:
            if request_label:
                print(f"{request_label}: direct_typst protocol shell salvaged successfully", flush=True)
            return salvaged, last_error
    if _is_named_validation_exception(exc, "MathDelimiterError"):
        try:
            repaired = repair_math_delimiters_fn(
                item,
                exc=exc,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                context=context,
                diagnostics=diagnostics,
                route_path=route_prefix + ["typst_repair"],
                output_mode_path=["plain_text"],
                timeout_s=plain_text_timeout_seconds(item, context=context, transport_tail_retry=not allow_transport_tail_defer),
                validate_batch_result_fn=validate_batch_result_fn,
            )
            if repaired is not None:
                if request_label:
                    print(f"{request_label}: direct_typst math delimiter repaired successfully", flush=True)
                return repaired, last_error
        except Exception as repair_exc:
            if request_label:
                print(
                    f"{request_label}: direct_typst math delimiter repair failed: {type(repair_exc).__name__}: {repair_exc}",
                    flush=True,
                )

    raw_started = time.perf_counter()
    try:
        if request_label:
            print(f"{request_label}: direct_typst retrying with raw plain-text fallback", flush=True)
        result = translate_unstructured(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=f"{request_label} raw" if request_label else "",
            domain_guidance=context.merged_guidance,
            mode=context.mode,
            diagnostics=diagnostics,
            timeout_s=plain_text_timeout_seconds(item, context=context, transport_tail_retry=not allow_transport_tail_defer),
        )
        result = restore_runtime_term_tokens(result, item=item)
        if request_label:
            print(f"{request_label}: direct_typst raw plain-text ok in {time.perf_counter() - raw_started:.2f}s", flush=True)
        return attach_result_metadata(
            result,
            item=item,
            context=context,
            route_path=route_prefix + ["plain_text_raw"],
            output_mode_path=["plain_text"],
        ), last_error
    except Exception as raw_exc:
        if not _is_named_validation_exception(
            raw_exc,
            "EmptyTranslationError",
            "EnglishResidueError",
            "MathDelimiterError",
            "TranslationProtocolError",
        ):
            if not is_transport_error(raw_exc):
                raise
            if request_label:
                print(
                    f"{request_label}: direct_typst raw transport failure after {time.perf_counter() - raw_started:.2f}s, degrade to keep_origin: {type(raw_exc).__name__}: {raw_exc}",
                    flush=True,
                )
            if should_force_translate_body_text(item) and sentence_level_fallback_allowed(item):
                return _sentence_level_fallback_or_keep_origin(
                    item,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    request_label=request_label,
                    context=context,
                    diagnostics=diagnostics,
                    route_path=route_prefix + ["plain_text_raw", "keep_origin"],
                    translate_plain=translate_plain,
                    translate_unstructured=translate_unstructured,
                    sentence_level_fallback_fn=sentence_level_fallback_fn,
                ), raw_exc
            if allow_transport_tail_defer:
                defer_transport_retry(
                    item,
                    route_path=route_prefix + ["plain_text_raw"],
                    cause=raw_exc,
                    request_label=request_label,
                    diagnostics=diagnostics,
                )
            return keep_origin_payload_for_transport_error(
                item,
                context=context,
                route_path=route_prefix + ["plain_text_raw", "keep_origin"],
            ), raw_exc

        last_error = raw_exc
        if request_label:
            print(
                f"{request_label}: direct_typst raw plain-text failed after {time.perf_counter() - raw_started:.2f}s: {type(raw_exc).__name__}: {raw_exc}",
                flush=True,
            )
        if _is_named_validation_exception(last_error, "EnglishResidueError"):
            return keep_origin_payload_for_direct_typst_validation_failure(
                item,
                context=context,
                route_path=route_prefix + ["keep_origin"],
                degradation_reason="english_residue_repeated",
                error_code="ENGLISH_RESIDUE",
            ), last_error
        if _is_named_validation_exception(last_error, "MathDelimiterError"):
            try:
                repaired = repair_math_delimiters_fn(
                    item,
                    exc=last_error,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    request_label=request_label,
                    context=context,
                    diagnostics=diagnostics,
                    route_path=route_prefix + ["plain_text_raw", "typst_repair"],
                    output_mode_path=["plain_text"],
                    timeout_s=plain_text_timeout_seconds(item, context=context, transport_tail_retry=not allow_transport_tail_defer),
                    validate_batch_result_fn=validate_batch_result_fn,
                )
                if repaired is not None:
                    if request_label:
                        print(f"{request_label}: direct_typst raw math delimiter repaired successfully", flush=True)
                    return repaired, last_error
            except Exception as repair_exc:
                if request_label:
                    print(
                        f"{request_label}: direct_typst raw math delimiter repair failed: {type(repair_exc).__name__}: {repair_exc}",
                        flush=True,
                    )
            if should_force_translate_body_text(item) and sentence_level_fallback_allowed(item):
                return _sentence_level_fallback_or_keep_origin(
                    item,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    request_label=request_label,
                    context=context,
                    diagnostics=diagnostics,
                    route_path=route_prefix + ["validation", "sentence_level", "keep_origin"],
                    translate_plain=translate_plain,
                    translate_unstructured=translate_unstructured,
                    sentence_level_fallback_fn=sentence_level_fallback_fn,
                    keep_origin_on_failure_fn=lambda fallback_item, *, context, route_path: keep_origin_payload_for_direct_typst_validation_failure(
                        fallback_item,
                        context=context,
                        route_path=route_path,
                        degradation_reason="math_delimiter_unbalanced",
                        error_code="MATH_DELIMITER_UNBALANCED",
                    ),
                ), last_error
            return keep_origin_payload_for_direct_typst_validation_failure(
                item,
                context=context,
                route_path=route_prefix + ["keep_origin"],
                degradation_reason="math_delimiter_unbalanced",
                error_code="MATH_DELIMITER_UNBALANCED",
            ), last_error
        if _is_named_validation_exception(last_error, "TranslationProtocolError"):
            salvaged = try_salvage_direct_typst_protocol_shell_error(
                item,
                exc=last_error,
                context=context,
                diagnostics=diagnostics,
                route_path=route_prefix + ["plain_text_raw", "protocol_shell_unwrap"],
                output_mode_path=["plain_text"],
                allow_partial_accept=is_continuation_or_group_unit(item),
                validate_batch_result_fn=validate_batch_result_fn,
            )
            if salvaged is not None:
                if request_label:
                    print(f"{request_label}: direct_typst raw protocol shell salvaged successfully", flush=True)
                return salvaged, last_error
            if should_force_translate_body_text(item) and sentence_level_fallback_allowed(item):
                return _sentence_level_fallback_or_keep_origin(
                    item,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    request_label=request_label,
                    context=context,
                    diagnostics=diagnostics,
                    route_path=route_prefix + ["validation", "sentence_level", "keep_origin"],
                    translate_plain=translate_plain,
                    translate_unstructured=translate_unstructured,
                    sentence_level_fallback_fn=sentence_level_fallback_fn,
                    keep_origin_on_failure_fn=lambda fallback_item, *, context, route_path: keep_origin_payload_for_direct_typst_validation_failure(
                        fallback_item,
                        context=context,
                        route_path=route_path,
                        degradation_reason="protocol_shell_repeated",
                        error_code="PROTOCOL_SHELL",
                    ),
                ), last_error
            if looks_like_cjk_dominant_body_text(item) or not should_force_translate_body_text(item):
                return keep_origin_payload_for_direct_typst_validation_failure(
                    item,
                    context=context,
                    route_path=route_prefix + ["keep_origin"],
                    degradation_reason="protocol_shell_repeated",
                    error_code="PROTOCOL_SHELL",
                ), last_error
            if is_continuation_or_group_unit(item):
                return keep_origin_payload_for_direct_typst_validation_failure(
                    item,
                    context=context,
                    route_path=route_prefix + ["keep_origin"],
                    degradation_reason="protocol_shell_group_repeated",
                    error_code="PROTOCOL_SHELL",
                ), last_error
            return keep_origin_payload_for_direct_typst_validation_failure(
                item,
                context=context,
                route_path=route_prefix + ["keep_origin"],
                degradation_reason="protocol_shell_repeated",
                error_code="PROTOCOL_SHELL",
            ), last_error
        if _is_named_validation_exception(last_error, "EmptyTranslationError"):
            if should_keep_origin_on_empty_translation(item) or not should_force_translate_body_text(item):
                return keep_origin_payload_for_direct_typst_validation_failure(
                    item,
                    context=context,
                    route_path=route_prefix + ["keep_origin"],
                    degradation_reason="empty_translation_repeated",
                    error_code="EMPTY_TRANSLATION",
                ), last_error
            raise last_error
        return None, last_error


def translate_direct_typst_plain_text_with_retries(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics: TranslationDiagnosticsCollector | None,
    allow_transport_tail_defer: bool = False,
    translator,
    translate_plain_fn=None,
    translate_unstructured_fn=None,
    sentence_level_fallback_fn=None,
    repair_math_delimiters_fn=try_repair_direct_typst_math_delimiters,
    validate_batch_result_fn=validate_batch_result,
) -> dict[str, dict[str, str]]:
    translate_plain = translate_plain_fn or translate_single_item_plain_text
    translate_unstructured = translate_unstructured_fn or translate_single_item_plain_text_unstructured

    if should_split_direct_typst_long_text(item):
        if request_label:
            print(f"{request_label}: direct_typst long-text split before remote translation", flush=True)
        split_result = translate_direct_typst_long_text_chunks(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            translator=translator,
        )
        if split_result is not None:
            return attach_result_metadata(
                restore_runtime_term_tokens(split_result, item=item),
                item=item,
                context=context,
                route_path=["block_level", "direct_typst", "long_text_split"],
                output_mode_path=["plain_text"],
                degradation_reason=split_result[item["item_id"]]
                .get("translation_diagnostics", {})
                .get("degradation_reason", "direct_typst_long_text_split"),
            )

    plain_attempts = context.fallback_policy.plain_text_attempts
    plain_timeout_s = plain_text_timeout_seconds(
        item,
        context=context,
        transport_tail_retry=not allow_transport_tail_defer,
    )
    route_prefix = ["block_level", "direct_typst"]
    last_error: Exception | None = None

    for attempt in range(1, plain_attempts + 1):
        started = time.perf_counter()
        try:
            if request_label:
                print(
                    f"{request_label}: direct_typst plain-text attempt {attempt}/{plain_attempts} item={item['item_id']}",
                    flush=True,
                )
            result = translate_plain(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=f"{request_label} req#{attempt}" if request_label else "",
                domain_guidance=context.merged_guidance,
                mode=context.mode,
                diagnostics=diagnostics,
                timeout_s=plain_timeout_s,
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
                print(f"{request_label}: direct_typst plain-text ok in {time.perf_counter() - started:.2f}s", flush=True)
            return result
        except Exception as exc:
            if not _is_named_validation_exception(
                exc,
                "EmptyTranslationError",
                "EnglishResidueError",
                "MathDelimiterError",
                "TranslationProtocolError",
            ):
                if isinstance(exc, (ValueError, KeyError, json.JSONDecodeError)):
                    last_error = exc
                    if request_label:
                        print(
                            f"{request_label}: direct_typst plain-text parse failed attempt {attempt}/{plain_attempts} after {time.perf_counter() - started:.2f}s: {type(exc).__name__}: {exc}",
                            flush=True,
                        )
                    if attempt >= plain_attempts:
                        raise
                    time.sleep(min(8, 2 * attempt))
                    continue
                if not is_transport_error(exc):
                    raise
                last_error = exc
                if request_label:
                    print(
                        f"{request_label}: direct_typst transport failure after {time.perf_counter() - started:.2f}s, degrade to keep_origin: {type(exc).__name__}: {exc}",
                        flush=True,
                    )
                if should_force_translate_body_text(item) and sentence_level_fallback_allowed(item):
                    return _sentence_level_fallback_or_keep_origin(
                        item,
                        api_key=api_key,
                        model=model,
                        base_url=base_url,
                        request_label=request_label,
                        context=context,
                        diagnostics=diagnostics,
                        route_path=route_prefix + ["keep_origin"],
                        translate_plain=translate_plain,
                        translate_unstructured=translate_unstructured,
                        sentence_level_fallback_fn=sentence_level_fallback_fn,
                    )
                if allow_transport_tail_defer:
                    defer_transport_retry(
                        item,
                        route_path=route_prefix,
                        cause=exc,
                        request_label=request_label,
                        diagnostics=diagnostics,
                    )
                return keep_origin_payload_for_transport_error(
                    item,
                    context=context,
                    route_path=route_prefix + ["keep_origin"],
                )

            last_error = exc
            if request_label:
                print(
                    f"{request_label}: direct_typst plain-text failed attempt {attempt}/{plain_attempts} after {time.perf_counter() - started:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if attempt < plain_attempts:
                if _is_named_validation_exception(exc, "TranslationProtocolError"):
                    salvaged = try_salvage_direct_typst_protocol_shell_error(
                        item,
                        exc=exc,
                        context=context,
                        diagnostics=diagnostics,
                        route_path=route_prefix + ["protocol_shell_unwrap"],
                        output_mode_path=["plain_text"],
                        allow_partial_accept=is_continuation_or_group_unit(item),
                        validate_batch_result_fn=validate_batch_result_fn,
                    )
                    if salvaged is not None:
                        if request_label:
                            print(f"{request_label}: direct_typst protocol shell salvaged successfully", flush=True)
                        return salvaged
                if _is_named_validation_exception(exc, "MathDelimiterError"):
                    try:
                        repaired = repair_math_delimiters_fn(
                            item,
                            exc=exc,
                            api_key=api_key,
                            model=model,
                            base_url=base_url,
                            request_label=request_label,
                            context=context,
                            diagnostics=diagnostics,
                            route_path=route_prefix + ["typst_repair"],
                            output_mode_path=["plain_text"],
                            timeout_s=plain_timeout_s,
                            validate_batch_result_fn=validate_batch_result_fn,
                        )
                        if repaired is not None:
                            if request_label:
                                print(f"{request_label}: direct_typst math delimiter repaired successfully", flush=True)
                            return repaired
                    except Exception as repair_exc:
                        if request_label:
                            print(
                                f"{request_label}: direct_typst math delimiter repair failed attempt {attempt}/{plain_attempts}: {type(repair_exc).__name__}: {repair_exc}",
                                flush=True,
                            )
                time.sleep(min(8, 2 * attempt))
                continue

            handled_result, last_error = _handle_direct_typst_validation_failure(
                item,
                exc=exc,
                route_prefix=route_prefix,
                request_label=request_label,
                context=context,
                diagnostics=diagnostics,
                validate_batch_result_fn=validate_batch_result_fn,
                allow_transport_tail_defer=allow_transport_tail_defer,
                translate_plain=translate_plain,
                translate_unstructured=translate_unstructured,
                sentence_level_fallback_fn=sentence_level_fallback_fn,
                repair_math_delimiters_fn=repair_math_delimiters_fn,
                api_key=api_key,
                model=model,
                base_url=base_url,
            )
            if handled_result is not None:
                return handled_result

    if last_error is not None:
        raise last_error
    raise RuntimeError("Direct Typst plain-text translation failed without an exception.")
