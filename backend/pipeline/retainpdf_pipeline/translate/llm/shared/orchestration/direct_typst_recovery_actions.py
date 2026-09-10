from __future__ import annotations

import time

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.llm.shared.orchestration.common import is_continuation_or_group_unit
from retainpdf_pipeline.translate.llm.shared.orchestration.common import sentence_level_fallback_allowed
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import attach_result_metadata
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import restore_runtime_term_tokens
from retainpdf_pipeline.translate.llm.shared.orchestration.sentence_level import sentence_level_fallback
import retainpdf_pipeline.translate.llm.shared.orchestration.terminal_payloads as terminal_payloads
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_salvage import try_salvage_direct_typst_protocol_shell_error
from retainpdf_pipeline.translate.llm.shared.orchestration.transport import defer_transport_retry
from retainpdf_pipeline.translate.llm.shared.orchestration.transport import plain_text_timeout_seconds
from retainpdf_pipeline.translate.llm.validation.english_residue import should_force_translate_body_text


def is_named_validation_exception(exc: Exception, *names: str) -> bool:
    return type(exc).__name__ in set(names)


def sentence_level_fallback_or_terminal_failure(
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
    keep_origin_on_failure_fn=terminal_payloads.translation_failed_payload_for_transport,
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
                f"{request_label}: sentence-level fallback failed, mark failed: {type(sentence_exc).__name__}: {sentence_exc}",
                flush=True,
            )
        return keep_origin_on_failure_fn(
            item,
            context=context,
            route_path=route_path,
            degradation_reason="sentence_level_fallback_failed",
            error_code="SENTENCE_LEVEL_FALLBACK_FAILED",
        )


sentence_level_fallback_or_keep_origin = sentence_level_fallback_or_terminal_failure


def try_protocol_shell_salvage(
    item: dict,
    *,
    exc: Exception,
    context,
    diagnostics,
    route_path: list[str],
    request_label: str,
    validate_batch_result_fn,
) -> dict[str, dict[str, str]] | None:
    salvaged = try_salvage_direct_typst_protocol_shell_error(
        item,
        exc=exc,
        context=context,
        diagnostics=diagnostics,
        route_path=route_path,
        output_mode_path=["plain_text"],
        allow_partial_accept=is_continuation_or_group_unit(item),
        validate_batch_result_fn=validate_batch_result_fn,
    )
    if salvaged is not None and request_label:
        print(f"{request_label}: direct_typst protocol shell salvaged successfully", flush=True)
    return salvaged


def try_math_delimiter_repair(
    item: dict,
    *,
    exc: Exception,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics,
    route_path: list[str],
    allow_transport_tail_defer: bool,
    repair_math_delimiters_fn,
    validate_batch_result_fn,
    success_message: str,
    failure_message: str,
) -> dict[str, dict[str, str]] | None:
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
            route_path=route_path,
            output_mode_path=["plain_text"],
            # 修复调用要求模型重写整段,统一用 transport tail 档超时,
            # 避免长块修复反复踩 20s 超时。
            timeout_s=max(
                plain_text_timeout_seconds(item, context=context, transport_tail_retry=not allow_transport_tail_defer),
                int(getattr(context.timeout_policy, "transport_tail_retry_seconds", 0)),
            ),
            validate_batch_result_fn=validate_batch_result_fn,
        )
        if repaired is not None and request_label:
            print(f"{request_label}: {success_message}", flush=True)
        return repaired
    except Exception as repair_exc:
        if request_label:
            print(
                f"{request_label}: {failure_message}: {type(repair_exc).__name__}: {repair_exc}",
                flush=True,
            )
    return None


def try_raw_plain_text(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics,
    route_prefix: list[str],
    allow_transport_tail_defer: bool,
    translate_unstructured,
) -> tuple[dict[str, dict[str, str]], Exception | None]:
    raw_started = time.perf_counter()
    if request_label:
        print(f"{request_label}: direct_typst retrying with raw plain-text fallback", flush=True)
    result = translate_unstructured(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=f"{request_label} raw" if request_label else "",
        domain_guidance=context.prompt_system_guidance,
        mode=context.mode,
        target_language_name=context.target_language_name,
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
    ), None


def handle_raw_transport_failure(
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
) -> tuple[dict[str, dict[str, str]], Exception]:
    if request_label:
        print(
            f"{request_label}: direct_typst raw transport failure after {time.perf_counter() - raw_started:.2f}s, mark failed: {type(raw_exc).__name__}: {raw_exc}",
            flush=True,
        )
    if allow_transport_tail_defer:
        defer_transport_retry(
            item,
            route_path=route_prefix + ["plain_text_raw"],
            cause=raw_exc,
            request_label=request_label,
            diagnostics=diagnostics,
        )
    return terminal_payloads.translation_failed_payload_for_transport(
        item,
        context=context,
        route_path=route_prefix + ["plain_text_raw", "failed"],
        degradation_reason="transport_timeout_budget_exceeded",
        error_code="TRANSPORT_ERROR",
    ), raw_exc
