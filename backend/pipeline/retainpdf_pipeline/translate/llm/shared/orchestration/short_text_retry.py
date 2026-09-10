from __future__ import annotations
from retainpdf_pipeline.translate.llm.shared.executor_context import translation_unit

import re

from retainpdf_pipeline.translate.llm.result_payload import result_entry
from retainpdf_pipeline.translate.llm.result_validator import validate_batch_result
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import attach_result_metadata
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import restore_runtime_term_tokens
from retainpdf_pipeline.translate.llm.shared import provider_runtime


WORD_RE = re.compile(r"[A-Za-z]+(?:[-'][A-Za-z]+)?")


def _source_text(item: dict) -> str:
    return str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or item.get("source_text") or "").strip()


def should_retry_empty_short_text(item: dict) -> bool:
    source = _source_text(item)
    if not source:
        return False
    if len(source) > 120:
        return False
    words = WORD_RE.findall(source)
    return 3 <= len(words) <= 14


@translation_unit
def translate_empty_short_text_retry(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics,
    route_prefix: list[str],
    timeout_s: int,
    request_chat_content_fn=None,
    validate_batch_result_fn=validate_batch_result,
) -> dict[str, dict[str, str]] | None:
    if not should_retry_empty_short_text(item):
        return None
    source = _source_text(item)
    target_language_name = str(getattr(context, "target_language_name", "") or "简体中文")
    request_fn = request_chat_content_fn or provider_runtime.request_chat_content
    content = request_fn(
        [
            {
                "role": "system",
                "content": (
                    f"Translate the given short scientific sentence into {target_language_name}.\n"
                    "Preserve inline LaTeX math exactly, including dollar signs.\n"
                    "Output only the translated sentence. Do not output an empty response."
                ),
            },
            {
                "role": "user",
                "content": source,
            },
        ],
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.0,
        response_format=None,
        timeout=timeout_s,
        request_label=f"{request_label} short-empty-retry" if request_label else "",
        max_attempts=2,
    )
    translated = str(content or "").strip()
    if not translated:
        return None
    result = {str(item.get("item_id", "") or ""): result_entry("translate", translated)}
    result = restore_runtime_term_tokens(result, item=item)
    validate_batch_result_fn([item], result, diagnostics=diagnostics)
    return attach_result_metadata(
        result,
        item=item,
        context=context,
        route_path=route_prefix + ["short_text_retry"],
        output_mode_path=["plain_text"],
        degradation_reason="empty_translation_short_text_retry",
    )


__all__ = [
    "should_retry_empty_short_text",
    "translate_empty_short_text_retry",
]
