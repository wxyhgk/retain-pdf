from __future__ import annotations

import retainpdf_pipeline.translate.llm.shared.orchestration.terminal_payloads as terminal_payloads


def keep_origin_payload_for_empty_translation(item: dict) -> dict[str, dict[str, str]]:
    return terminal_payloads.intentional_keep_origin_payload(
        item,
        degradation_reason="empty_translation_non_body_label",
        error_taxonomy="validation",
        route_path=["block_level", "keep_origin"],
        error_trace=[{"type": "validation", "code": "EMPTY_TRANSLATION"}],
    )


def keep_origin_payload_for_repeated_empty_translation(item: dict) -> dict[str, dict[str, str]]:
    return terminal_payloads.intentional_keep_origin_payload(
        item,
        degradation_reason="empty_translation_repeated",
        error_taxonomy="validation",
        route_path=["block_level", "keep_origin"],
        error_trace=[{"type": "validation", "code": "EMPTY_TRANSLATION"}],
    )


def keep_origin_payload_for_direct_typst_validation_failure(
    item: dict,
    *,
    context,
    route_path: list[str],
    degradation_reason: str,
    error_code: str,
) -> dict[str, dict[str, str]]:
    return terminal_payloads.intentional_keep_origin_payload(
        item,
        context=context,
        route_path=route_path,
        degradation_reason=degradation_reason,
        error_taxonomy="validation",
        error_trace=[{"type": "validation", "code": error_code}],
    )


def keep_origin_payload_for_validation(
    item: dict,
    *,
    context,
    route_path: list[str],
    degradation_reason: str,
    error_code: str = "",
) -> dict[str, dict[str, str]]:
    trace = [{"type": "validation"}]
    if error_code:
        trace[0]["code"] = error_code
    return terminal_payloads.intentional_keep_origin_payload(
        item,
        context=context,
        route_path=route_path,
        degradation_reason=degradation_reason,
        error_taxonomy="validation",
        error_trace=trace,
    )


__all__ = [
    "keep_origin_payload_for_direct_typst_validation_failure",
    "keep_origin_payload_for_empty_translation",
    "keep_origin_payload_for_repeated_empty_translation",
    "keep_origin_payload_for_validation",
]
