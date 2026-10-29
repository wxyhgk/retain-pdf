"""没有真实行的文字块：按文字和块框估出行、拆出行内公式片段（2026-10-29 从 Paddle 适配器挪到这里）。

只给块不给行的服务商（Paddle、MinerU content_list_v2、命令型 OCR 的通用格式）都靠这里：缩放后的补行
（`pdf_geometry.rebuild_estimated_text_geometry`）和 Paddle 适配器都调。常量按 PDF 点算，所以要在缩放到 PDF 以后用。
行内公式认 `$...$` / `$$...$$`，没有就退回保护公式记号（`protected_formula_tokens`）。
"""

from __future__ import annotations

import math
import re

from retainpdf_pipeline.ocr.document_schema.protected_formula_tokens import (
    PROTECTED_TOKEN_RE,
    protect_inline_formulas,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.common.normalize import (
    build_line_records,
    build_text_segments,
)

APPROX_TEXT_CHAR_WIDTH_PT = 5.2
MIN_PSEUDO_LINE_PITCH_PT = 11.0
TARGET_PSEUDO_LINE_PITCH_PT = 12.0
# Paddle 的版面解析只给块、不给行。正好两行的正文段落高 22～24pt；以前要 2.2 倍最小行距（24.2pt）
# 才估行数，两行段落全被当成一行，rpr_fit 引擎按「原文单行、不换行」排，字被缩到 4.8pt。
TWO_LINE_MIN_HEIGHT_PITCHES = 1.8
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
    if height_pt < MIN_PSEUDO_LINE_PITCH_PT * TWO_LINE_MIN_HEIGHT_PITCHES:
        return 0

    chars_per_line = _estimated_chars_per_line(width_pt)
    fits_on_one_line = text_len <= chars_per_line
    if height_pt < MIN_PSEUDO_LINE_PITCH_PT * 2.2 and fits_on_one_line:
        # 只有两行左右高、文字又一行放得下：多半是字号大的单行（标题之类），不拆。
        return 0
    predicted_by_width = max(2, math.ceil(text_len / max(1, chars_per_line)))
    # 走到这里时文字一行放不下（或块高已超过 2.2 倍行距），至少是两行。
    max_lines_by_height = max(2, int(height_pt / MIN_PSEUDO_LINE_PITCH_PT))
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


__all__ = [
    "APPROX_TEXT_CHAR_WIDTH_PT",
    "BODYLIKE_SUBTYPES",
    "DOLLAR_MATH_RE",
    "MIN_PSEUDO_LINE_PITCH_PT",
    "PSEUDO_TEXT_HEIGHT_SLACK_RATIO",
    "TARGET_PSEUDO_LINE_PITCH_PT",
    "TWO_LINE_MIN_HEIGHT_PITCHES",
    "build_lines",
    "build_segments",
    "tighten_text_bbox",
]
