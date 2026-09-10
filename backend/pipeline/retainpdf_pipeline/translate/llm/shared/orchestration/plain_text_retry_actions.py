from __future__ import annotations

import time

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.llm.result_payload import result_entry
from retainpdf_pipeline.translate.llm.shared.control_context import TranslationControlContext
from retainpdf_pipeline.translate.llm.shared.orchestration.common import single_item_http_retry_attempts
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import attach_result_metadata
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import restore_runtime_term_tokens
from retainpdf_pipeline.translate.llm.shared.orchestration.plain_text_retry_runtime import PlainTextResult
from retainpdf_pipeline.translate.llm.shared.orchestration.plain_text_retry_runtime import PlainTextRetryRuntime
from retainpdf_pipeline.translate.llm.shared.orchestration.plain_text_validation import try_salvage_protocol_shell_error
from retainpdf_pipeline.translate.llm.validation.errors import TranslationProtocolError


def try_plain_text_request(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None,
    plain_timeout_s: int,
    route_prefix: list[str],
    attempt: int,
    plain_attempts: int,
    runtime: PlainTextRetryRuntime,
) -> PlainTextResult:
    if request_label:
        print(f"{request_label}: plain-text attempt {attempt}/{plain_attempts} item={item['item_id']}", flush=True)
    result = runtime.translate_plain_fn(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=f"{request_label} req#{attempt}" if request_label else "",
        domain_guidance=context.merged_guidance,
        mode=context.mode,
        target_language_name=context.target_language_name,
        diagnostics=diagnostics,
        timeout_s=plain_timeout_s,
        http_retry_attempts=single_item_http_retry_attempts(
            item,
            context=context,
            transport_tail_retry=False,
        ),
    )
    result = restore_runtime_term_tokens(result, item=item)
    return attach_result_metadata(
        result,
        item=item,
        context=context,
        route_path=route_prefix,
        output_mode_path=["plain_text"],
    )


def try_raw_plain_text_fallback(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None,
    plain_timeout_s: int,
    route_prefix: list[str],
    runtime: PlainTextRetryRuntime,
) -> PlainTextResult:
    raw_started = time.perf_counter()
    if request_label:
        print(f"{request_label}: retrying with raw plain-text single-item fallback", flush=True)
    result = runtime.translate_unstructured_fn(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=f"{request_label} raw" if request_label else "",
        domain_guidance=context.merged_guidance,
        mode=context.mode,
        target_language_name=context.target_language_name,
        diagnostics=diagnostics,
        timeout_s=plain_timeout_s,
        http_retry_attempts=single_item_http_retry_attempts(
            item,
            context=context,
            transport_tail_retry=False,
        ),
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


def try_protocol_shell_salvage(
    item: dict,
    *,
    exc: TranslationProtocolError,
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None,
    request_label: str,
    route_prefix: list[str],
    runtime: PlainTextRetryRuntime,
) -> PlainTextResult | None:
    salvaged = try_salvage_protocol_shell_error(
        item,
        exc=exc,
        context=context,
        diagnostics=diagnostics,
        route_path=route_prefix + ["protocol_shell_unwrap"],
        output_mode_path=["plain_text"],
        unwrap_translation_shell_fn=runtime.unwrap_translation_shell_fn,
        result_entry_fn=result_entry,
        canonicalize_batch_result_fn=runtime.canonicalize_batch_result_fn,
        validate_batch_result_fn=runtime.validate_batch_result_fn,
        restore_runtime_term_tokens_fn=restore_runtime_term_tokens,
        attach_result_metadata_fn=attach_result_metadata,
    )
    if salvaged is not None and request_label:
        print(f"{request_label}: protocol shell unwrapped successfully", flush=True)
    return salvaged
