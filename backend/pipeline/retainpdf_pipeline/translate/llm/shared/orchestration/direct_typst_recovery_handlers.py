from __future__ import annotations

import time

from retainpdf_pipeline.translate.llm.shared.orchestration.common import is_continuation_or_group_unit
from retainpdf_pipeline.translate.llm.shared.orchestration.common import looks_like_cjk_dominant_body_text
from retainpdf_pipeline.translate.llm.shared.orchestration.common import sentence_level_fallback_allowed
from retainpdf_pipeline.translate.llm.shared.orchestration.common import should_keep_origin_on_empty_translation
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_recovery_actions import is_named_validation_exception
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_recovery_actions import sentence_level_fallback_or_terminal_failure
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_recovery_actions import try_math_delimiter_repair
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_recovery_actions import try_protocol_shell_salvage
from retainpdf_pipeline.translate.llm.shared.orchestration.short_text_retry import translate_empty_short_text_retry
import retainpdf_pipeline.translate.llm.shared.orchestration.intentional_keep_origin as intentional_keep_origin
import retainpdf_pipeline.translate.llm.shared.orchestration.terminal_payloads as terminal_payloads
from retainpdf_pipeline.translate.llm.validation.english_residue import should_force_translate_body_text


def _direct_typst_validation_failure_payload(
    item: dict,
    *,
    context,
    route_path: list[str],
    degradation_reason: str,
    error_code: str,
) -> dict[str, dict[str, str]]:
    if should_force_translate_body_text(item):
        return terminal_payloads.translation_failed_payload_for_validation(
            item,
            context=context,
            route_path=route_path,
            degradation_reason=degradation_reason,
            error_code=error_code,
        )
    return intentional_keep_origin.keep_origin_payload_for_direct_typst_validation_failure(
        item,
        context=context,
        route_path=route_path,
        degradation_reason=degradation_reason,
        error_code=error_code,
    )


def handle_repeated_math_delimiter_error(
    item: dict,
    *,
    last_error: Exception,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics,
    route_prefix: list[str],
    allow_transport_tail_defer: bool,
    translate_plain,
    translate_unstructured,
    sentence_level_fallback_fn,
    repair_math_delimiters_fn,
    validate_batch_result_fn,
) -> tuple[dict[str, dict[str, str]], Exception]:
    repaired = try_math_delimiter_repair(
        item,
        exc=last_error,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        context=context,
        diagnostics=diagnostics,
        route_path=route_prefix + ["plain_text_raw", "typst_repair"],
        allow_transport_tail_defer=allow_transport_tail_defer,
        repair_math_delimiters_fn=repair_math_delimiters_fn,
        validate_batch_result_fn=validate_batch_result_fn,
        success_message="direct_typst raw math delimiter repaired successfully",
        failure_message="direct_typst raw math delimiter repair failed",
    )
    if repaired is not None:
        return repaired, last_error
    if should_force_translate_body_text(item) and sentence_level_fallback_allowed(item):
        return sentence_level_fallback_or_terminal_failure(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            route_path=route_prefix + ["validation", "sentence_level", "failed"],
            translate_plain=translate_plain,
            translate_unstructured=translate_unstructured,
            sentence_level_fallback_fn=sentence_level_fallback_fn,
            keep_origin_on_failure_fn=lambda fallback_item, *, context, route_path, **_kwargs: _direct_typst_validation_failure_payload(
                fallback_item,
                context=context,
                route_path=route_path,
                degradation_reason="math_delimiter_unbalanced",
                error_code="MATH_DELIMITER_UNBALANCED",
            ),
        ), last_error
    return _direct_typst_validation_failure_payload(
        item,
        context=context,
        route_path=route_prefix + ["failed"],
        degradation_reason="math_delimiter_unbalanced",
        error_code="MATH_DELIMITER_UNBALANCED",
    ), last_error


def handle_repeated_protocol_shell_error(
    item: dict,
    *,
    last_error: Exception,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics,
    route_prefix: list[str],
    translate_plain,
    translate_unstructured,
    sentence_level_fallback_fn,
    validate_batch_result_fn,
) -> tuple[dict[str, dict[str, str]], Exception]:
    salvaged = try_protocol_shell_salvage(
        item,
        exc=last_error,
        context=context,
        diagnostics=diagnostics,
        route_path=route_prefix + ["plain_text_raw", "protocol_shell_unwrap"],
        request_label=request_label,
        validate_batch_result_fn=validate_batch_result_fn,
    )
    if salvaged is not None:
        if request_label:
            print(f"{request_label}: direct_typst raw protocol shell salvaged successfully", flush=True)
        return salvaged, last_error
    if should_force_translate_body_text(item) and sentence_level_fallback_allowed(item):
        return sentence_level_fallback_or_terminal_failure(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            route_path=route_prefix + ["validation", "sentence_level", "failed"],
            translate_plain=translate_plain,
            translate_unstructured=translate_unstructured,
            sentence_level_fallback_fn=sentence_level_fallback_fn,
            keep_origin_on_failure_fn=lambda fallback_item, *, context, route_path, **_kwargs: _direct_typst_validation_failure_payload(
                fallback_item,
                context=context,
                route_path=route_path,
                degradation_reason="protocol_shell_repeated",
                error_code="PROTOCOL_SHELL",
            ),
        ), last_error
    reason = "protocol_shell_group_repeated" if is_continuation_or_group_unit(item) else "protocol_shell_repeated"
    if looks_like_cjk_dominant_body_text(item) or not should_force_translate_body_text(item):
        reason = "protocol_shell_repeated"
    return _direct_typst_validation_failure_payload(
        item,
        context=context,
        route_path=route_prefix + ["failed"],
        degradation_reason=reason,
        error_code="PROTOCOL_SHELL",
    ), last_error


def handle_raw_validation_failure(
    item: dict,
    *,
    raw_exc: Exception,
    raw_started: float,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics,
    route_prefix: list[str],
    allow_transport_tail_defer: bool,
    translate_plain,
    translate_unstructured,
    sentence_level_fallback_fn,
    repair_math_delimiters_fn,
    validate_batch_result_fn,
) -> tuple[dict[str, dict[str, str]] | None, Exception]:
    last_error = raw_exc
    if request_label:
        print(
            f"{request_label}: direct_typst raw plain-text failed after {time.perf_counter() - raw_started:.2f}s: {type(raw_exc).__name__}: {raw_exc}",
            flush=True,
        )
    if is_named_validation_exception(last_error, "EnglishResidueError"):
        return _direct_typst_validation_failure_payload(
            item,
            context=context,
            route_path=route_prefix + ["failed"],
            degradation_reason="english_residue_repeated",
            error_code="ENGLISH_RESIDUE",
        ), last_error
    if is_named_validation_exception(last_error, "MathDelimiterError"):
        return handle_repeated_math_delimiter_error(
            item,
            last_error=last_error,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            route_prefix=route_prefix,
            allow_transport_tail_defer=allow_transport_tail_defer,
            translate_plain=translate_plain,
            translate_unstructured=translate_unstructured,
            sentence_level_fallback_fn=sentence_level_fallback_fn,
            repair_math_delimiters_fn=repair_math_delimiters_fn,
            validate_batch_result_fn=validate_batch_result_fn,
        )
    if is_named_validation_exception(last_error, "TranslationProtocolError"):
        return handle_repeated_protocol_shell_error(
            item,
            last_error=last_error,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            route_prefix=route_prefix,
            translate_plain=translate_plain,
            translate_unstructured=translate_unstructured,
            sentence_level_fallback_fn=sentence_level_fallback_fn,
            validate_batch_result_fn=validate_batch_result_fn,
        )
    if is_named_validation_exception(last_error, "EmptyTranslationError"):
        if should_keep_origin_on_empty_translation(item) or not should_force_translate_body_text(item):
            return intentional_keep_origin.keep_origin_payload_for_direct_typst_validation_failure(
                item,
                context=context,
                route_path=route_prefix + ["keep_origin"],
                degradation_reason="empty_translation_repeated",
                error_code="EMPTY_TRANSLATION",
            ), last_error
        short_retry = translate_empty_short_text_retry(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            route_prefix=route_prefix + ["validation"],
            timeout_s=getattr(context.timeout_policy, "plain_text_seconds", 35),
            validate_batch_result_fn=validate_batch_result_fn,
        )
        if short_retry is not None:
            return short_retry, last_error
        if sentence_level_fallback_allowed(item):
            return sentence_level_fallback_or_terminal_failure(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                context=context,
                diagnostics=diagnostics,
                route_path=route_prefix + ["validation", "sentence_level", "failed"],
                translate_plain=translate_plain,
                translate_unstructured=translate_unstructured,
                sentence_level_fallback_fn=sentence_level_fallback_fn,
                keep_origin_on_failure_fn=lambda fallback_item, *, context, route_path, **_kwargs: _direct_typst_validation_failure_payload(
                    fallback_item,
                    context=context,
                    route_path=route_path,
                    degradation_reason="empty_translation_repeated",
                    error_code="EMPTY_TRANSLATION",
                ),
            ), last_error
        return _direct_typst_validation_failure_payload(
            item,
            context=context,
            route_path=route_prefix + ["failed"],
            degradation_reason="empty_translation_repeated",
            error_code="EMPTY_TRANSLATION",
        ), last_error
    return None, last_error
