from __future__ import annotations

from dataclasses import replace

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.llm.shared.orchestration.common import is_long_plain_text_item
import retainpdf_pipeline.translate.llm.shared.orchestration.terminal_payloads as terminal_payloads


class DeferredTransportRetry(Exception):
    def __init__(self, *, item: dict, route_path: list[str], cause: Exception) -> None:
        self.item = item
        self.route_path = list(route_path)
        self.cause = cause
        super().__init__(f"deferred transport retry for {item.get('item_id', '')}: {type(cause).__name__}: {cause}")


class DeferredValidationRetry(Exception):
    def __init__(self, *, item: dict, route_path: list[str], cause: Exception) -> None:
        self.item = item
        self.route_path = list(route_path)
        self.cause = cause
        super().__init__(f"deferred validation retry for {item.get('item_id', '')}: {type(cause).__name__}: {cause}")


def plain_text_timeout_seconds(
    item: dict,
    *,
    context,
    transport_tail_retry: bool = False,
) -> int:
    timeout_s = context.timeout_policy.plain_text_seconds
    if is_long_plain_text_item(item):
        timeout_s = max(timeout_s, context.timeout_policy.long_plain_text_seconds)
    if transport_tail_retry:
        timeout_s = max(timeout_s, context.timeout_policy.transport_tail_retry_seconds)
    return int(timeout_s)


def defer_transport_retry(
    item: dict,
    *,
    route_path: list[str],
    cause: Exception,
    request_label: str = "",
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> None:
    if diagnostics is not None:
        diagnostics.emit(
            kind="transport_tail_retry_deferred",
            item_id=str(item.get("item_id", "") or ""),
            page_idx=item.get("page_idx"),
            severity="warning",
            message=f"Deferred transport retry to tail pass: {type(cause).__name__}",
            retryable=True,
        )
    if request_label:
        print(
            f"{request_label}: transport failure deferred to tail retry queue: {type(cause).__name__}: {cause}",
            flush=True,
        )
    raise DeferredTransportRetry(item=item, route_path=route_path, cause=cause)


def defer_validation_retry(
    item: dict,
    *,
    route_path: list[str],
    cause: Exception,
    request_label: str = "",
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> None:
    if diagnostics is not None:
        diagnostics.emit(
            kind="validation_tail_retry_deferred",
            item_id=str(item.get("item_id", "") or ""),
            page_idx=item.get("page_idx"),
            severity="warning",
            message=f"Deferred validation retry to tail pass: {type(cause).__name__}",
            retryable=True,
        )
    if request_label:
        print(
            f"{request_label}: validation failure deferred to tail queue: {type(cause).__name__}: {cause}",
            flush=True,
        )
    raise DeferredValidationRetry(item=item, route_path=route_path, cause=cause)


def build_transport_tail_retry_context(context):
    return replace(
        context,
        fallback_policy=replace(
            context.fallback_policy,
            plain_text_attempts=max(context.fallback_policy.plain_text_attempts, 3),
            main_http_retry_attempts=max(
                context.fallback_policy.main_http_retry_attempts,
                context.fallback_policy.tail_http_retry_attempts,
            ),
        ),
        timeout_policy=replace(
            context.timeout_policy,
            plain_text_seconds=max(
                context.timeout_policy.plain_text_seconds,
                context.timeout_policy.transport_tail_retry_seconds,
            ),
        ),
    )


def mark_transport_result_dead_letter(
    result: dict[str, dict[str, str]],
    *,
    item: dict,
    context,
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> dict[str, dict[str, str]]:
    item_id = str(item.get("item_id", "") or "")
    payload = dict(result.get(item_id, {}) or {})
    translation_diagnostics = dict(payload.get("translation_diagnostics") or {})
    error_trace = list(translation_diagnostics.get("error_trace") or [])
    has_transport_error = any(str((entry or {}).get("type", "") or "") == "transport" for entry in error_trace)
    if not has_transport_error:
        return result
    route_path = list(translation_diagnostics.get("route_path") or ["block_level", "plain_text"])
    if "dlq" not in route_path:
        route_path.append("dlq")
    degraded = terminal_payloads.translation_failed_payload_for_transport(
        item,
        context=context,
        route_path=route_path,
        degradation_reason="transport_retry_queue_exhausted",
        error_code=str((error_trace[-1] or {}).get("code", "") or "TRANSPORT_ERROR"),
        fallback_to="dead_letter_queue",
        dead_letter=True,
    )
    if diagnostics is not None:
        diagnostics.emit(
            kind="transport_dead_lettered",
            item_id=item_id,
            page_idx=item.get("page_idx"),
            severity="error",
            message="Transport retry queue exhausted; item moved to DLQ",
            retryable=False,
        )
    return degraded
