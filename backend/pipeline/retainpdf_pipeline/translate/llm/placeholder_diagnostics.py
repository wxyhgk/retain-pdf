from __future__ import annotations

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.llm.result_payload import text_preview
from retainpdf_pipeline.translate.llm.validation.english_residue import unit_source_text
from retainpdf_pipeline.translate.llm.validation.errors import PlaceholderInventoryError
from retainpdf_pipeline.translate.llm.validation.errors import UnexpectedPlaceholderError


def log_placeholder_failure(
    request_label: str,
    item: dict,
    exc: Exception,
    *,
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> None:
    source_text = getattr(exc, "source_text", "") or unit_source_text(item)
    translated_text = getattr(exc, "translated_text", "") or ""
    source_seq = getattr(exc, "source_sequence", None)
    translated_seq = getattr(exc, "translated_sequence", None)
    unexpected = getattr(exc, "unexpected", None)
    if diagnostics is not None:
        kind = "placeholder_unstable"
        if isinstance(exc, UnexpectedPlaceholderError):
            kind = "unexpected_placeholder"
        elif isinstance(exc, PlaceholderInventoryError):
            kind = "placeholder_inventory_mismatch"
        diagnostics.emit(
            kind=kind,
            item_id=str(item.get("item_id", "") or ""),
            page_idx=item.get("page_idx"),
            severity="error",
            message=str(exc),
            retryable=True,
            details={
                "source_sequence": source_seq or [],
                "translated_sequence": translated_seq or [],
                "unexpected": unexpected or [],
            },
        )
    print(
        f"{request_label}: placeholder diagnostic item={item.get('item_id','')} block_type={item.get('block_type','')}",
        flush=True,
    )
    print(f"{request_label}: source preview: {text_preview(source_text)}", flush=True)
    if translated_text:
        print(f"{request_label}: translated preview: {text_preview(translated_text)}", flush=True)
    if unexpected:
        print(f"{request_label}: unexpected placeholders: {unexpected}", flush=True)
    if source_seq is not None or translated_seq is not None:
        print(
            f"{request_label}: placeholder seq source={source_seq or []} translated={translated_seq or []}",
            flush=True,
        )


__all__ = ["log_placeholder_failure"]
