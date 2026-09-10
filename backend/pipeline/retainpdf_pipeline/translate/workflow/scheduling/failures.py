from __future__ import annotations

import retainpdf_pipeline.translate.llm.shared.orchestration.terminal_payloads as terminal_payloads


def _failed_results_for_unhandled_batch_exception(
    batch: list[dict],
    exc: Exception,
) -> dict[str, dict[str, str]]:
    error_code = type(exc).__name__ or "UNHANDLED_BATCH_EXCEPTION"
    degraded: dict[str, dict[str, str]] = {}
    for item in batch:
        degraded.update(
            terminal_payloads.translation_failed_payload(
                item,
                route_path=["block_level", "batch_runner", "failed"],
                degradation_reason="batch_unhandled_exception",
                error_taxonomy="protocol",
                error_trace=[
                    {
                        "type": "protocol",
                        "code": error_code,
                        "message": str(exc),
                    }
                ],
                fallback_to="retry_required",
            )
        )
    return degraded


__all__ = ["_failed_results_for_unhandled_batch_exception"]
