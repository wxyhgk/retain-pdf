from __future__ import annotations

import json
import time

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.llm.result_canonicalizer import canonicalize_batch_result
from retainpdf_pipeline.translate.llm.result_payload import result_entry
from retainpdf_pipeline.translate.llm.result_validator import validate_batch_result
from retainpdf_pipeline.translate.llm.shared.control_context import SegmentationPolicy
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_errors import SegmentTranslationFormatError
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_failures import formula_window_failed_payload
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import build_formula_segment_plan
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import build_formula_segment_windows
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import rebuild_formula_segment_translation
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_request import request_formula_segment_translation
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_windows import translate_formula_segment_window_with_retries
from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_BASE_URL
from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_MODEL
from retainpdf_pipeline.translate.llm.shared.provider_runtime import request_chat_content
from retainpdf_pipeline.translate.llm.validation.english_residue import unit_source_text


def translate_single_item_formula_segment_text_with_retries(
    item: dict,
    *,
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    request_label: str = "",
    domain_guidance: str = "",
    policy: SegmentationPolicy | None = None,
    diagnostics: TranslationDiagnosticsCollector | None = None,
    attempt_limit: int = 4,
    timeout_s: int = 120,
    request_chat_content_fn=request_chat_content,
) -> dict[str, dict[str, str]]:
    if policy is None:
        policy = SegmentationPolicy()
    source_text = unit_source_text(item)
    skeleton, segments = build_formula_segment_plan(source_text)
    if not segments:
        raise SegmentTranslationFormatError(f"{item['item_id']}: no translatable formula segments")
    if len(segments) > policy.max_formula_segment_count:
        raise SegmentTranslationFormatError(
            f"{item['item_id']}: too many formula segments ({len(segments)} > {policy.max_formula_segment_count})"
        )

    last_error: Exception | None = None
    for attempt in range(1, max(1, attempt_limit) + 1):
        started = time.perf_counter()
        try:
            if request_label:
                print(f"{request_label}: segmented-formula attempt {attempt}/{max(1, attempt_limit)} segments={len(segments)}", flush=True)
            translated_segments = request_formula_segment_translation(
                item,
                skeleton,
                segments,
                api_key=api_key,
                model=model,
                base_url=base_url,
                domain_guidance=domain_guidance,
                timeout_s=timeout_s,
                request_label=f"{request_label} seg#{attempt}" if request_label else "",
                request_chat_content_fn=request_chat_content_fn,
            )
            rebuilt_text = rebuild_formula_segment_translation(skeleton, translated_segments)
            result = {item["item_id"]: result_entry("translate", rebuilt_text)}
            result = canonicalize_batch_result([item], result)
            validate_batch_result([item], result, diagnostics=diagnostics)
            if request_label:
                elapsed = time.perf_counter() - started
                print(f"{request_label}: segmented-formula ok in {elapsed:.2f}s", flush=True)
            return result
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            last_error = exc
            if request_label:
                elapsed = time.perf_counter() - started
                print(
                    f"{request_label}: segmented-formula failed attempt {attempt}/{max(1, attempt_limit)} after {elapsed:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if attempt >= max(1, attempt_limit):
                raise
            time.sleep(min(8, 2 * attempt))
    if last_error is not None:
        raise last_error
    raise RuntimeError("Segmented formula translation failed without an exception.")


def translate_single_item_formula_segment_windows_with_retries(
    item: dict,
    *,
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    request_label: str = "",
    domain_guidance: str = "",
    policy: SegmentationPolicy | None = None,
    diagnostics: TranslationDiagnosticsCollector | None = None,
    attempt_limit: int = 4,
    timeout_s: int = 120,
    request_chat_content_fn=request_chat_content,
) -> dict[str, dict[str, str]]:
    if policy is None:
        policy = SegmentationPolicy()
    source_text = unit_source_text(item)
    skeleton, segments = build_formula_segment_plan(source_text)
    if not segments:
        raise SegmentTranslationFormatError(f"{item['item_id']}: no translatable formula segments")
    windows = build_formula_segment_windows(skeleton, segments, policy=policy)
    if len(windows) <= 1:
        translated_segments = translate_formula_segment_window_with_retries(
            item,
            windows[0],
            total_windows=1,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            domain_guidance=domain_guidance,
            attempt_limit=attempt_limit,
            timeout_s=timeout_s,
            request_chat_content_fn=request_chat_content_fn,
        )
        rebuilt_text = rebuild_formula_segment_translation(skeleton, translated_segments)
        result = {item["item_id"]: result_entry("translate", rebuilt_text)}
        result = canonicalize_batch_result([item], result)
        validate_batch_result([item], result, diagnostics=diagnostics)
        if request_label:
            print(f"{request_label}: single-window-formula rebuilt ok translated_windows=1/1", flush=True)
        return result

    if request_label:
        print(f"{request_label}: route=windowed-formula windows={len(windows)} segments={len(segments)}", flush=True)
    translated_segments: dict[str, str] = {}
    successful_windows = 0
    for window in windows:
        try:
            translated_segments.update(
                translate_formula_segment_window_with_retries(
                    item,
                    window,
                    total_windows=len(windows),
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    request_label=request_label,
                    domain_guidance=domain_guidance,
                    attempt_limit=attempt_limit,
                    timeout_s=timeout_s,
                    request_chat_content_fn=request_chat_content_fn,
                )
            )
            successful_windows += 1
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            window_index = int(window["window_index"])
            window_range = str(window["segment_range"])
            if diagnostics is not None:
                diagnostics.emit(
                    kind="formula_window_degraded",
                    item_id=str(item.get("item_id", "") or ""),
                    page_idx=item.get("page_idx"),
                    severity="warning",
                    message=f"Formula window degraded to source for range {window_range}",
                    retryable=True,
                    details={"window_index": window_index, "segment_range": window_range},
                )
            if request_label:
                print(
                    f"{request_label}: formula-window {window_index}/{len(windows)} failed range={window_range}: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            return formula_window_failed_payload(
                item,
                window_index=window_index,
                segment_range=window_range,
                successful_windows=successful_windows,
                total_windows=len(windows),
            )

    if successful_windows == 0:
        raise SegmentTranslationFormatError(f"{item['item_id']}: all formula windows degraded to source")

    rebuilt_text = rebuild_formula_segment_translation(skeleton, translated_segments)
    result = {item["item_id"]: result_entry("translate", rebuilt_text)}
    result = canonicalize_batch_result([item], result)
    validate_batch_result([item], result, diagnostics=diagnostics)
    if request_label:
        print(
            f"{request_label}: windowed-formula rebuilt ok translated_windows={successful_windows}/{len(windows)}",
            flush=True,
        )
    return result
