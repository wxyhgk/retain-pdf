from __future__ import annotations

import re

from retainpdf_pipeline.translate.llm.placeholder_transform import has_formula_placeholders
from retainpdf_pipeline.translate.llm.shared.control_context import SegmentationPolicy
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import build_formula_segment_plan
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import build_formula_segment_windows
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import effective_formula_segment_count
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import is_micro_formula_segment
from retainpdf_pipeline.translate.llm.validation.english_residue import normalize_inline_whitespace
from retainpdf_pipeline.translate.llm.validation.english_residue import unit_source_text
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import strip_placeholders


_FORMULA_RISK_TRIGGER_PHRASES = (
    "abbreviated as",
    "defined as",
    "denoted as",
    "is defined as",
    "can be defined as",
    "where ",
    "represented by",
    "expressed as",
    "written as",
    "calculated as",
    "corresponds to",
    "refers to",
    "stands for",
)
_PLACEHOLDER_ROUTE_MIN_RISK = 6
_PLACEHOLDER_ROUTE_MIN_PLACEHOLDERS = 4
_PLACEHOLDER_ROUTE_MAX_SEGMENTS = 16


def formula_risk_score(
    source_text: str,
    *,
    skeleton: list[tuple[str, str]] | None = None,
    segments: list[dict[str, str]] | None = None,
    policy: SegmentationPolicy | None = None,
) -> int:
    if policy is None:
        policy = SegmentationPolicy()
    lowered = normalize_inline_whitespace(strip_placeholders(source_text)).lower()
    resolved_skeleton = skeleton
    resolved_segments = segments
    if resolved_skeleton is None or resolved_segments is None:
        resolved_skeleton, resolved_segments = build_formula_segment_plan(source_text)
    score = 0
    placeholder_count = len(re.findall(r"<[ft]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]", source_text))
    prose_chars = len(normalize_inline_whitespace(strip_placeholders(source_text)))
    density = placeholder_count / max(1, len(source_text or ""))

    if any(phrase in lowered for phrase in _FORMULA_RISK_TRIGGER_PHRASES):
        score += 3
    segment_texts = [normalize_inline_whitespace(segment["source_text"]).strip().lower() for segment in resolved_segments]
    short_segments = [text for text in segment_texts if 0 < len(text) <= 32]
    if short_segments:
        score += 1
    if placeholder_count >= 4:
        score += 2
    if placeholder_count >= 8:
        score += 2
    if prose_chars >= 180:
        score += 1
    if density >= 0.015:
        score += 1
    if density >= 0.03:
        score += 1
    micro_segment_count = sum(1 for text in segment_texts if is_micro_formula_segment(text))
    if micro_segment_count >= max(2, len(segment_texts) - 1):
        score -= 2
    elif micro_segment_count:
        score -= 1
    if any(text.startswith(("the ", "a ", "an ")) and len(text) <= 24 for text in segment_texts[:1]):
        score += 1
    if any(text.startswith(("which ", "where ", "that ", "is ", "are ", "can ")) for text in segment_texts[1:]):
        score += 1
    if len(resolved_segments) >= 3:
        score += 1
    placeholder_indexes = [index for index, entry in enumerate(resolved_skeleton) if entry[0] == "placeholder"]
    if placeholder_indexes:
        if min(placeholder_indexes) <= 1:
            score += 1
        if max(placeholder_indexes) < len(resolved_skeleton) - 1:
            score += 1
    if ")" in source_text and any(phrase in lowered for phrase in ("abbreviated as", "stands for", "denoted as")):
        score += 1
    return score


def small_formula_risk_score(
    source_text: str,
    *,
    skeleton: list[tuple[str, str]] | None = None,
    segments: list[dict[str, str]] | None = None,
    policy: SegmentationPolicy | None = None,
) -> int:
    return formula_risk_score(
        source_text,
        skeleton=skeleton,
        segments=segments,
        policy=policy,
    )


def is_formula_dense_prose_candidate(
    item: dict,
    *,
    policy: SegmentationPolicy | None = None,
) -> bool:
    return formula_segment_translation_route(item, policy=policy) == "single"


def formula_segment_translation_route(item: dict, *, policy: SegmentationPolicy | None = None) -> str:
    if policy is None:
        policy = SegmentationPolicy()
    if not has_formula_placeholders(item):
        return "none"
    if item.get("continuation_group"):
        return "none"
    source_text = unit_source_text(item)
    skeleton, segments = build_formula_segment_plan(source_text)
    if not segments:
        return "none"
    effective_segments = effective_formula_segment_count(segments)
    placeholder_count = len(re.findall(r"<[ft]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]", source_text))
    prose_chars = len(normalize_inline_whitespace(strip_placeholders(source_text)))
    risk_score = formula_risk_score(
        source_text,
        skeleton=skeleton,
        segments=segments,
        policy=policy,
    )
    if placeholder_count < _PLACEHOLDER_ROUTE_MIN_PLACEHOLDERS:
        return "none"
    if risk_score < _PLACEHOLDER_ROUTE_MIN_RISK:
        return "none"
    if effective_segments <= 0 or effective_segments > _PLACEHOLDER_ROUTE_MAX_SEGMENTS:
        return "none"
    if placeholder_count >= 24:
        return "none"
    if effective_segments >= 5 and prose_chars >= 180:
        return "none"
    return "single"


def formula_segment_window_count(item: dict, *, policy: SegmentationPolicy | None = None) -> int:
    if policy is None:
        policy = SegmentationPolicy()
    if not has_formula_placeholders(item):
        return 0
    skeleton, segments = build_formula_segment_plan(unit_source_text(item))
    if not segments:
        return 0
    return len(build_formula_segment_windows(skeleton, segments, policy=policy))
