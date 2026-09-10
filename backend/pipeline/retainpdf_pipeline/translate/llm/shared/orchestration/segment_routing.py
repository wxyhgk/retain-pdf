from __future__ import annotations

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.llm.shared.control_context import SegmentationPolicy
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_errors import SegmentTranslationFormatError
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_errors import SegmentTranslationParseError
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_errors import SegmentTranslationSemanticError
from retainpdf_pipeline.translate.llm.shared.orchestration import segment_executor
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_parsing import TAGGED_SEGMENT_RE
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_parsing import parse_segment_translation_payload
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import build_formula_segment_plan
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import build_formula_segment_windows
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import effective_formula_segment_count
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import is_micro_formula_segment
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import merge_segment_contexts
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import rebuild_formula_segment_translation
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import segment_context_text
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import segment_needs_translation
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import segment_structure_outline
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import slice_formula_segment_skeleton
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import window_neighbor_context
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_prompts import build_formula_segment_messages
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_prompts import segment_translation_system_prompt
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_prompts import segment_translation_tagged_prompt
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_risk import formula_risk_score
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_risk import formula_segment_translation_route
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_risk import formula_segment_window_count
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_risk import is_formula_dense_prose_candidate
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_risk import small_formula_risk_score
from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_BASE_URL
from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_MODEL
from retainpdf_pipeline.translate.llm.shared.provider_runtime import request_chat_content


def _request_formula_segment_translation(
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
) -> dict[str, str]:
    return segment_executor.request_formula_segment_translation(
        item,
        skeleton,
        segments,
        api_key=api_key,
        model=model,
        base_url=base_url,
        domain_guidance=domain_guidance,
        timeout_s=timeout_s,
        request_label=request_label,
        context_before=context_before,
        context_after=context_after,
        request_chat_content_fn=request_chat_content,
    )


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
) -> dict[str, dict[str, str]]:
    return segment_executor.translate_single_item_formula_segment_text_with_retries(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        domain_guidance=domain_guidance,
        policy=policy,
        diagnostics=diagnostics,
        attempt_limit=attempt_limit,
        timeout_s=timeout_s,
        request_chat_content_fn=request_chat_content,
    )


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
) -> dict[str, str]:
    return segment_executor.translate_formula_segment_window_with_retries(
        item,
        window,
        total_windows=total_windows,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        domain_guidance=domain_guidance,
        attempt_limit=attempt_limit,
        timeout_s=timeout_s,
        request_chat_content_fn=request_chat_content,
    )


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
) -> dict[str, dict[str, str]]:
    return segment_executor.translate_single_item_formula_segment_windows_with_retries(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        domain_guidance=domain_guidance,
        policy=policy,
        diagnostics=diagnostics,
        attempt_limit=attempt_limit,
        timeout_s=timeout_s,
        request_chat_content_fn=request_chat_content,
    )


__all__ = [
    "SegmentTranslationFormatError",
    "SegmentTranslationParseError",
    "SegmentTranslationSemanticError",
    "SegmentationPolicy",
    "TAGGED_SEGMENT_RE",
    "_request_formula_segment_translation",
    "build_formula_segment_messages",
    "build_formula_segment_plan",
    "build_formula_segment_windows",
    "effective_formula_segment_count",
    "formula_risk_score",
    "formula_segment_translation_route",
    "formula_segment_window_count",
    "is_formula_dense_prose_candidate",
    "is_micro_formula_segment",
    "merge_segment_contexts",
    "parse_segment_translation_payload",
    "rebuild_formula_segment_translation",
    "segment_context_text",
    "segment_needs_translation",
    "segment_structure_outline",
    "segment_translation_system_prompt",
    "segment_translation_tagged_prompt",
    "slice_formula_segment_skeleton",
    "small_formula_risk_score",
    "translate_formula_segment_window_with_retries",
    "translate_single_item_formula_segment_text_with_retries",
    "translate_single_item_formula_segment_windows_with_retries",
    "window_neighbor_context",
]
