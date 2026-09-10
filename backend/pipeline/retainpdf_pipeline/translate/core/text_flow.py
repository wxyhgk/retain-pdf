from __future__ import annotations

# Duplicated from retainpdf_pipeline.ocr.document_schema.text_flow
# (stage-decouple: file-contract duplicate; do not re-add cross-stage import).

import re


TEXT_FLOW_PRESERVE_LINES = "preserve_lines"
TEXT_FLOW_FLOW = "flow"
SENTENCE_END_RE = re.compile(r"[.!?。！？]\s*$")
SOFT_CONTINUATION_END_RE = re.compile(r"(?:[-,，;；:]|(?:\b(?:and|or|of|for|to|in|on|with|the|a|an)\b))\s*$", re.IGNORECASE)
WORD_RE = re.compile(r"[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*")
ORDERED_MARKER_RE = re.compile(r"^\s*(?:\d{1,4}|[A-Za-z])\s*[\.)、]\s+\S+")
BULLET_MARKER_RE = re.compile(r"^\s*(?:[-*•‣◦])\s+\S+")


def line_text(line: object) -> str:
    if isinstance(line, str):
        return " ".join(line.split())
    if not isinstance(line, dict):
        return ""
    explicit = str(line.get("text") or "").strip()
    if explicit:
        return " ".join(explicit.split())
    spans = line.get("spans") or line.get("segments") or []
    if not isinstance(spans, list):
        return ""
    chunks: list[str] = []
    for span in spans:
        if not isinstance(span, dict):
            continue
        content = str(span.get("content") or span.get("text") or "").strip()
        if content:
            chunks.append(content)
    return " ".join(" ".join(chunks).split())


def line_texts_from_lines(lines: object) -> list[str]:
    if not isinstance(lines, list):
        return []
    return [text for line in lines if (text := line_text(line))]


def _line_bboxes(lines: object) -> list[list[float]]:
    if not isinstance(lines, list):
        return []
    bboxes: list[list[float]] = []
    for line in lines:
        if not isinstance(line, dict):
            continue
        bbox = line.get("bbox")
        if not isinstance(bbox, list) or len(bbox) != 4:
            continue
        try:
            bboxes.append([float(value) for value in bbox])
        except Exception:
            continue
    return bboxes


def line_geometry_is_regular(lines: object) -> bool:
    bboxes = _line_bboxes(lines)
    if len(bboxes) < 4:
        return False
    heights = [max(0.0, bbox[3] - bbox[1]) for bbox in bboxes]
    tops = [bbox[1] for bbox in bboxes]
    pitches = [current - previous for previous, current in zip(tops, tops[1:]) if current > previous]
    if not heights or not pitches:
        return False
    median_height = sorted(heights)[len(heights) // 2]
    median_pitch = sorted(pitches)[len(pitches) // 2]
    if median_height <= 0 or median_pitch <= 0:
        return False
    aligned_left = max(abs(bbox[0] - bboxes[0][0]) for bbox in bboxes) <= max(3.0, median_height * 0.4)
    regular_pitch = max(abs(pitch - median_pitch) for pitch in pitches) <= max(3.0, median_pitch * 0.18)
    return aligned_left and regular_pitch


def looks_like_preserved_line_flow(*, text: str, lines: object) -> bool:
    source_text = str(text or "")
    if not source_text.strip():
        return False
    explicit_lines = [line.strip() for line in source_text.splitlines() if line.strip()]
    if len(explicit_lines) >= 3 and _line_marked_ratio(explicit_lines) >= 0.6:
        return True
    line_texts = line_texts_from_lines(lines)
    if len(line_texts) < 6:
        return False
    if not line_geometry_is_regular(lines):
        return False
    sentence_end_count = sum(1 for line in line_texts[:-1] if SENTENCE_END_RE.search(line))
    soft_end_count = sum(1 for line in line_texts[:-1] if SOFT_CONTINUATION_END_RE.search(line))
    avg_words = sum(len(WORD_RE.findall(line)) for line in line_texts) / max(1, len(line_texts))
    return sentence_end_count <= max(1, len(line_texts) // 8) and soft_end_count <= max(3, len(line_texts) // 4) and avg_words <= 9.5


def looks_like_structured_line_flow(*, text: str, lines: object) -> bool:
    source_text = str(text or "")
    explicit_lines = [line.strip() for line in source_text.splitlines() if line.strip()]
    line_texts = explicit_lines if len(explicit_lines) >= 2 else line_texts_from_lines(lines)
    if len(line_texts) < 3:
        return False
    if _line_marked_ratio(line_texts) >= 0.6:
        return True
    return looks_like_preserved_line_flow(text=text, lines=lines)


def _line_marked_ratio(lines: list[str]) -> float:
    if not lines:
        return 0.0
    marker_count = sum(1 for line in lines if ORDERED_MARKER_RE.match(line) or BULLET_MARKER_RE.match(line))
    return marker_count / max(1, len(lines))


def classify_text_flow(*, text: str, lines: object) -> str:
    return TEXT_FLOW_PRESERVE_LINES if looks_like_structured_line_flow(text=text, lines=lines) else TEXT_FLOW_FLOW


def classify_text_flow_for_role(*, text: str, lines: object, semantic_role: str = "", structure_role: str = "") -> str:
    role = str(semantic_role or "").strip().lower()
    structure = str(structure_role or "").strip().lower()
    if structure == "table_of_contents":
        return TEXT_FLOW_PRESERVE_LINES
    if role in {"body", "abstract"} and not looks_like_structured_line_flow(text=text, lines=lines):
        return TEXT_FLOW_FLOW
    explicit_lines = [line.strip() for line in str(text or "").splitlines() if line.strip()]
    if len(explicit_lines) >= 3:
        return TEXT_FLOW_PRESERVE_LINES
    return classify_text_flow(text=text, lines=lines)


__all__ = [
    "TEXT_FLOW_FLOW",
    "TEXT_FLOW_PRESERVE_LINES",
    "classify_text_flow",
    "classify_text_flow_for_role",
    "line_geometry_is_regular",
    "line_text",
    "line_texts_from_lines",
    "looks_like_preserved_line_flow",
    "looks_like_structured_line_flow",
]
