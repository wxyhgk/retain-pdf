from __future__ import annotations

from typing import Callable

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.llm.shared.control_context import TranslationControlContext
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import attach_result_metadata
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import restore_runtime_term_tokens
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_routing import translate_single_item_formula_segment_text_with_retries
import retainpdf_pipeline.translate.llm.shared.orchestration.terminal_payloads as terminal_payloads
from retainpdf_pipeline.translate.llm.shared.orchestration.transport import defer_transport_retry


def try_formula_segment_path(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None,
    allow_transport_tail_defer: bool,
    is_transport_error_fn: Callable[[Exception], bool],
    formula_segment_translator_fn: Callable[..., dict[str, dict[str, str]]] = translate_single_item_formula_segment_text_with_retries,
) -> dict[str, dict[str, str]] | None:
    try:
        segmented_result = formula_segment_translator_fn(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            domain_guidance=context.merged_guidance,
            policy=context.segmentation_policy,
            diagnostics=diagnostics,
            attempt_limit=context.fallback_policy.formula_segment_attempts,
            timeout_s=context.timeout_policy.formula_segment_seconds,
        )
        return attach_result_metadata(
            restore_runtime_term_tokens(segmented_result, item=item),
            item=item,
            context=context,
            route_path=["block_level", "segmented"],
            output_mode_path=["tagged"],
        )
    except Exception as exc:
        if is_transport_error_fn(exc):
            if request_label:
                print(
                    f"{request_label}: formula route transport failure, mark failed: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if allow_transport_tail_defer:
                defer_transport_retry(
                    item,
                    route_path=["block_level", "segmented"],
                    cause=exc,
                    request_label=request_label,
                    diagnostics=diagnostics,
                )
            return terminal_payloads.translation_failed_payload_for_transport(
                item,
                context=context,
                route_path=["block_level", "segmented", "failed"],
                degradation_reason="segmented_transport_failure",
                error_code="TRANSPORT_ERROR",
            )
        if request_label:
            print(
                f"{request_label}: segmented-formula route failed, fallback to plain-text path: {type(exc).__name__}: {exc}",
                flush=True,
            )
    return None
