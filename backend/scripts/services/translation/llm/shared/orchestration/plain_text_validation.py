from __future__ import annotations

from services.translation.diagnostics import TranslationDiagnosticsCollector
from services.translation.llm.placeholder_guard import EnglishResidueError
from services.translation.llm.placeholder_guard import EmptyTranslationError
from services.translation.llm.placeholder_guard import MathDelimiterError
from services.translation.llm.placeholder_guard import TranslationProtocolError
from services.translation.llm.placeholder_guard import UnexpectedPlaceholderError
from services.translation.llm.placeholder_guard import PlaceholderInventoryError
from services.translation.llm.shared.orchestration.keep_origin import keep_origin_payload_for_repeated_empty_translation
from services.translation.llm.shared.orchestration.keep_origin import keep_origin_payload_for_validation


def _is_named_exception(exc: Exception, *names: str) -> bool:
    return type(exc).__name__ in set(names)


def try_salvage_protocol_shell_error(
    item: dict,
    *,
    exc: TranslationProtocolError,
    context,
    diagnostics: TranslationDiagnosticsCollector | None,
    route_path: list[str],
    output_mode_path: list[str],
    unwrap_translation_shell_fn,
    result_entry_fn,
    canonicalize_batch_result_fn,
    validate_batch_result_fn,
    restore_runtime_term_tokens_fn,
    attach_result_metadata_fn,
) -> dict[str, dict[str, str]] | None:
    raw_text = str(getattr(exc, "translated_text", "") or "").strip()
    if not raw_text:
        return None
    unwrapped = unwrap_translation_shell_fn(raw_text, item_id=str(item.get("item_id", "") or ""))
    if not unwrapped or unwrapped == raw_text:
        return None
    try:
        result = {str(item.get("item_id", "") or ""): result_entry_fn("translate", unwrapped)}
        result = canonicalize_batch_result_fn([item], result)
        validate_batch_result_fn([item], result, diagnostics=diagnostics)
        result = restore_runtime_term_tokens_fn(result, item=item)
        return attach_result_metadata_fn(
            result,
            item=item,
            context=context,
            route_path=route_path,
            output_mode_path=output_mode_path,
        )
    except Exception:
        return None


def try_salvage_partial_english_residue(
    item: dict,
    *,
    exc: EnglishResidueError,
    context,
    zh_char_count_fn,
    is_direct_math_mode_fn,
    is_continuation_or_group_unit_fn,
    has_formula_placeholders_fn,
    canonicalize_batch_result_fn,
    result_entry_fn,
    restore_runtime_term_tokens_fn,
    attach_result_metadata_fn,
) -> dict[str, dict[str, str]] | None:
    translated_text = str(getattr(exc, "translated_text", "") or "").strip()
    if not translated_text:
        return None
    if zh_char_count_fn(translated_text) < 4:
        return None
    if not (
        is_direct_math_mode_fn(item)
        or is_continuation_or_group_unit_fn(item)
        or has_formula_placeholders_fn(item)
    ):
        return None
    result = canonicalize_batch_result_fn(
        [item],
        {str(item.get("item_id", "") or ""): result_entry_fn("translate", translated_text)},
    )
    result = restore_runtime_term_tokens_fn(result, item=item)
    return attach_result_metadata_fn(
        result,
        item=item,
        context=context,
        route_path=["block_level", "english_residue_salvage"],
        output_mode_path=["plain_text"],
        degradation_reason="english_residue_partial_accept",
    )


def finalize_plain_text_validation_failure(
    item: dict,
    *,
    last_error: Exception,
    context,
    diagnostics: TranslationDiagnosticsCollector | None,
    request_label: str,
    route_prefix: list[str],
    should_keep_origin_on_protocol_shell_fn,
    should_force_translate_body_text_fn,
    has_formula_placeholders_fn,
    try_salvage_partial_english_residue_fn,
) -> dict[str, dict[str, str]] | None:
    if _is_named_exception(last_error, "EnglishResidueError"):
        salvaged = try_salvage_partial_english_residue_fn(item, exc=last_error, context=context)
        if salvaged is not None:
            if diagnostics is not None:
                diagnostics.emit(
                    kind="english_residue_salvaged",
                    item_id=str(item.get("item_id", "") or ""),
                    page_idx=item.get("page_idx"),
                    severity="warning",
                    message="Accepted partially translated output after repeated English-residue validation failure",
                    retryable=False,
                )
            if request_label:
                print(
                    f"{request_label}: accepted partially translated output after repeated English-residue validation failure",
                    flush=True,
                )
            return salvaged
        if diagnostics is not None:
            diagnostics.emit(
                kind="english_residue_degraded",
                item_id=str(item.get("item_id", "") or ""),
                page_idx=item.get("page_idx"),
                severity="warning",
                message="Degraded to keep_origin after repeated English-residue validation failure",
                retryable=True,
            )
        if request_label:
            print(f"{request_label}: degraded to keep_origin after repeated English-residue validation failure", flush=True)
        return keep_origin_payload_for_validation(
            item,
            context=context,
            route_path=route_prefix + ["keep_origin"],
            degradation_reason="english_residue_repeated",
            error_code="ENGLISH_RESIDUE",
        )

    if _is_named_exception(last_error, "TranslationProtocolError") and should_keep_origin_on_protocol_shell_fn(item):
        if diagnostics is not None:
            diagnostics.emit(
                kind="protocol_shell_degraded",
                item_id=str(item.get("item_id", "") or ""),
                page_idx=item.get("page_idx"),
                severity="warning",
                message="Degraded to keep_origin after repeated protocol/json shell output",
                retryable=True,
            )
        if request_label:
            print(f"{request_label}: degraded to keep_origin after repeated protocol/json shell output", flush=True)
        return keep_origin_payload_for_validation(
            item,
            context=context,
            route_path=route_prefix + ["keep_origin"],
            degradation_reason="protocol_shell_repeated",
            error_code="PROTOCOL_SHELL",
        )

    if _is_named_exception(last_error, "MathDelimiterError") and not should_force_translate_body_text_fn(item):
        if diagnostics is not None:
            diagnostics.emit(
                kind="math_delimiter_degraded",
                item_id=str(item.get("item_id", "") or ""),
                page_idx=item.get("page_idx"),
                severity="warning",
                message="Degraded to keep_origin after repeated inline math delimiter failure",
                retryable=True,
            )
        if request_label:
            print(f"{request_label}: degraded to keep_origin after repeated inline math delimiter failure", flush=True)
        return keep_origin_payload_for_validation(
            item,
            context=context,
            route_path=route_prefix + ["keep_origin"],
            degradation_reason="math_delimiter_unbalanced",
            error_code="MATH_DELIMITER_UNBALANCED",
        )

    if _is_named_exception(last_error, "EmptyTranslationError") and not should_force_translate_body_text_fn(item):
        if diagnostics is not None:
            diagnostics.emit(
                kind="empty_translation_degraded",
                item_id=str(item.get("item_id", "") or ""),
                page_idx=item.get("page_idx"),
                severity="warning",
                message="Degraded to keep_origin after repeated empty translation output",
                retryable=True,
            )
        if request_label:
            print(f"{request_label}: degraded to keep_origin after repeated empty translation output", flush=True)
        return keep_origin_payload_for_repeated_empty_translation(item)

    if (
        has_formula_placeholders_fn(item)
        and context.fallback_policy.allow_keep_origin_degradation
        and _is_named_exception(last_error, "UnexpectedPlaceholderError", "PlaceholderInventoryError")
    ):
        if diagnostics is not None:
            diagnostics.emit(
                kind="placeholder_unstable",
                item_id=str(item.get("item_id", "") or ""),
                page_idx=item.get("page_idx"),
                severity="warning",
                message="Degraded to keep_origin after repeated placeholder instability",
                retryable=True,
            )
        if request_label:
            print(f"{request_label}: degraded to keep_origin after repeated placeholder instability", flush=True)
        return keep_origin_payload_for_validation(
            item,
            context=context,
            route_path=route_prefix + ["keep_origin"],
            degradation_reason="placeholder_unstable",
        )

    return None
