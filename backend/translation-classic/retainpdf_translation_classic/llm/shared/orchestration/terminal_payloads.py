from __future__ import annotations

import retainpdf_translation.llm.result_payload as result_payload
from retainpdf_translation.llm.shared.upstream_resilience import CONTENT_REJECTED_REASON
from retainpdf_translation.llm.shared.upstream_resilience import upstream_rejection


def _normalized_failed_route(route_path: list[str]) -> list[str]:
    return ["failed" if str(part or "") == "keep_origin" else part for part in route_path]


def _formula_route_diagnostics(item: dict, *, context=None) -> dict[str, object]:
    from retainpdf_translation_classic.llm.shared.orchestration.metadata import formula_route_diagnostics

    return formula_route_diagnostics(item, context=context)


def intentional_keep_origin_payload(
    item: dict,
    *,
    context=None,
    route_path: list[str],
    degradation_reason: str,
    error_taxonomy: str,
    error_trace: list[dict[str, object]],
    fallback_to: str = "keep_origin",
    dead_letter: bool | None = None,
) -> dict[str, dict[str, str]]:
    payload = result_payload.result_entry("keep_origin", "")
    payload["final_status"] = "kept_origin"
    payload["error_taxonomy"] = error_taxonomy
    diagnostics = {
        "item_id": item.get("item_id", ""),
        "page_idx": item.get("page_idx"),
        "route_path": route_path,
        "error_trace": error_trace,
        "fallback_to": fallback_to,
        "degradation_reason": degradation_reason,
        "final_status": "kept_origin",
        **_formula_route_diagnostics(item, context=context),
    }
    if dead_letter is not None:
        diagnostics["dead_letter"] = bool(dead_letter)
    payload["translation_diagnostics"] = diagnostics
    return {str(item.get("item_id", "") or ""): payload}


def translation_failed_payload(
    item: dict,
    *,
    context=None,
    route_path: list[str],
    degradation_reason: str,
    error_taxonomy: str,
    error_trace: list[dict[str, object]],
    fallback_to: str = "retry_required",
    dead_letter: bool | None = None,
) -> dict[str, dict[str, str]]:
    payload = result_payload.result_entry("translate", "")
    payload["final_status"] = "failed"
    payload["error_taxonomy"] = error_taxonomy
    diagnostics = {
        "item_id": item.get("item_id", ""),
        "page_idx": item.get("page_idx"),
        "route_path": _normalized_failed_route(route_path),
        "error_trace": error_trace,
        "fallback_to": fallback_to,
        "degradation_reason": degradation_reason,
        "final_status": "failed",
        **_formula_route_diagnostics(item, context=context),
    }
    if dead_letter is not None:
        diagnostics["dead_letter"] = bool(dead_letter)
    payload["translation_diagnostics"] = diagnostics
    return {str(item.get("item_id", "") or ""): payload}


def translation_failed_payload_for_validation(
    item: dict,
    *,
    context=None,
    route_path: list[str],
    degradation_reason: str,
    error_code: str,
    fallback_to: str = "retry_required",
) -> dict[str, dict[str, str]]:
    trace = [{"type": "validation"}]
    if error_code:
        trace[0]["code"] = error_code
    return translation_failed_payload(
        item,
        context=context,
        route_path=route_path,
        degradation_reason=degradation_reason,
        error_taxonomy="validation",
        error_trace=trace,
        fallback_to=fallback_to,
    )


def translation_failed_payload_for_transport(
    item: dict,
    *,
    context=None,
    route_path: list[str],
    degradation_reason: str,
    error_code: str,
    fallback_to: str = "retry_required",
    dead_letter: bool | None = None,
) -> dict[str, dict[str, str]]:
    return translation_failed_payload(
        item,
        context=context,
        route_path=route_path,
        degradation_reason=degradation_reason,
        error_taxonomy="transport",
        error_trace=[{"type": "transport", "code": error_code}],
        fallback_to=fallback_to,
        dead_letter=dead_letter,
    )


def content_rejected_payload(
    item: dict,
    *,
    exc: BaseException,
    context=None,
    route_path: list[str] | None = None,
) -> dict[str, dict[str, str]]:
    """服务商内容审核没过：这一块保留原文（死信，不阻断导出，完成时算进「N 个块保留原文未翻译」），不重试。
    错误轨迹记服务商、状态码和业务码，不记原文、不记响应体。"""
    rejection = upstream_rejection(exc)
    trace: dict[str, object] = {"type": "content_policy", "code": rejection.code if rejection is not None else "content_rejected"}
    if rejection is not None:
        trace["provider"] = rejection.provider
        trace["http_status"] = rejection.http_status
        trace["message"] = f"内容审核未过：{rejection.describe()}"
    else:
        trace["message"] = "内容审核未过"
    return translation_failed_payload(
        item,
        context=context,
        route_path=list(route_path or ["block_level"]) + ["content_rejected", "dlq"],
        degradation_reason=CONTENT_REJECTED_REASON,
        error_taxonomy="content_policy",
        error_trace=[trace],
        fallback_to="dead_letter_queue",
        dead_letter=True,
    )


__all__ = [
    "content_rejected_payload",
    "intentional_keep_origin_payload",
    "translation_failed_payload",
    "translation_failed_payload_for_transport",
    "translation_failed_payload_for_validation",
]
