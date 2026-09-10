from __future__ import annotations

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.llm.placeholder_transform import has_formula_placeholders
from retainpdf_pipeline.translate.llm.result_payload import result_entry
from retainpdf_pipeline.translate.llm.result_validator import validate_placeholder_inventory
from retainpdf_pipeline.translate.llm.shared.control_context import TranslationControlContext
from retainpdf_pipeline.translate.llm.shared.orchestration.common import is_continuation_or_group_unit
from retainpdf_pipeline.translate.llm.shared.orchestration.common import sentence_level_fallback_allowed
from retainpdf_pipeline.translate.llm.shared.orchestration.common import should_keep_origin_on_empty_translation
from retainpdf_pipeline.translate.llm.shared.orchestration.common import should_keep_origin_on_protocol_shell
from retainpdf_pipeline.translate.llm.shared.orchestration.common import zh_char_count
import retainpdf_pipeline.translate.llm.shared.orchestration.intentional_keep_origin as intentional_keep_origin
import retainpdf_pipeline.translate.llm.shared.orchestration.terminal_payloads as terminal_payloads
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import attach_result_metadata
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import restore_runtime_term_tokens
from retainpdf_pipeline.translate.llm.shared.orchestration.plain_text_retry_runtime import PlainTextResult
from retainpdf_pipeline.translate.llm.shared.orchestration.plain_text_retry_runtime import PlainTextRetryRuntime
from retainpdf_pipeline.translate.llm.shared.orchestration.plain_text_validation import finalize_plain_text_validation_failure
from retainpdf_pipeline.translate.llm.shared.orchestration.plain_text_validation import try_salvage_partial_english_residue
from retainpdf_pipeline.translate.llm.shared.orchestration.transport import defer_transport_retry
from retainpdf_pipeline.translate.llm.validation.english_residue import is_direct_math_mode
from retainpdf_pipeline.translate.llm.validation.english_residue import should_force_translate_body_text
from retainpdf_pipeline.translate.llm.validation.errors import EmptyTranslationError


def finalize_plain_text_failure(
    item: dict,
    *,
    last_error: Exception,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None,
    route_prefix: list[str],
    allow_transport_tail_defer: bool,
    runtime: PlainTextRetryRuntime,
) -> PlainTextResult | None:
    if isinstance(last_error, EmptyTranslationError) and should_keep_origin_on_empty_translation(item):
        if request_label:
            print(f"{request_label}: degraded to keep_origin for short non-body empty translation", flush=True)
        return intentional_keep_origin.keep_origin_payload_for_empty_translation(item)
    if sentence_level_fallback_allowed(item):
        try:
            return runtime.sentence_level_fallback_fn(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                context=context,
                diagnostics=diagnostics,
                translate_plain_fn=runtime.translate_plain_fn,
                translate_unstructured_fn=runtime.translate_unstructured_fn,
            )
        except Exception as sentence_exc:
            if request_label:
                print(f"{request_label}: sentence-level fallback failed: {type(sentence_exc).__name__}: {sentence_exc}", flush=True)
            if runtime.is_transport_error_fn(sentence_exc):
                if allow_transport_tail_defer:
                    defer_transport_retry(
                        item,
                        route_path=["block_level", "sentence_level"],
                        cause=sentence_exc,
                        request_label=request_label,
                        diagnostics=diagnostics,
                    )
                return terminal_payloads.translation_failed_payload_for_transport(
                    item,
                    context=context,
                    route_path=["block_level", "sentence_level", "failed"],
                    degradation_reason="sentence_level_transport_failure",
                    error_code="TRANSPORT_ERROR",
                )
    elif request_label:
        print(f"{request_label}: skip sentence-level fallback for continuation/group unit", flush=True)

    return finalize_plain_text_validation_failure(
        item,
        last_error=last_error,
        context=context,
        diagnostics=diagnostics,
        request_label=request_label,
        route_prefix=route_prefix,
        should_keep_origin_on_protocol_shell_fn=should_keep_origin_on_protocol_shell,
        should_force_translate_body_text_fn=should_force_translate_body_text,
        has_formula_placeholders_fn=has_formula_placeholders,
        try_salvage_partial_english_residue_fn=lambda inner_item, *, exc, context: try_salvage_partial_english_residue(
            inner_item,
            exc=exc,
            context=context,
            zh_char_count_fn=zh_char_count,
            is_direct_math_mode_fn=is_direct_math_mode,
            is_continuation_or_group_unit_fn=is_continuation_or_group_unit,
            has_formula_placeholders_fn=has_formula_placeholders,
            canonicalize_batch_result_fn=runtime.canonicalize_batch_result_fn,
            result_entry_fn=result_entry,
            validate_placeholder_inventory_fn=validate_placeholder_inventory,
            restore_runtime_term_tokens_fn=restore_runtime_term_tokens,
            attach_result_metadata_fn=attach_result_metadata,
        ),
    )
