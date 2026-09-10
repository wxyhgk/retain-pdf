from __future__ import annotations

import retainpdf_pipeline.translate.llm.shared.orchestration.intentional_keep_origin as intentional_keep_origin
import retainpdf_pipeline.translate.llm.shared.orchestration.terminal_payloads as terminal_payloads

keep_origin_payload_for_direct_typst_validation_failure = (
    intentional_keep_origin.keep_origin_payload_for_direct_typst_validation_failure
)
keep_origin_payload_for_empty_translation = intentional_keep_origin.keep_origin_payload_for_empty_translation
keep_origin_payload_for_repeated_empty_translation = (
    intentional_keep_origin.keep_origin_payload_for_repeated_empty_translation
)
keep_origin_payload_for_validation = intentional_keep_origin.keep_origin_payload_for_validation
translation_failed_payload_for_transport = terminal_payloads.translation_failed_payload_for_transport
translation_failed_payload_for_validation = terminal_payloads.translation_failed_payload_for_validation


def keep_origin_payload_for_transport_error(
    item: dict,
    *,
    context=None,
    route_path: list[str] | None = None,
    degradation_reason: str = "transport_timeout_budget_exceeded",
    error_code: str = "TRANSPORT_ERROR",
    final_status: str = "failed",
    fallback_to: str = "retry_required",
    dead_letter: bool = False,
) -> dict[str, dict[str, str]]:
    return terminal_payloads.translation_failed_payload_for_transport(
        item,
        context=context,
        route_path=route_path or ["block_level", "failed"],
        degradation_reason=degradation_reason,
        error_code=error_code,
        fallback_to=fallback_to,
        dead_letter=dead_letter,
    )


def keep_origin_results_for_batch_transport(
    batch: list[dict],
    *,
    context=None,
    degradation_reason: str = "batch_transport_timeout_budget_exceeded",
) -> dict[str, dict[str, str]]:
    failed: dict[str, dict[str, str]] = {}
    for item in batch:
        failed.update(
            terminal_payloads.translation_failed_payload_for_transport(
                item,
                context=context,
                route_path=["block_level", "batched_plain", "failed"],
                degradation_reason=degradation_reason,
                error_code="BATCH_TRANSPORT_ERROR",
            )
        )
    return failed


__all__ = [
    "keep_origin_payload_for_direct_typst_validation_failure",
    "keep_origin_payload_for_empty_translation",
    "keep_origin_payload_for_repeated_empty_translation",
    "keep_origin_payload_for_transport_error",
    "keep_origin_payload_for_validation",
    "keep_origin_results_for_batch_transport",
    "translation_failed_payload_for_transport",
    "translation_failed_payload_for_validation",
]
