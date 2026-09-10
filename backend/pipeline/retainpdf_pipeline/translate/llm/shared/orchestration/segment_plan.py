from __future__ import annotations

import re

from retainpdf_pipeline.translate.llm.shared.control_context import SegmentationPolicy
from retainpdf_pipeline.translate.llm.validation.english_residue import normalize_inline_whitespace
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import strip_placeholders


_OPTIONAL_EMPTY_SEGMENTS: set[str] = set()

_MICRO_CONNECTOR_SEGMENTS = {
    "a",
    "an",
    "and",
    "as",
    "at",
    "also",
    "be",
    "been",
    "being",
    "but",
    "by",
    "can",
    "could",
    "does",
    "for",
    "from",
    "has",
    "have",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "may",
    "might",
    "of",
    "on",
    "or",
    "per",
    "should",
    "that",
    "the",
    "their",
    "then",
    "these",
    "this",
    "those",
    "to",
    "via",
    "vs",
    "was",
    "were",
    "with",
    "which",
    "while",
    "will",
}


def is_optional_empty_segment(source_text: str) -> bool:
    normalized = normalize_inline_whitespace(source_text).strip().lower()
    if not normalized:
        return True
    return normalized in _OPTIONAL_EMPTY_SEGMENTS


def segment_context_text(text: str, *, limit: int = 280) -> str:
    cleaned = normalize_inline_whitespace(strip_placeholders(text))
    if not cleaned:
        return ""
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[: max(0, limit - 1)].rstrip()}…"


def merge_segment_contexts(*texts: str, limit: int = 280) -> str:
    merged = " ".join(part.strip() for part in texts if part and part.strip())
    return segment_context_text(merged, limit=limit)


def segment_structure_outline(skeleton: list[tuple[str, str]]) -> list[str]:
    outline: list[str] = []
    for kind, value in skeleton:
        if kind == "segment":
            outline.append(f"segment:{value}")
        elif kind == "placeholder":
            outline.append("formula")
        elif kind == "literal":
            literal = normalize_inline_whitespace(value)
            if literal:
                outline.append(f"literal:{literal}")
    return outline


def segment_needs_translation(text: str) -> bool:
    normalized = (text or "").strip()
    if not normalized:
        return False
    return any(ch.isalpha() for ch in normalized)


def _segment_word_tokens(text: str) -> list[str]:
    normalized = normalize_inline_whitespace(text).strip().lower()
    if not normalized:
        return []
    return re.findall(r"[a-z]+(?:[-'][a-z]+)?", normalized)


def is_micro_formula_segment(text: str) -> bool:
    normalized = normalize_inline_whitespace(text).strip().lower()
    if not normalized:
        return True
    words = _segment_word_tokens(normalized)
    if not words:
        return True
    if len(words) <= 2 and len(normalized) <= 20 and all(word in _MICRO_CONNECTOR_SEGMENTS for word in words):
        return True
    if len(words) <= 3 and len(normalized) <= 24 and (
        words[0] in _MICRO_CONNECTOR_SEGMENTS or words[-1] in _MICRO_CONNECTOR_SEGMENTS
    ):
        return True
    if len(words) <= 4 and all(word in _MICRO_CONNECTOR_SEGMENTS for word in words):
        return True
    return False


def effective_formula_segment_count(segments: list[dict[str, str]]) -> int:
    if not segments:
        return 0
    meaningful = [
        segment
        for segment in segments
        if not is_micro_formula_segment(str(segment.get("source_text", "") or ""))
    ]
    return len(meaningful) or len(segments)


def build_formula_segment_plan(source_text: str) -> tuple[list[tuple[str, str]], list[dict[str, str]]]:
    skeleton: list[tuple[str, str]] = []
    segments: list[dict[str, str]] = []
    cursor = 0
    for match in re.finditer(r"<[ft]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]", source_text or ""):
        text = (source_text or "")[cursor : match.start()]
        if text:
            if segment_needs_translation(text):
                segment_id = str(len(segments) + 1)
                segments.append({"segment_id": segment_id, "source_text": text.strip()})
                skeleton.append(("segment", segment_id))
            else:
                skeleton.append(("literal", text))
        skeleton.append(("placeholder", match.group(0)))
        cursor = match.end()
    tail = (source_text or "")[cursor:]
    if tail:
        if segment_needs_translation(tail):
            segment_id = str(len(segments) + 1)
            segments.append({"segment_id": segment_id, "source_text": tail.strip()})
            skeleton.append(("segment", segment_id))
        else:
            skeleton.append(("literal", tail))
    return skeleton, segments


def rebuild_formula_segment_translation(
    skeleton: list[tuple[str, str]],
    translated_segments: dict[str, str],
) -> str:
    parts: list[str] = []
    for kind, value in skeleton:
        if kind == "segment":
            parts.append((translated_segments.get(value, "") or "").strip())
        else:
            parts.append(value)
    rebuilt = "".join(parts)
    rebuilt = re.sub(r"[ \t]{2,}", " ", rebuilt)
    rebuilt = re.sub(r"\s+([,.;:!?])", r"\1", rebuilt)
    return rebuilt.strip()


def window_neighbor_context(
    segments: list[dict[str, str]],
    start_index: int,
    end_index: int,
    *,
    direction: str,
    policy: SegmentationPolicy,
) -> str:
    if direction == "before":
        context_segments = segments[max(0, start_index - policy.formula_segment_window_neighbor_context) : start_index]
    else:
        context_segments = segments[
            end_index + 1 : end_index + 1 + policy.formula_segment_window_neighbor_context
        ]
    return segment_context_text(" ".join(segment["source_text"] for segment in context_segments))


def slice_formula_segment_skeleton(
    skeleton: list[tuple[str, str]],
    first_segment_id: str,
    last_segment_id: str,
) -> list[tuple[str, str]]:
    first_index = next(index for index, entry in enumerate(skeleton) if entry[0] == "segment" and entry[1] == first_segment_id)
    last_index = next(index for index, entry in enumerate(skeleton) if entry[0] == "segment" and entry[1] == last_segment_id)
    start = first_index
    while start > 0 and skeleton[start - 1][0] != "segment":
        start -= 1
    end = last_index
    while end + 1 < len(skeleton) and skeleton[end + 1][0] != "segment":
        end += 1
    return skeleton[start : end + 1]


def build_formula_segment_windows(
    skeleton: list[tuple[str, str]],
    segments: list[dict[str, str]],
    *,
    policy: SegmentationPolicy,
) -> list[dict[str, object]]:
    windows: list[dict[str, object]] = []
    index = 0
    while index < len(segments):
        start_index = index
        current_segments: list[dict[str, str]] = []
        current_chars = 0
        while index < len(segments):
            segment = segments[index]
            segment_chars = len(normalize_inline_whitespace(segment["source_text"]))
            if current_segments and (
                len(current_segments) >= policy.formula_segment_window_target_count
                or current_chars + segment_chars > policy.formula_segment_window_max_chars
            ):
                break
            current_segments.append(segment)
            current_chars += segment_chars
            index += 1
        if not current_segments:
            current_segments.append(segments[index])
            index += 1
        end_index = index - 1
        first_segment_id = current_segments[0]["segment_id"]
        last_segment_id = current_segments[-1]["segment_id"]
        windows.append(
            {
                "window_index": len(windows) + 1,
                "start_index": start_index,
                "end_index": end_index,
                "is_first_window": start_index == 0,
                "is_last_window": end_index >= len(segments) - 1,
                "segments": current_segments,
                "segment_range": f"{first_segment_id}-{last_segment_id}",
                "context_before": window_neighbor_context(segments, start_index, end_index, direction="before", policy=policy),
                "context_after": window_neighbor_context(segments, start_index, end_index, direction="after", policy=policy),
                "skeleton": slice_formula_segment_skeleton(skeleton, first_segment_id, last_segment_id),
            }
        )
    return windows
