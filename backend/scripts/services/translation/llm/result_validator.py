from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
import re
from typing import Callable

from services.translation.diagnostics import TranslationDiagnosticsCollector
from services.translation.item_reader import item_raw_block_type
from services.translation.llm.result_payload import KEEP_ORIGIN_LABEL
from services.translation.llm.result_payload import is_internal_placeholder_degraded
from services.translation.llm.result_payload import normalize_decision
from services.translation.llm.validation.english_residue import is_direct_math_mode
from services.translation.llm.validation.english_residue import looks_like_english_prose
from services.translation.llm.validation.english_residue import looks_like_mixed_english_residue_output
from services.translation.llm.validation.english_residue import looks_like_predominantly_english_output
from services.translation.llm.validation.english_residue import looks_like_untranslated_english_output
from services.translation.llm.validation.english_residue import should_force_translate_body_text
from services.translation.llm.validation.english_residue import unit_source_text
from services.translation.llm.validation.errors import EmptyTranslationError
from services.translation.llm.validation.errors import EnglishResidueError
from services.translation.llm.validation.errors import MathDelimiterError
from services.translation.llm.validation.errors import PlaceholderInventoryError
from services.translation.llm.validation.errors import SuspiciousKeepOriginError
from services.translation.llm.validation.errors import TranslationProtocolError
from services.translation.llm.validation.errors import UnexpectedPlaceholderError
from services.translation.llm.validation.math_safety import has_balanced_inline_math_delimiters
from services.translation.llm.validation.placeholder_tokens import placeholder_sequence
from services.translation.llm.validation.placeholder_tokens import placeholders
from services.translation.llm.validation.protocol_shell import looks_like_protocol_shell_output
from services.translation.policy.metadata_filter import looks_like_url_fragment
from services.translation.policy.soft_hints import looks_like_code_literal_text_value


@dataclass(frozen=True)
class _ValidationItemState:
    item: dict
    item_id: str
    source_text: str
    translated_result: dict[str, str]
    translated_text: str
    decision: str


ValidationRule = Callable[[_ValidationItemState, TranslationDiagnosticsCollector | None], None]
INLINE_MATH_SPAN_RE = re.compile(r"(?<!\\)\$(?:\\.|[^$\\\n])+(?<!\\)\$")
SOURCE_TERMINAL_RE = re.compile(r"[.!?。！？；;:：)\]）】”’\"']\s*$")


def should_reject_keep_origin(item: dict, decision: str, payload: dict[str, str] | None = None) -> bool:
    if decision != KEEP_ORIGIN_LABEL:
        return False
    if payload and is_internal_placeholder_degraded(payload):
        return False
    block_type = item_raw_block_type(item)
    if block_type not in {"", "text"}:
        return False
    return should_force_translate_body_text(item)


def _emit_validation_diagnostic(
    diagnostics: TranslationDiagnosticsCollector | None,
    state: _ValidationItemState,
    *,
    kind: str,
    severity: str,
    message: str,
    retryable: bool,
    details: dict | None = None,
) -> None:
    if diagnostics is None:
        return
    diagnostics.emit(
        kind=kind,
        item_id=state.item_id,
        page_idx=state.item.get("page_idx"),
        severity=severity,
        message=message,
        retryable=retryable,
        details=details,
    )


def _validate_non_empty_translation(
    state: _ValidationItemState,
    diagnostics: TranslationDiagnosticsCollector | None,
) -> None:
    if state.translated_text.strip():
        return
    _emit_validation_diagnostic(
        diagnostics,
        state,
        kind="empty_translation",
        severity="error",
        message="Empty translation output",
        retryable=True,
    )
    raise EmptyTranslationError(state.item_id)


def _validate_direct_math_delimiters(
    state: _ValidationItemState,
    diagnostics: TranslationDiagnosticsCollector | None,
) -> None:
    if not is_direct_math_mode(state.item) or has_balanced_inline_math_delimiters(state.translated_text):
        return
    _emit_validation_diagnostic(
        diagnostics,
        state,
        kind="math_delimiter_unbalanced",
        severity="error",
        message="Translated output has unbalanced inline math delimiters",
        retryable=True,
    )
    raise MathDelimiterError(
        state.item_id,
        source_text=state.source_text,
        translated_text=state.translated_text,
    )


def _validate_protocol_shell(
    state: _ValidationItemState,
    diagnostics: TranslationDiagnosticsCollector | None,
) -> None:
    if not looks_like_protocol_shell_output(state.translated_text):
        return
    _emit_validation_diagnostic(
        diagnostics,
        state,
        kind="protocol_shell_output",
        severity="error",
        message="Translated output still contains JSON/protocol shell",
        retryable=True,
    )
    raise TranslationProtocolError(
        state.item_id,
        source_text=state.source_text,
        translated_text=state.translated_text,
    )


def _math_spans(text: str) -> list[str]:
    return [match.group(0).strip() for match in INLINE_MATH_SPAN_RE.finditer(str(text or "")) if match.group(0).strip()]


def _source_looks_incomplete(text: str) -> bool:
    source = str(text or "").strip()
    if not source:
        return False
    return SOURCE_TERMINAL_RE.search(source) is None


def _validate_direct_math_context_bleed(
    state: _ValidationItemState,
    diagnostics: TranslationDiagnosticsCollector | None,
) -> None:
    if not is_direct_math_mode(state.item) or not _source_looks_incomplete(state.source_text):
        return
    context_after = str(state.item.get("translation_context_after") or state.item.get("continuation_next_text") or "")
    if not context_after:
        return
    source_math = set(_math_spans(state.source_text))
    leaked = [
        expr
        for expr in _math_spans(context_after)
        if expr not in source_math and expr in state.translated_text
    ]
    if not leaked:
        return
    _emit_validation_diagnostic(
        diagnostics,
        state,
        kind="context_bleed",
        severity="error",
        message="Translated output appears to include following context not present in current source",
        retryable=True,
        details={"leaked_math": leaked[:5]},
    )
    raise TranslationProtocolError(
        state.item_id,
        source_text=state.source_text,
        translated_text=state.translated_text,
    )


def _raise_english_residue(
    state: _ValidationItemState,
    diagnostics: TranslationDiagnosticsCollector | None,
    *,
    kind: str,
    message: str,
) -> None:
    _emit_validation_diagnostic(
        diagnostics,
        state,
        kind=kind,
        severity="error",
        message=message,
        retryable=True,
    )
    raise EnglishResidueError(
        state.item_id,
        source_text=state.source_text,
        translated_text=state.translated_text,
    )


def _validate_untranslated_english(
    state: _ValidationItemState,
    diagnostics: TranslationDiagnosticsCollector | None,
) -> None:
    if looks_like_untranslated_english_output(state.item, state.translated_text):
        _raise_english_residue(
            state,
            diagnostics,
            kind="english_residue",
            message="Translated output still looks predominantly English",
        )


def _validate_mixed_english_residue(
    state: _ValidationItemState,
    diagnostics: TranslationDiagnosticsCollector | None,
) -> None:
    if looks_like_mixed_english_residue_output(state.item, state.translated_text):
        _raise_english_residue(
            state,
            diagnostics,
            kind="mixed_english_residue",
            message="Translated output still contains long copied English residue spans",
        )


def _warn_predominantly_english(
    state: _ValidationItemState,
    diagnostics: TranslationDiagnosticsCollector | None,
) -> None:
    if not looks_like_predominantly_english_output(state.item, state.translated_text):
        return
    _emit_validation_diagnostic(
        diagnostics,
        state,
        kind="english_residue_warning",
        severity="warning",
        message="Translated output still contains substantial English residue",
        retryable=False,
    )


def _validate_placeholder_subset(
    state: _ValidationItemState,
    diagnostics: TranslationDiagnosticsCollector | None,
) -> None:
    source_placeholders = placeholders(state.source_text)
    translated_placeholders = placeholders(state.translated_text)
    if translated_placeholders.issubset(source_placeholders):
        return
    unexpected = sorted(translated_placeholders - source_placeholders)
    _emit_validation_diagnostic(
        diagnostics,
        state,
        kind="unexpected_placeholder",
        severity="error",
        message=f"Unexpected placeholders: {unexpected}",
        retryable=True,
        details={"unexpected": unexpected},
    )
    raise UnexpectedPlaceholderError(
        state.item_id,
        unexpected,
        source_text=state.source_text,
        translated_text=state.translated_text,
    )


def _validate_placeholder_inventory(
    state: _ValidationItemState,
    diagnostics: TranslationDiagnosticsCollector | None,
) -> None:
    source_sequence = placeholder_sequence(state.source_text)
    translated_sequence = placeholder_sequence(state.translated_text)
    if Counter(translated_sequence) == Counter(source_sequence):
        return
    _emit_validation_diagnostic(
        diagnostics,
        state,
        kind="placeholder_inventory_mismatch",
        severity="error",
        message="Placeholder inventory mismatch",
        retryable=True,
        details={
            "source_sequence": source_sequence,
            "translated_sequence": translated_sequence,
        },
    )
    raise PlaceholderInventoryError(
        state.item_id,
        source_sequence,
        translated_sequence,
        source_text=state.source_text,
        translated_text=state.translated_text,
    )


def _warn_placeholder_order_changed(
    state: _ValidationItemState,
    diagnostics: TranslationDiagnosticsCollector | None,
) -> None:
    source_sequence = placeholder_sequence(state.source_text)
    translated_sequence = placeholder_sequence(state.translated_text)
    if translated_sequence == source_sequence:
        return
    _emit_validation_diagnostic(
        diagnostics,
        state,
        kind="placeholder_order_changed",
        severity="warning",
        message="Protected token order changed but inventory is preserved",
        retryable=False,
        details={
            "source_sequence": source_sequence,
            "translated_sequence": translated_sequence,
        },
    )


def _allow_same_text_output(state: _ValidationItemState) -> bool:
    return (
        looks_like_url_fragment(state.source_text)
        or looks_like_code_literal_text_value(state.source_text)
        or looks_like_english_prose(state.source_text)
    )


_TRANSLATED_TEXT_VALIDATORS: tuple[ValidationRule, ...] = (
    _validate_non_empty_translation,
    _validate_direct_math_delimiters,
    _validate_protocol_shell,
    _validate_direct_math_context_bleed,
    _validate_untranslated_english,
    _validate_mixed_english_residue,
    _warn_predominantly_english,
)

_PLACEHOLDER_VALIDATORS: tuple[ValidationRule, ...] = (
    _validate_placeholder_subset,
    _validate_placeholder_inventory,
    _warn_placeholder_order_changed,
)


def _validate_translated_item(
    state: _ValidationItemState,
    diagnostics: TranslationDiagnosticsCollector | None,
) -> None:
    for validator in _TRANSLATED_TEXT_VALIDATORS:
        validator(state, diagnostics)
    if is_direct_math_mode(state.item):
        return
    for validator in _PLACEHOLDER_VALIDATORS:
        validator(state, diagnostics)
    if state.translated_text.strip() == state.source_text.strip() and _allow_same_text_output(state):
        return


def validate_batch_result(
    batch: list[dict],
    result: dict[str, dict[str, str]],
    *,
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> None:
    expected_ids = {item["item_id"] for item in batch}
    actual_ids = set(result)
    if actual_ids != expected_ids:
        missing = sorted(expected_ids - actual_ids)
        extra = sorted(actual_ids - expected_ids)
        raise ValueError(f"translation item_id mismatch: missing={missing} extra={extra}")

    for item in batch:
        item_id = item["item_id"]
        source_text = unit_source_text(item)
        translated_result = result.get(item_id, {})
        translated_text = translated_result.get("translated_text", "")
        decision = normalize_decision(translated_result.get("decision", "translate"))
        if should_reject_keep_origin(item, decision, translated_result):
            if diagnostics is not None:
                diagnostics.emit(
                    kind="keep_origin_degraded",
                    item_id=item_id,
                    page_idx=item.get("page_idx"),
                    severity="warning",
                    message="Suspicious keep_origin for long English body text",
                    retryable=True,
                )
            raise SuspiciousKeepOriginError(item_id, result)
        if decision == KEEP_ORIGIN_LABEL:
            continue
        _validate_translated_item(
            _ValidationItemState(
                item=item,
                item_id=item_id,
                source_text=source_text,
                translated_result=translated_result,
                translated_text=translated_text,
                decision=decision,
            ),
            diagnostics,
        )


__all__ = [
    "should_reject_keep_origin",
    "validate_batch_result",
]
