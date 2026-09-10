from __future__ import annotations

import json
import time

from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import merge_segment_contexts
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_request import request_formula_segment_translation
from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_BASE_URL
from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_MODEL
from retainpdf_pipeline.translate.llm.shared.provider_runtime import request_chat_content


def translate_formula_segment_window_with_retries(
    item: dict,
    window: dict[str, object],
    *,
    total_windows: int,
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    request_label: str = "",
    domain_guidance: str = "",
    attempt_limit: int = 4,
    timeout_s: int = 120,
    request_chat_content_fn=request_chat_content,
) -> dict[str, str]:
    window_index = int(window["window_index"])
    window_segments = list(window["segments"])
    window_range = str(window["segment_range"])
    context_before = str(window.get("context_before", "") or "")
    context_after = str(window.get("context_after", "") or "")
    include_continuation_context = str(item.get("translation_context_mode", "needed") or "needed").strip().lower() != "off"
    if include_continuation_context and bool(window.get("is_first_window")):
        context_before = merge_segment_contexts(str(item.get("continuation_prev_text", "") or ""), context_before)
    if include_continuation_context and bool(window.get("is_last_window")):
        context_after = merge_segment_contexts(context_after, str(item.get("continuation_next_text", "") or ""))
    last_error: Exception | None = None
    for attempt in range(1, max(1, attempt_limit) + 1):
        started = time.perf_counter()
        try:
            if request_label:
                print(
                    f"{request_label}: formula-window {window_index}/{total_windows} attempt {attempt}/{max(1, attempt_limit)} segments={len(window_segments)} range={window_range}",
                    flush=True,
                )
            translated_segments = request_formula_segment_translation(
                item,
                list(window["skeleton"]),
                window_segments,
                api_key=api_key,
                model=model,
                base_url=base_url,
                domain_guidance=domain_guidance,
                timeout_s=timeout_s,
                request_label=f"{request_label} win{window_index}#{attempt}" if request_label else "",
                context_before=context_before,
                context_after=context_after,
                request_chat_content_fn=request_chat_content_fn,
            )
            if request_label:
                elapsed = time.perf_counter() - started
                print(f"{request_label}: formula-window {window_index}/{total_windows} ok in {elapsed:.2f}s", flush=True)
            return translated_segments
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            last_error = exc
            if request_label:
                elapsed = time.perf_counter() - started
                print(
                    f"{request_label}: formula-window {window_index}/{total_windows} failed attempt {attempt}/{max(1, attempt_limit)} after {elapsed:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if attempt >= max(1, attempt_limit):
                raise
            time.sleep(min(8, 2 * attempt))
    if last_error is not None:
        raise last_error
    raise RuntimeError("Formula window translation failed without an exception.")


__all__ = ["translate_formula_segment_window_with_retries"]
