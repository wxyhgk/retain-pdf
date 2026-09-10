from __future__ import annotations

import retainpdf_pipeline.translate.llm.shared.orchestration.single_item_flow as single_item_flow
from retainpdf_pipeline.translate.llm.shared.orchestration.single_item_deps import SingleItemFlowDeps
from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_BASE_URL
from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_MODEL

TranslationDiagnosticsCollector = single_item_flow.TranslationDiagnosticsCollector
TranslationControlContext = single_item_flow.TranslationControlContext

EmptyTranslationError = single_item_flow.EmptyTranslationError
EnglishResidueError = single_item_flow.EnglishResidueError
MathDelimiterError = single_item_flow.MathDelimiterError
PlaceholderInventoryError = single_item_flow.PlaceholderInventoryError
TranslationProtocolError = single_item_flow.TranslationProtocolError
UnexpectedPlaceholderError = single_item_flow.UnexpectedPlaceholderError

validate_batch_result = single_item_flow.validate_batch_result
log_placeholder_failure = single_item_flow.log_placeholder_failure
canonicalize_batch_result = single_item_flow.canonicalize_batch_result
split_cached_batch = single_item_flow.split_cached_batch
store_cached_batch = single_item_flow.store_cached_batch

is_transport_error = single_item_flow.is_transport_error
translate_batch_once = single_item_flow.translate_batch_once
translate_single_item_plain_text = single_item_flow.translate_single_item_plain_text
translate_single_item_plain_text_unstructured = single_item_flow.translate_single_item_plain_text_unstructured
translate_continuation_group_members = single_item_flow.translate_continuation_group_members
translate_single_item_formula_segment_text_with_retries = (
    single_item_flow.translate_single_item_formula_segment_text_with_retries
)

_flow_sentence_level_fallback = single_item_flow.DEFAULT_SENTENCE_LEVEL_FALLBACK


def _sentence_level_fallback(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None,
    translate_plain_fn=None,
    translate_unstructured_fn=None,
) -> dict[str, dict[str, str]]:
    return _flow_sentence_level_fallback(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        context=context,
        diagnostics=diagnostics,
        translate_plain_fn=translate_plain_fn or translate_single_item_plain_text,
        translate_unstructured_fn=translate_unstructured_fn or translate_single_item_plain_text_unstructured,
    )


def translate_single_item_stable_placeholder_text(
    item: dict,
    *,
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    request_label: str = "",
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> dict[str, dict[str, str]]:
    return single_item_flow.translate_single_item_stable_placeholder_text(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        context=context,
        diagnostics=diagnostics,
    )


def translate_single_item_plain_text_with_retries(
    item: dict,
    *,
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    request_label: str = "",
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None = None,
    allow_transport_tail_defer: bool = False,
) -> dict[str, dict[str, str]]:
    return single_item_flow.translate_single_item_plain_text_with_retries(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        context=context,
        diagnostics=diagnostics,
        allow_transport_tail_defer=allow_transport_tail_defer,
        deps=SingleItemFlowDeps(
            translate_plain_fn=translate_single_item_plain_text,
            translate_unstructured_fn=translate_single_item_plain_text_unstructured,
            translate_group_members_fn=translate_continuation_group_members,
            formula_segment_translator_fn=translate_single_item_formula_segment_text_with_retries,
            stable_placeholder_text_fn=translate_single_item_stable_placeholder_text,
            sentence_level_fallback_fn=_sentence_level_fallback,
            validate_batch_result_fn=validate_batch_result,
            single_item_translator_fn=translate_single_item_plain_text_with_retries,
        ),
    )


def translate_items_plain_text(
    batch: list[dict],
    *,
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    request_label: str = "",
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> dict[str, dict[str, str]]:
    return single_item_flow._translate_items_plain_text(
        batch,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        context=context,
        diagnostics=diagnostics,
        single_item_translator=translate_single_item_plain_text_with_retries,
        split_cached_batch_fn=split_cached_batch,
        store_cached_batch_fn=store_cached_batch,
        translate_batch_once_fn=translate_batch_once,
    )


__all__ = [
    "DEFAULT_BASE_URL",
    "DEFAULT_MODEL",
    "EmptyTranslationError",
    "EnglishResidueError",
    "MathDelimiterError",
    "PlaceholderInventoryError",
    "TranslationControlContext",
    "TranslationDiagnosticsCollector",
    "TranslationProtocolError",
    "UnexpectedPlaceholderError",
    "_sentence_level_fallback",
    "canonicalize_batch_result",
    "is_transport_error",
    "log_placeholder_failure",
    "split_cached_batch",
    "store_cached_batch",
    "translate_batch_once",
    "translate_items_plain_text",
    "translate_single_item_formula_segment_text_with_retries",
    "translate_single_item_plain_text",
    "translate_single_item_plain_text_unstructured",
    "translate_single_item_plain_text_with_retries",
    "translate_single_item_stable_placeholder_text",
    "validate_batch_result",
]
