from __future__ import annotations

import retainpdf_pipeline.translate.llm.shared.orchestration.terminal_payloads as terminal_payloads


def formula_window_failed_payload(
    item: dict,
    *,
    window_index: int,
    segment_range: str,
    successful_windows: int,
    total_windows: int,
) -> dict[str, dict[str, str]]:
    failed = terminal_payloads.translation_failed_payload_for_validation(
        item,
        route_path=["block_level", "segmented", "windowed", "failed"],
        degradation_reason="formula_window_translation_failed",
        error_code="FORMULA_WINDOW_TRANSLATION_FAILED",
    )
    payload = failed[item["item_id"]]
    diagnostics = payload["translation_diagnostics"]
    diagnostics["window_index"] = window_index
    diagnostics["segment_range"] = segment_range
    diagnostics["successful_windows"] = successful_windows
    diagnostics["total_windows"] = total_windows
    return failed


__all__ = ["formula_window_failed_payload"]
