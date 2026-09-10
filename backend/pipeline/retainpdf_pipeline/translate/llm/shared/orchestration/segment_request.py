from __future__ import annotations

import json
from retainpdf_pipeline.translate.llm.shared.executor_context import translation_unit

from retainpdf_pipeline.translate.llm.shared.orchestration.segment_errors import SegmentTranslationFormatError
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_errors import SegmentTranslationSemanticError
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_parsing import parse_segment_translation_payload
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_prompts import build_formula_segment_messages
from retainpdf_pipeline.translate.llm.shared.provider_runtime import request_chat_content
from retainpdf_pipeline.translate.llm.shared.structured_models import FORMULA_SEGMENT_RESPONSE_SCHEMA


@translation_unit
def request_formula_segment_translation(
    item: dict,
    skeleton: list[tuple[str, str]],
    segments: list[dict[str, str]],
    *,
    api_key: str,
    model: str,
    base_url: str,
    domain_guidance: str,
    timeout_s: int,
    request_label: str,
    context_before: str | None = None,
    context_after: str | None = None,
    request_chat_content_fn=request_chat_content,
) -> dict[str, str]:
    tagged_error: Exception | None = None
    tagged_request_label = f"{request_label} tagged" if request_label else ""
    try:
        content = request_chat_content_fn(
            build_formula_segment_messages(
                item,
                skeleton,
                segments,
                domain_guidance=domain_guidance,
                context_before=context_before,
                context_after=context_after,
                response_style="tagged",
            ),
            api_key=api_key,
            model=model,
            base_url=base_url,
            temperature=0.0,
            response_format=None,
            timeout=timeout_s,
            request_label=tagged_request_label,
        )
        return parse_segment_translation_payload(content, expected_segments=segments)
    except SegmentTranslationSemanticError:
        raise
    except (ValueError, KeyError, json.JSONDecodeError) as exc:
        tagged_error = exc

    content = request_chat_content_fn(
        build_formula_segment_messages(
            item,
            skeleton,
            segments,
            domain_guidance=domain_guidance,
            context_before=context_before,
            context_after=context_after,
            response_style="json",
        ),
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.0,
        response_format=FORMULA_SEGMENT_RESPONSE_SCHEMA,
        timeout=timeout_s,
        request_label=f"{request_label} json" if request_label else "",
    )
    try:
        return parse_segment_translation_payload(content, expected_segments=segments)
    except (ValueError, KeyError, json.JSONDecodeError) as exc:
        if tagged_error is not None:
            raise SegmentTranslationFormatError(f"tagged_failed={tagged_error}; json_failed={exc}") from exc
        raise


__all__ = ["request_formula_segment_translation"]
