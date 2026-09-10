from __future__ import annotations

import json

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.llm.result_canonicalizer import canonicalize_batch_result
from retainpdf_pipeline.translate.llm.result_validator import validate_batch_result
from retainpdf_pipeline.translate.llm.shared.orchestration.common import is_low_risk_deepseek_batch_item
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import attach_result_metadata
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import restore_runtime_term_tokens
from retainpdf_pipeline.translate.llm.validation.errors import EmptyTranslationError
from retainpdf_pipeline.translate.llm.validation.errors import EnglishResidueError
from retainpdf_pipeline.translate.llm.validation.errors import MathDelimiterError
from retainpdf_pipeline.translate.llm.validation.errors import PlaceholderInventoryError
from retainpdf_pipeline.translate.llm.validation.errors import SuspiciousKeepOriginError
from retainpdf_pipeline.translate.llm.validation.errors import TranslationProtocolError
from retainpdf_pipeline.translate.llm.validation.errors import TruncatedTranslationError
from retainpdf_pipeline.translate.llm.validation.errors import UnexpectedPlaceholderError


_PARTIAL_RETRY_ERRORS = (
    ValueError,
    KeyError,
    json.JSONDecodeError,
    EnglishResidueError,
    EmptyTranslationError,
    MathDelimiterError,
    UnexpectedPlaceholderError,
    PlaceholderInventoryError,
    TranslationProtocolError,
    TruncatedTranslationError,
    SuspiciousKeepOriginError,
)


def should_use_direct_deepseek_batch(
    batch: list[dict],
    *,
    model: str,
    base_url: str,
    context,
) -> bool:
    if len(batch) <= 1:
        return False
    if all(bool(item.get("_batched_plain_candidate")) for item in batch):
        return True
    del model, base_url
    return all(
        is_low_risk_deepseek_batch_item(
            item,
            batch_low_risk_max_placeholders=context.batch_policy.batch_low_risk_max_placeholders,
            batch_low_risk_min_chars=context.batch_policy.batch_low_risk_min_chars,
            batch_low_risk_max_chars=context.batch_policy.batch_low_risk_max_chars,
        )
        for item in batch
    )


def split_batched_plain_result_for_partial_retry(
    batch: list[dict],
    result: dict[str, dict[str, str]],
    *,
    context,
    diagnostics: TranslationDiagnosticsCollector | None,
) -> tuple[dict[str, dict[str, str]], list[dict]]:
    item_by_id = {item["item_id"]: item for item in batch}
    accepted: dict[str, dict[str, str]] = {}
    retry_items: list[dict] = []
    for item in batch:
        item_id = item["item_id"]
        payload = result.get(item_id)
        if payload is None:
            retry_items.append(item)
            continue
        try:
            canonical = canonicalize_batch_result([item], {item_id: payload})
            validate_batch_result([item], canonical, diagnostics=diagnostics)
            restored = restore_runtime_term_tokens(canonical, item=item)
            accepted.update(
                attach_result_metadata(
                    restored,
                    item=item_by_id[item_id],
                    context=context,
                    route_path=["block_level", "batched_plain"],
                    output_mode_path=["tagged"],
                )
            )
        except _PARTIAL_RETRY_ERRORS:
            retry_items.append(item)
    return accepted, retry_items


def attach_batched_plain_metadata(
    batch: list[dict],
    result: dict[str, dict[str, str]],
    *,
    context,
) -> dict[str, dict[str, str]]:
    restored_result: dict[str, dict[str, str]] = {}
    item_by_id = {item["item_id"]: item for item in batch}
    for item_id, payload in result.items():
        item_result = restore_runtime_term_tokens({item_id: payload}, item=item_by_id[item_id])
        restored_result.update(
            attach_result_metadata(
                item_result,
                item=item_by_id[item_id],
                context=context,
                route_path=["block_level", "batched_plain"],
                output_mode_path=["tagged"],
            )
        )
    return restored_result


def emit_batch_transport_single_retry(
    batch: list[dict],
    *,
    diagnostics: TranslationDiagnosticsCollector | None,
    exc: Exception,
) -> None:
    if diagnostics is None:
        return
    for item in batch:
        diagnostics.emit(
            kind="batch_transport_single_retry",
            item_id=str(item.get("item_id", "") or ""),
            page_idx=item.get("page_idx"),
            severity="warning",
            message=f"Batched request transport failure, retry as single-item path: {type(exc).__name__}",
            retryable=True,
        )
