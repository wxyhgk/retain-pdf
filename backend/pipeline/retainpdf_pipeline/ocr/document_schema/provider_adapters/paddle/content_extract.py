from __future__ import annotations

import math
import re

from retainpdf_pipeline.ocr.document_schema.provider_adapters.common import (
    build_line_records,
    build_text_segments,
)
from retainpdf_pipeline.ocr.document_schema.protected_formula_tokens import (
    PROTECTED_TOKEN_RE,
    protect_inline_formulas,
)

APPROX_TEXT_CHAR_WIDTH_PT = 5.2
MIN_PSEUDO_LINE_PITCH_PT = 11.0
TARGET_PSEUDO_LINE_PITCH_PT = 12.0
PSEUDO_TEXT_HEIGHT_SLACK_RATIO = 1.08
BODYLIKE_SUBTYPES = {"body", "heading"}
DOLLAR_MATH_RE = re.compile(
    r"(?<!\\)(?:"
    r"\$\$(?P<display>.+?)(?<!\\)\$\$"
    r"|\$(?!\$)(?P<inline>[^$\n]+?)(?<!\\)\$(?!\$)"
    r")",
    flags=re.DOTALL,
)


def _segment_record(*, text: str, raw_label: str, segment_type: str) -> dict:
    return {
        "type": segment_type,
        "raw_type": raw_label,
        "text": text,
        "bbox": [0, 0, 0, 0],
        "score": None,
    }


def _split_text_with_inline_formulas(text: str, raw_label: str) -> list[dict]:
    dollar_matches = list(DOLLAR_MATH_RE.finditer(text))
    if dollar_matches:
        segments: list[dict] = []
        cursor = 0
        for match in dollar_matches:
            if match.start() > cursor:
                chunk = text[cursor : match.start()]
                if chunk.strip():
                    segments.append(
                        _segment_record(
                            text=chunk.strip(),
                            raw_label=raw_label,
                            segment_type="text",
                        )
                    )
            formula_text = str(match.group("display") or match.group("inline") or "").strip()
            if formula_text:
                segments.append(
                    _segment_record(
                        text=formula_text,
                        raw_label=raw_label,
                        segment_type="inline_formula",
                    )
                )
            cursor = match.end()
        tail = text[cursor:]
        if tail.strip():
            segments.append(
                _segment_record(
                    text=tail.strip(),
                    raw_label=raw_label,
                    segment_type="text",
                )
            )
        if segments:
            return segments

    protected_text, formula_map = protect_inline_formulas(text)
    if not formula_map:
        return build_text_segments(text, raw_type=raw_label, segment_type="text")

    lookup = {entry["placeholder"]: entry["formula_text"] for entry in formula_map}
    segments: list[dict] = []
    cursor = 0
    for match in PROTECTED_TOKEN_RE.finditer(protected_text):
        start, end = match.span()
        if start > cursor:
            chunk = protected_text[cursor:start]
            if chunk.strip():
                segments.append(_segment_record(text=chunk.strip(), raw_label=raw_label, segment_type="text"))
        placeholder = match.group(0)
        formula_text = lookup.get(placeholder, "").strip()
        if formula_text:
            segments.append(
                _segment_record(
                    text=formula_text,
                    raw_label=raw_label,
                    segment_type="inline_formula",
                )
            )
        cursor = end
    tail = protected_text[cursor:]
    if tail.strip():
        segments.append(_segment_record(text=tail.strip(), raw_label=raw_label, segment_type="text"))
    return segments or build_text_segments(text, raw_type=raw_label, segment_type="text")


def build_segments(text: str, raw_label: str) -> list[dict]:
    label = raw_label.strip().lower()
    if label in {"display_formula", "formula"}:
        return build_text_segments(text, raw_type=raw_label, segment_type="formula")
    # Paddle uses semantic labels such as abstract/reference/figure_title for
    # textual blocks. Inline math must be detected for all of them, not only
    # blocks whose raw label happens to be the literal "text".
    return _split_text_with_inline_formulas(text, raw_label)


def _bbox_width(bbox: list[float]) -> float:
    return max(0.0, float(bbox[2]) - float(bbox[0])) if len(bbox) == 4 else 0.0


def _bbox_height(bbox: list[float]) -> float:
    return max(0.0, float(bbox[3]) - float(bbox[1])) if len(bbox) == 4 else 0.0


def _compact_text_len(text: str) -> int:
    return len(re.sub(r"\s+", "", text or ""))


def _estimated_chars_per_line(width_pt: float) -> int:
    return max(12, int(width_pt / APPROX_TEXT_CHAR_WIDTH_PT))


def _split_words_evenly(text: str, line_count: int, chars_per_line: int) -> list[str]:
    words = (text or "").split()
    if not words:
        compact = " ".join((text or "").split())
        return [compact] if compact else []

    total_compact_len = _compact_text_len(text)
    target_chars_per_line = max(10, math.ceil(total_compact_len / max(1, line_count)))
    break_threshold = min(chars_per_line, max(target_chars_per_line, int(chars_per_line * 0.58)))

    chunks: list[str] = []
    current: list[str] = []
    current_len = 0
    remaining_words = len(words)
    remaining_lines = max(1, line_count)

    for word in words:
        remaining_words -= 1
        projected = current_len + (1 if current else 0) + len(word)
        force_break = (
            current
            and current_len >= break_threshold
            and remaining_lines > 1
            and remaining_words >= remaining_lines - 1
        )
        if force_break:
            chunks.append(" ".join(current))
            current = [word]
            current_len = len(word)
            remaining_lines -= 1
            continue
        current.append(word)
        current_len = projected

    if current:
        chunks.append(" ".join(current))
    return [chunk for chunk in chunks if chunk.strip()]


def _pseudo_line_count(*, bbox: list[float], text: str) -> int:
    width_pt = _bbox_width(bbox)
    height_pt = _bbox_height(bbox)
    text_len = _compact_text_len(text)
    if width_pt <= 0 or height_pt <= 0 or text_len < 72:
        return 0
    if height_pt < MIN_PSEUDO_LINE_PITCH_PT * 2.2:
        return 0

    chars_per_line = _estimated_chars_per_line(width_pt)
    predicted_by_width = max(2, math.ceil(text_len / max(1, chars_per_line)))
    max_lines_by_height = max(1, int(height_pt / MIN_PSEUDO_LINE_PITCH_PT))
    desired_by_height = max(2, round(height_pt / TARGET_PSEUDO_LINE_PITCH_PT))
    return min(max_lines_by_height, max(predicted_by_width, desired_by_height))


def tighten_text_bbox(
    *,
    bbox: list[float],
    text: str,
    block_type: str = "",
    sub_type: str = "",
) -> list[float]:
    if block_type != "text" or str(sub_type or "").strip().lower() not in BODYLIKE_SUBTYPES:
        return list(bbox)
    if len(bbox) != 4:
        return list(bbox)
    line_count = _pseudo_line_count(bbox=bbox, text=text)
    if line_count <= 1:
        return list(bbox)
    x0, y0, x1, y1 = (float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))
    original_height = max(0.0, y1 - y0)
    target_height = min(
        original_height,
        max(
            TARGET_PSEUDO_LINE_PITCH_PT * 2.0,
            line_count * TARGET_PSEUDO_LINE_PITCH_PT * PSEUDO_TEXT_HEIGHT_SLACK_RATIO,
        ),
    )
    return [x0, y0, x1, round(min(y1, y0 + target_height), 3)]


def _build_pseudo_lines(*, bbox: list[float], text: str, raw_label: str) -> list[dict]:
    line_count = _pseudo_line_count(bbox=bbox, text=text)
    if line_count <= 1:
        return []

    width_pt = _bbox_width(bbox)
    height_pt = _bbox_height(bbox)
    chars_per_line = _estimated_chars_per_line(width_pt)
    chunks = _split_words_evenly(text, line_count, chars_per_line)
    if len(chunks) <= 1:
        return []

    x0, y0, x1, y1 = (float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))
    total_lines = len(chunks)
    line_height = height_pt / total_lines
    lines: list[dict] = []
    for index, chunk in enumerate(chunks):
        line_y0 = y0 + line_height * index
        line_y1 = y1 if index == total_lines - 1 else y0 + line_height * (index + 1)
        lines.append(
            {
                "bbox": [x0, round(line_y0, 3), x1, round(line_y1, 3)],
                "bbox_precision": "synthetic_wrap",
                "spans": build_segments(chunk, raw_label),
            }
        )
    return lines


def _build_explicit_text_lines(*, bbox: list[float], text: str, raw_label: str) -> list[dict]:
    chunks = [line.strip() for line in str(text or "").splitlines() if line.strip()]
    if len(chunks) <= 1 or len(bbox) != 4:
        return []
    x0, y0, x1, y1 = (float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))
    total_lines = len(chunks)
    line_height = max(1.0, (y1 - y0) / total_lines)
    lines: list[dict] = []
    for index, chunk in enumerate(chunks):
        line_y0 = y0 + line_height * index
        line_y1 = y1 if index == total_lines - 1 else y0 + line_height * (index + 1)
        lines.append(
            {
                "bbox": [x0, round(line_y0, 3), x1, round(line_y1, 3)],
                "bbox_precision": "synthetic_newline",
                "spans": build_segments(chunk, raw_label),
            }
        )
    return lines


def build_lines(
    *,
    bbox: list[float],
    segments: list[dict],
    text: str = "",
    raw_label: str = "",
    block_type: str = "",
    sub_type: str = "",
) -> list[dict]:
    explicit_lines = _build_explicit_text_lines(bbox=bbox, text=text, raw_label=raw_label)
    if explicit_lines:
        return explicit_lines
    if block_type == "text" and str(sub_type or "").strip().lower() in BODYLIKE_SUBTYPES:
        pseudo_bbox = tighten_text_bbox(
            bbox=bbox,
            text=text,
            block_type=block_type,
            sub_type=sub_type,
        )
        pseudo_lines = _build_pseudo_lines(bbox=pseudo_bbox, text=text, raw_label=raw_label)
        if pseudo_lines:
            return pseudo_lines
    return build_line_records(bbox, segments)


def inherit_missing_segment_bboxes(*, bbox: list[float], segments: list[dict], lines: list[dict]) -> None:
    """Attach the narrowest truthful containing region when Paddle has no glyph boxes.

    `bbox_precision` makes the approximation explicit: top-level segments inherit
    their block, while line spans inherit their generated/observed line region.
    """
    for segment in segments:
        if segment.get("bbox") in (None, [], [0, 0, 0, 0]) or segment.get("bbox_precision") in {
            "block",
            "line",
        }:
            segment["bbox"] = list(bbox)
            segment["bbox_precision"] = "block"
    for line in lines:
        line_bbox = list(line.get("bbox", bbox) or bbox)
        for span in line.get("spans", []) or []:
            if span.get("bbox") in (None, [], [0, 0, 0, 0]) or span.get("bbox_precision") in {
                "block",
                "line",
            }:
                span["bbox"] = line_bbox
                span["bbox_precision"] = "line"


def assign_inline_formula_bboxes(
    *,
    segments: list[dict],
    block_bbox: list[float],
    layout_box_lookup: dict[tuple[float, float, float, float], dict],
) -> dict:
    """Use Paddle layout boxes only when formula-to-box pairing is unambiguous.

    The layout detector does not expose recognized formula text, so a partial
    positional match could attach the wrong box. We therefore assign provider
    geometry only when the number of formula segments exactly equals the
    number of contained ``inline_formula`` boxes; otherwise the normal block
    or line approximation remains explicit.
    """

    formula_segments = [
        segment for segment in segments if segment.get("type") == "inline_formula"
    ]
    candidates: list[tuple[list[float], dict]] = []
    if len(block_bbox) == 4:
        x0, y0, x1, y1 = (float(value) for value in block_bbox)
        for raw_box in layout_box_lookup.values():
            if str(raw_box.get("label", "") or "").strip().lower() != "inline_formula":
                continue
            coordinate = raw_box.get("coordinate")
            if not isinstance(coordinate, list) or len(coordinate) != 4:
                continue
            candidate = [float(value or 0) for value in coordinate]
            if candidate[2] <= candidate[0] or candidate[3] <= candidate[1]:
                continue
            if (
                candidate[0] >= x0
                and candidate[1] >= y0
                and candidate[2] <= x1
                and candidate[3] <= y1
            ):
                candidates.append((candidate, raw_box))
    candidates.sort(key=lambda item: (item[0][1], item[0][0], item[0][3], item[0][2]))

    matched_count = 0
    if formula_segments and len(formula_segments) == len(candidates):
        for segment, (candidate, raw_box) in zip(formula_segments, candidates):
            segment["bbox"] = candidate
            segment["bbox_precision"] = "provider_layout"
            score = raw_box.get("score")
            if isinstance(score, (int, float)):
                segment["score"] = float(score)
            matched_count += 1
    return {
        "provider_inline_formula_segment_count": len(formula_segments),
        "provider_inline_formula_candidate_count": len(candidates),
        "provider_inline_formula_bbox_count": matched_count,
        "provider_inline_formula_bbox_complete": bool(formula_segments)
        and matched_count == len(formula_segments),
    }
