from __future__ import annotations

import json
import time

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.llm.validation.errors import EmptyTranslationError
from retainpdf_pipeline.translate.llm.validation.errors import EnglishResidueError
from retainpdf_pipeline.translate.llm.validation.errors import MathDelimiterError
from retainpdf_pipeline.translate.llm.validation.errors import PlaceholderInventoryError
from retainpdf_pipeline.translate.llm.validation.errors import SuspiciousKeepOriginError
from retainpdf_pipeline.translate.llm.validation.errors import TranslationProtocolError
from retainpdf_pipeline.translate.llm.validation.errors import UnexpectedPlaceholderError
from retainpdf_pipeline.translate.llm.placeholder_transform import has_formula_placeholders
from retainpdf_pipeline.translate.llm.shared.control_context import TranslationControlContext
from retainpdf_pipeline.translate.llm.shared.orchestration.plain_text_retry_actions import try_plain_text_request as _try_plain_text_request
from retainpdf_pipeline.translate.llm.shared.orchestration.plain_text_retry_actions import try_protocol_shell_salvage as _try_protocol_shell_salvage
from retainpdf_pipeline.translate.llm.shared.orchestration.plain_text_retry_actions import try_raw_plain_text_fallback as _try_raw_plain_text_fallback
from retainpdf_pipeline.translate.llm.shared.orchestration.plain_text_retry_finalize import finalize_plain_text_failure as _finalize_plain_text_failure
from retainpdf_pipeline.translate.llm.shared.orchestration.plain_text_retry_runtime import PlainTextResult
from retainpdf_pipeline.translate.llm.shared.orchestration.plain_text_retry_runtime import PlainTextRetryRuntime
from retainpdf_pipeline.translate.llm.shared.orchestration.transport import defer_transport_retry
from retainpdf_pipeline.translate.llm.shared.orchestration.transport import defer_validation_retry
import retainpdf_pipeline.translate.llm.shared.orchestration.terminal_payloads as terminal_payloads

_PLAIN_VALIDATION_ERRORS = (
    UnexpectedPlaceholderError,
    PlaceholderInventoryError,
    EmptyTranslationError,
    EnglishResidueError,
    MathDelimiterError,
    TranslationProtocolError,
)
_RAW_FALLBACK_ERRORS = (
    EmptyTranslationError,
    EnglishResidueError,
    MathDelimiterError,
    TranslationProtocolError,
)
_PARSE_ERRORS = (ValueError, KeyError, json.JSONDecodeError)

def run_plain_text_attempts(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None,
    allow_transport_tail_defer: bool,
    plain_timeout_s: int,
    route_prefix: list[str],
    runtime: PlainTextRetryRuntime,
) -> PlainTextResult:
    plain_attempts = context.fallback_policy.plain_text_attempts
    last_error: Exception | None = None
    for attempt in range(1, plain_attempts + 1):
        started = time.perf_counter()
        try:
            result = _try_plain_text_request(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                context=context,
                diagnostics=diagnostics,
                plain_timeout_s=plain_timeout_s,
                route_prefix=route_prefix,
                attempt=attempt,
                plain_attempts=plain_attempts,
                runtime=runtime,
            )
            if request_label:
                print(f"{request_label}: plain-text ok in {time.perf_counter() - started:.2f}s", flush=True)
            return result
        except _PLAIN_VALIDATION_ERRORS as exc:
            last_error = exc
            if request_label:
                print(
                    f"{request_label}: plain-text placeholder failed attempt {attempt}/{plain_attempts} after {time.perf_counter() - started:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
                runtime.log_placeholder_failure_fn(request_label, item, exc, diagnostics=diagnostics)
            if allow_transport_tail_defer and _defer_validation_retry_enabled():
                defer_validation_retry(
                    item,
                    route_path=route_prefix + ["validation"],
                    cause=exc,
                    request_label=request_label,
                    diagnostics=diagnostics,
                )
            if isinstance(exc, TranslationProtocolError):
                salvaged = _try_protocol_shell_salvage(
                    item,
                    exc=exc,
                    context=context,
                    diagnostics=diagnostics,
                    request_label=request_label,
                    route_prefix=route_prefix,
                    runtime=runtime,
                )
                if salvaged is not None:
                    return salvaged
            if has_formula_placeholders(item) and context.fallback_policy.allow_tagged_placeholder_retry:
                tagged_started = time.perf_counter()
                try:
                    if request_label:
                        print(f"{request_label}: retrying with tagged single-item format for placeholder stability", flush=True)
                    return runtime.tagged_placeholder_path_fn(
                        item,
                        api_key=api_key,
                        model=model,
                        base_url=base_url,
                        request_label=request_label,
                        context=context,
                        diagnostics=diagnostics,
                        route_path=route_prefix + ["tagged_placeholder_retry"],
                        allow_transport_tail_defer=allow_transport_tail_defer,
                        label_suffix="tagged",
                        attach_metadata=False,
                        handle_transport_error=False,
                    )
                except _PARSE_ERRORS as tagged_exc:
                    last_error = tagged_exc
                    if request_label:
                        print(
                            f"{request_label}: tagged single-item failed attempt {attempt}/{plain_attempts} after {time.perf_counter() - tagged_started:.2f}s: {type(tagged_exc).__name__}: {tagged_exc}",
                            flush=True,
                        )
            if attempt >= plain_attempts and isinstance(last_error, _RAW_FALLBACK_ERRORS):
                raw_started = time.perf_counter()
                try:
                    return _try_raw_plain_text_fallback(
                        item,
                        api_key=api_key,
                        model=model,
                        base_url=base_url,
                        request_label=request_label,
                        context=context,
                        diagnostics=diagnostics,
                        plain_timeout_s=plain_timeout_s,
                        route_prefix=route_prefix,
                        runtime=runtime,
                    )
                except (_PARSE_ERRORS + _RAW_FALLBACK_ERRORS) as raw_exc:
                    last_error = raw_exc
                    if request_label:
                        print(
                            f"{request_label}: raw plain-text single-item failed after {time.perf_counter() - raw_started:.2f}s: {type(raw_exc).__name__}: {raw_exc}",
                            flush=True,
                        )
            if attempt >= plain_attempts:
                final_degraded = _finalize_plain_text_failure(
                    item,
                    last_error=last_error,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    context=context,
                    diagnostics=diagnostics,
                    request_label=request_label,
                    route_prefix=route_prefix,
                    allow_transport_tail_defer=allow_transport_tail_defer,
                    runtime=runtime,
                )
                if final_degraded is not None:
                    if isinstance(last_error, (UnexpectedPlaceholderError, PlaceholderInventoryError)) and request_label:
                        runtime.log_placeholder_failure_fn(request_label, item, last_error, diagnostics=diagnostics)
                    return final_degraded
                raise last_error
            time.sleep(min(8, 2 * attempt))
        except SuspiciousKeepOriginError as exc:
            last_error = exc
            if request_label:
                print(f"{request_label}: unexpected keep_origin after {time.perf_counter() - started:.2f}s: {type(exc).__name__}: {exc}", flush=True)
            if attempt >= plain_attempts:
                raise
            time.sleep(min(8, 2 * attempt))
        except _PARSE_ERRORS as exc:
            last_error = exc
            if request_label:
                print(
                    f"{request_label}: plain-text parse failed attempt {attempt}/{plain_attempts} after {time.perf_counter() - started:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if attempt >= plain_attempts:
                raise
            time.sleep(min(8, 2 * attempt))
        except Exception as exc:
            if not runtime.is_transport_error_fn(exc):
                raise
            last_error = exc
            if diagnostics is not None:
                diagnostics.emit(
                    kind="transport_degraded",
                    item_id=str(item.get("item_id", "") or ""),
                    page_idx=item.get("page_idx"),
                    severity="warning",
                    message=f"Marked failed after transport failure: {type(exc).__name__}",
                    retryable=True,
                )
            if request_label:
                print(
                    f"{request_label}: transport failure after {time.perf_counter() - started:.2f}s, mark failed: {type(exc).__name__}: {exc}",
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
            return terminal_payloads.translation_failed_payload_for_transport(
                item,
                context=context,
                route_path=["block_level", "plain_text", "failed"],
                degradation_reason="transport_timeout_budget_exceeded",
                error_code="TRANSPORT_ERROR",
            )

    if last_error is not None:
        raise last_error
    raise RuntimeError("Plain-text translation failed without an exception.")


def _defer_validation_retry_enabled() -> bool:
    return True
