from __future__ import annotations

import os
import time

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.llm.result_validator import validate_batch_result
from retainpdf_pipeline.translate.llm.result_payload import result_entry
from retainpdf_pipeline.translate.llm.validation.errors import EmptyTranslationError
from retainpdf_pipeline.translate.llm.validation.errors import EnglishResidueError
from retainpdf_pipeline.translate.llm.validation.errors import PlaceholderInventoryError
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import placeholder_sequence
from retainpdf_pipeline.translate.llm.shared.orchestration.common import chunk_source_text_fallback
from retainpdf_pipeline.translate.llm.shared.orchestration.common import SENTENCE_SPLIT_RE
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import formula_route_diagnostics
import retainpdf_pipeline.translate.llm.shared.orchestration.terminal_payloads as terminal_payloads
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import restore_runtime_term_tokens
from retainpdf_pipeline.translate.llm.shared.provider_runtime import is_transport_error
from retainpdf_pipeline.translate.llm.shared.provider_runtime import translate_single_item_plain_text
from retainpdf_pipeline.translate.llm.shared.provider_runtime import translate_single_item_plain_text_unstructured


# Sentence-level fallback runs one LLM request per sentence. Without a
# circuit breaker, a rate-limit burst or transport outage burns one call per
# remaining sentence while it silently keeps the English original for each.
# These knobs bound that: a small incremental sleep between failures, and a
# hard stop after a few *consecutive* transport-level failures (repeated
# validation failures do not trip the breaker -- they are expected and cheap).
SENTENCE_LEVEL_TRANSPORT_FAILURE_LIMIT_ENV = "RETAIN_SENTENCE_LEVEL_TRANSPORT_FAILURE_LIMIT"
SENTENCE_LEVEL_RETRY_BACKOFF_SECONDS_ENV = "RETAIN_SENTENCE_LEVEL_RETRY_BACKOFF_SECONDS"
_DEFAULT_TRANSPORT_FAILURE_LIMIT = 3
_DEFAULT_RETRY_BACKOFF_SECONDS = 0.5
_MAX_RETRY_BACKOFF_SECONDS = 5.0


def _transport_failure_limit() -> int:
    raw = os.environ.get(SENTENCE_LEVEL_TRANSPORT_FAILURE_LIMIT_ENV, "").strip()
    try:
        value = int(raw) if raw else _DEFAULT_TRANSPORT_FAILURE_LIMIT
    except ValueError:
        value = _DEFAULT_TRANSPORT_FAILURE_LIMIT
    return max(1, value)


def _retry_backoff_seconds() -> float:
    raw = os.environ.get(SENTENCE_LEVEL_RETRY_BACKOFF_SECONDS_ENV, "").strip()
    try:
        value = float(raw) if raw else _DEFAULT_RETRY_BACKOFF_SECONDS
    except ValueError:
        value = _DEFAULT_RETRY_BACKOFF_SECONDS
    return max(0.0, value)


def sentence_level_fallback(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics: TranslationDiagnosticsCollector | None,
    translate_plain_fn=None,
    translate_unstructured_fn=None,
) -> dict[str, dict[str, str]]:
    translate_plain = translate_plain_fn or translate_single_item_plain_text
    translate_unstructured = translate_unstructured_fn or translate_single_item_plain_text_unstructured
    source_text = str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or "")
    sentences = [part.strip() for part in SENTENCE_SPLIT_RE.split(source_text) if part.strip()]
    if len(sentences) <= 1:
        sentences = chunk_source_text_fallback(source_text)
    if len(sentences) <= 1:
        raise EmptyTranslationError(str(item.get("item_id", "") or ""))
    translated_parts: list[str] = []
    failed_indexes: list[int] = []
    translated_indexes: list[int] = []
    failure_reasons: dict[int, str] = {}
    consecutive_transport_failures = 0
    transport_failure_total = 0
    transport_failure_limit = _transport_failure_limit()
    backoff_seconds = _retry_backoff_seconds()
    circuit_open = False

    def _emit(kind: str, *, severity: str, message: str) -> None:
        if diagnostics is None:
            return
        diagnostics.emit(
            kind=kind,
            item_id=str(item.get("item_id", "") or ""),
            page_idx=item.get("page_idx"),
            severity=severity,
            message=message,
            retryable=severity != "error",
        )

    for index, sentence in enumerate(sentences):
        if circuit_open:
            translated_parts.append(sentence)
            failed_indexes.append(index)
            failure_reasons[index] = "skipped_transport_circuit_open"
            continue

        sentence_item = dict(item)
        sentence_item["translation_unit_protected_source_text"] = sentence
        sentence_item["protected_source_text"] = sentence
        sentence_transport_failure = False
        sentence_failure_reason = ""
        try:
            sentence_result = translate_plain(
                sentence_item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=f"{request_label} sent#{index + 1}" if request_label else "",
                domain_guidance=context.merged_guidance,
                mode=context.mode,
                target_language_name=context.target_language_name,
                diagnostics=diagnostics,
                timeout_s=context.timeout_policy.plain_text_seconds,
            )
            sentence_result = restore_runtime_term_tokens(sentence_result, item=item)
            translated = str(sentence_result.get(item["item_id"], {}).get("translated_text", "") or "").strip()
            if translated:
                translated_parts.append(translated)
                translated_indexes.append(index)
                consecutive_transport_failures = 0
                continue
            sentence_failure_reason = "empty_translation"
        except (EmptyTranslationError, EnglishResidueError) as exc:
            try:
                sentence_result = translate_unstructured(
                    sentence_item,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    request_label=f"{request_label} sent#{index + 1} raw" if request_label else "",
                    domain_guidance=context.merged_guidance,
                    mode=context.mode,
                    target_language_name=context.target_language_name,
                    diagnostics=diagnostics,
                    timeout_s=context.timeout_policy.plain_text_seconds,
                )
                translated = str(sentence_result.get(item["item_id"], {}).get("translated_text", "") or "").strip()
                if translated:
                    translated_parts.append(translated)
                    translated_indexes.append(index)
                    consecutive_transport_failures = 0
                    continue
                sentence_failure_reason = f"{type(exc).__name__}_then_empty_unstructured"
            except Exception as raw_exc:
                sentence_transport_failure = is_transport_error(raw_exc)
                sentence_failure_reason = f"{type(exc).__name__}_then_{type(raw_exc).__name__}"
        except Exception as exc:
            sentence_transport_failure = is_transport_error(exc)
            sentence_failure_reason = type(exc).__name__

        translated_parts.append(sentence)
        failed_indexes.append(index)
        failure_reasons[index] = sentence_failure_reason

        if sentence_transport_failure:
            consecutive_transport_failures += 1
            transport_failure_total += 1
            _emit(
                "sentence_level_fallback_transport_retry",
                severity="warning",
                message=(
                    f"sentence {index + 1}/{len(sentences)} transport failure "
                    f"({sentence_failure_reason}); consecutive={consecutive_transport_failures}"
                ),
            )
            if consecutive_transport_failures >= transport_failure_limit:
                circuit_open = True
                remaining = len(sentences) - index - 1
                _emit(
                    "sentence_level_fallback_circuit_open",
                    severity="error",
                    message=(
                        f"stopping sentence-level fallback after {consecutive_transport_failures} "
                        f"consecutive transport failures; keeping original text for the "
                        f"remaining {remaining} sentence(s) without further requests"
                    ),
                )
            elif index + 1 < len(sentences):
                sleep_seconds = min(_MAX_RETRY_BACKOFF_SECONDS, backoff_seconds * consecutive_transport_failures)
                time.sleep(sleep_seconds)
        else:
            consecutive_transport_failures = 0

    if failed_indexes:
        _emit(
            "sentence_level_fallback_summary",
            severity="warning",
            message=(
                f"sentence-level fallback kept original text for {len(failed_indexes)}/{len(sentences)} "
                f"sentence(s); transport_failures={transport_failure_total} "
                f"reasons={failure_reasons}"
            ),
        )

    if not translated_indexes:
        raise PlaceholderInventoryError(
            str(item.get("item_id", "") or ""),
            placeholder_sequence(source_text),
            [],
            source_text=source_text,
            translated_text="",
        )
    payload = result_entry("translate", " ".join(translated_parts).strip())
    payload["final_status"] = "partially_translated"
    payload["translation_diagnostics"] = {
        "item_id": item.get("item_id", ""),
        "page_idx": item.get("page_idx"),
        "route_path": ["block_level", "sentence_level"],
        "error_trace": [{"type": "validation", "code": "SENTENCE_FALLBACK"}],
        "fallback_to": "sentence_level",
        "degradation_reason": "validation_failed_sentence_level_fallback",
        "final_status": "partially_translated",
        "segment_stats": {
            "expected": len(sentences),
            "received": len(translated_indexes),
            "missing_ids": [str(index + 1) for index in failed_indexes],
        },
        "latency_ms": 0,
        **formula_route_diagnostics(item, context=context),
    }
    validate_batch_result([item], {item["item_id"]: payload}, diagnostics=diagnostics)
    return {item["item_id"]: payload}


def sentence_level_fallback_or_keep_origin(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics: TranslationDiagnosticsCollector | None,
    route_path: list[str],
    sentence_level_fallback_fn=None,
) -> dict[str, dict[str, str]]:
    try:
        fallback_impl = sentence_level_fallback_fn or sentence_level_fallback
        return fallback_impl(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
        )
    except Exception as sentence_exc:
        if request_label:
            print(
                f"{request_label}: sentence-level fallback failed, mark failed: {type(sentence_exc).__name__}: {sentence_exc}",
                flush=True,
            )
        return terminal_payloads.translation_failed_payload_for_transport(
            item,
            context=context,
            route_path=route_path,
            degradation_reason="sentence_level_fallback_failed",
            error_code=type(sentence_exc).__name__.upper(),
        )
