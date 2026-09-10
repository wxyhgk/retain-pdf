from __future__ import annotations

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.llm.result_validator import validate_batch_result
from retainpdf_pipeline.translate.llm.shared.control_context import TranslationControlContext
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst import translate_direct_typst_plain_text_with_retries
from retainpdf_pipeline.translate.llm.shared.orchestration.heavy_formula import translate_heavy_formula_block
from retainpdf_pipeline.translate.llm.shared.orchestration.tagged_placeholder import try_tagged_placeholder_path
from retainpdf_pipeline.translate.llm.shared.orchestration.transport import DeferredTransportRetry
from retainpdf_pipeline.translate.llm.shared.provider_runtime import is_transport_error
from retainpdf_pipeline.translate.llm.shared.provider_runtime import translate_single_item_plain_text
from retainpdf_pipeline.translate.llm.shared.provider_runtime import translate_single_item_plain_text_unstructured


def translate_heavy_formula_route(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None,
    split_reason: str,
    translate_single_item_fn,
) -> dict[str, dict[str, str]] | None:
    return translate_heavy_formula_block(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        context=context,
        diagnostics=diagnostics,
        split_reason=split_reason,
        translate_single_item_fn=translate_single_item_fn,
        deferred_transport_retry_type=DeferredTransportRetry,
    )


def try_tagged_placeholder_route(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None,
    route_path: list[str],
    allow_transport_tail_defer: bool,
    stable_placeholder_text_fn,
    label_suffix: str = "tagged",
    attach_metadata: bool = True,
    handle_transport_error: bool = True,
) -> dict[str, dict[str, str]]:
    return try_tagged_placeholder_path(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        context=context,
        diagnostics=diagnostics,
        route_path=route_path,
        allow_transport_tail_defer=allow_transport_tail_defer,
        label_suffix=label_suffix,
        attach_metadata=attach_metadata,
        handle_transport_error=handle_transport_error,
        stable_placeholder_text_fn=stable_placeholder_text_fn,
        is_transport_error_fn=is_transport_error,
    )


def translate_direct_typst_route(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None,
    allow_transport_tail_defer: bool = False,
    translator,
    translate_plain_fn=None,
    translate_unstructured_fn=None,
    sentence_level_fallback_fn=None,
    validate_batch_result_fn=None,
) -> dict[str, dict[str, str]]:
    return translate_direct_typst_plain_text_with_retries(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        context=context,
        diagnostics=diagnostics,
        allow_transport_tail_defer=allow_transport_tail_defer,
        translator=translator,
        translate_plain_fn=translate_plain_fn or translate_single_item_plain_text,
        translate_unstructured_fn=translate_unstructured_fn or translate_single_item_plain_text_unstructured,
        sentence_level_fallback_fn=sentence_level_fallback_fn,
        validate_batch_result_fn=validate_batch_result_fn or validate_batch_result,
    )


__all__ = [
    "translate_direct_typst_route",
    "translate_heavy_formula_route",
    "try_tagged_placeholder_route",
]
