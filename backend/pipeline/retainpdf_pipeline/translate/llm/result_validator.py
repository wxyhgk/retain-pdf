from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.llm.result_payload import KEEP_ORIGIN_LABEL
from retainpdf_pipeline.translate.llm.result_payload import normalize_decision
from retainpdf_pipeline.translate.llm.validation.english_residue import looks_like_english_prose
from retainpdf_pipeline.translate.llm.validation.english_residue import unit_source_text
from retainpdf_pipeline.translate.llm.validation.errors import EmptyTranslationError
from retainpdf_pipeline.translate.llm.validation.errors import EnglishResidueError
from retainpdf_pipeline.translate.llm.validation.errors import MathDelimiterError
from retainpdf_pipeline.translate.llm.validation.errors import PlaceholderInventoryError
from retainpdf_pipeline.translate.llm.validation.errors import SuspiciousKeepOriginError
from retainpdf_pipeline.translate.llm.validation.errors import TranslationProtocolError
from retainpdf_pipeline.translate.llm.validation.errors import TruncatedTranslationError
from retainpdf_pipeline.translate.llm.validation.errors import UnexpectedPlaceholderError
from retainpdf_pipeline.translate.core.text_rules import looks_like_code_literal_text_value
from retainpdf_pipeline.translate.core.text_rules import looks_like_url_fragment
from retainpdf_pipeline.translate.llm.validation.quality import TranslationQualityIssue
from retainpdf_pipeline.translate.llm.validation.quality import review_placeholders
from retainpdf_pipeline.translate.llm.validation.quality import review_translation_item
from retainpdf_pipeline.translate.llm.validation.quality import should_reject_keep_origin


@dataclass(frozen=True)
class _ValidationItemState:
    item: dict
    item_id: str
    source_text: str
    translated_result: dict[str, str]
    translated_text: str
    decision: str


ValidationRule = Callable[[_ValidationItemState, TranslationDiagnosticsCollector | None], None]


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


def _allow_same_text_output(state: _ValidationItemState) -> bool:
    return (
        looks_like_url_fragment(state.source_text)
        or looks_like_code_literal_text_value(state.source_text)
        or looks_like_english_prose(state.source_text)
    )


def _validate_translated_item(
    state: _ValidationItemState,
    diagnostics: TranslationDiagnosticsCollector | None,
) -> None:
    report = review_translation_item(state.item, state.translated_result)
    for issue in report.issues:
        _handle_quality_issue(state, issue, diagnostics)
    if state.translated_text.strip() == state.source_text.strip() and _allow_same_text_output(state):
        return


def _handle_quality_issue(
    state: _ValidationItemState,
    issue: TranslationQualityIssue,
    diagnostics: TranslationDiagnosticsCollector | None,
) -> None:
    _emit_validation_diagnostic(
        diagnostics,
        state,
        kind=issue.kind,
        severity=issue.severity,
        message=issue.message,
        retryable=issue.retryable,
        details=issue.details,
    )
    if issue.severity != "error":
        return
    if issue.kind == "empty_translation":
        raise EmptyTranslationError(state.item_id)
    if issue.kind == "math_delimiter_unbalanced":
        raise MathDelimiterError(
            state.item_id,
            source_text=state.source_text,
            translated_text=state.translated_text,
        )
    if issue.kind in {"protocol_shell_output", "context_bleed"}:
        raise TranslationProtocolError(
            state.item_id,
            source_text=state.source_text,
            translated_text=state.translated_text,
        )
    if issue.kind in {"english_residue", "mixed_english_residue"}:
        raise EnglishResidueError(
            state.item_id,
            source_text=state.source_text,
            translated_text=state.translated_text,
        )
    if issue.kind == "truncated_translation":
        ratio = float((issue.details or {}).get("ratio") or 0.0)
        raise TruncatedTranslationError(
            state.item_id,
            source_text=state.source_text,
            translated_text=state.translated_text,
            ratio=ratio,
        )
    if issue.kind == "unexpected_placeholder":
        unexpected = list((issue.details or {}).get("unexpected") or [])
        raise UnexpectedPlaceholderError(
            state.item_id,
            unexpected,
            source_text=state.source_text,
            translated_text=state.translated_text,
        )
    if issue.kind == "placeholder_inventory_mismatch":
        details = issue.details or {}
        source_sequence = list(details.get("source_sequence") or [])
        translated_sequence = list(details.get("translated_sequence") or [])
        raise PlaceholderInventoryError(
            state.item_id,
            source_sequence,
            translated_sequence,
            source_text=state.source_text,
            translated_text=state.translated_text,
        )


def validate_placeholder_inventory(
    item: dict,
    translated_text: str,
    *,
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> None:
    """Validate only the placeholder inventory of a translated text against its source.

    Unlike ``validate_batch_result``, this does not re-run the english-residue,
    empty-translation, protocol-shell, or math-delimiter checks, so it is safe to
    call on text that is known to still contain english residue (e.g. from the
    english-residue salvage path) without immediately re-raising
    ``EnglishResidueError``.
    """

    item_id = str(item.get("item_id", "") or "")
    source_text = unit_source_text(item)
    for issue in review_placeholders(item_id, source_text, translated_text):
        if diagnostics is not None:
            diagnostics.emit(
                kind=issue.kind,
                item_id=item_id,
                page_idx=item.get("page_idx"),
                severity=issue.severity,
                message=issue.message,
                retryable=issue.retryable,
                details=issue.details,
            )
        if issue.severity != "error":
            continue
        if issue.kind == "unexpected_placeholder":
            unexpected = list((issue.details or {}).get("unexpected") or [])
            raise UnexpectedPlaceholderError(
                item_id,
                unexpected,
                source_text=source_text,
                translated_text=translated_text,
            )
        if issue.kind == "placeholder_inventory_mismatch":
            details = issue.details or {}
            source_sequence = list(details.get("source_sequence") or [])
            translated_sequence = list(details.get("translated_sequence") or [])
            raise PlaceholderInventoryError(
                item_id,
                source_sequence,
                translated_sequence,
                source_text=source_text,
                translated_text=translated_text,
            )


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
    "validate_placeholder_inventory",
]
