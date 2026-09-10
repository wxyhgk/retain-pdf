from __future__ import annotations

import re

from retainpdf_pipeline.render.semantics.text_flow import TEXT_FLOW_PRESERVE_LINES
from retainpdf_pipeline.render.semantics.text_flow import classify_text_flow
from retainpdf_pipeline.render.semantics.text_flow import line_texts_from_lines
from retainpdf_pipeline.render.semantics.item_view import is_caption_like_block
from retainpdf_pipeline.render.layout.model.models import RenderLineBox
from retainpdf_pipeline.render.layout.text_analysis import RAW_MATH_TOKEN_KINDS
from retainpdf_pipeline.render.layout.text_analysis import analyze_text

TOKEN_RE = re.compile(r"[\u4e00-\u9fff]|[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*|[^\S\r\n]+|.")
PUNCTUATION_RE = re.compile(r"^[，。！？；：、,.!?;:()\[\]{}<>《》“”‘’\"']$")
SENTENCE_END_RE = re.compile(r"[.!?。！？]\s*$")
ORDERED_LIST_LINE_RE = re.compile(r"^\s*(?:\d{1,4}|[A-Za-z])\s*[\.)、]\s+\S+")
BULLET_LIST_LINE_RE = re.compile(r"^\s*(?:[-*•‣◦])\s+\S+")
GLOSSARY_TERM_LINE_RE = re.compile(r"^\s*(?:[A-Z][A-Z0-9-]{1,12}|[A-Z]\d{1,3}[A-Z]*)\s+\S+")
BODY_LIST_BLOCK_RE = re.compile(
    r"^\s*(?:(?:\d{1,4}|[A-Za-z])\s*[\.)、]|[-*•‣◦])\s+\S.*"
    r"(?:\n\s*(?:(?:\d{1,4}|[A-Za-z])\s*[\.)、]|[-*•‣◦])\s+\S.*)+\s*$",
    re.MULTILINE,
)
BODY_GLOSSARY_BLOCK_RE = re.compile(
    r"^\s*(?:[A-Z][A-Z0-9-]{1,12}|[A-Z]\d{1,3}[A-Z]*)\s+\S.*"
    r"(?:\n\s*(?:[A-Z][A-Z0-9-]{1,12}|[A-Z]\d{1,3}[A-Z]*)\s+\S.*)+\s*$",
    re.MULTILINE,
)
PRESERVED_LINE_LEADING_CANDIDATES = (0.12, 0.16, 0.2, 0.24, 0.28, 0.32)
PRESERVED_LINE_HEIGHT_FILL = 0.96
PRESERVED_LINE_MIN_FONT_PT = 7.2
PRESERVED_LINE_IDEAL_LEADING = 0.22
PRESERVED_LINE_IDEAL_FONT_PT = 10.6
CAPTION_PRESERVE_LINE_MAX_UNITS = 52.0
CAPTION_PRESERVE_LINE_MAX_CHARS = 80


def source_line_texts(item: dict) -> list[str]:
    explicit = item.get("source_line_texts")
    if isinstance(explicit, list):
        return [str(line).strip() for line in explicit if str(line).strip()]
    return line_texts_from_lines(item.get("lines") or [])


def preserved_line_boxes_for_item(item: dict, translated_text: str) -> list[RenderLineBox]:
    if not bool(item.get("_render_preserve_line_breaks")):
        return []
    text_lines = [str(line).strip() for line in str(translated_text or "").splitlines() if str(line).strip()]
    raw_lines = item.get("lines") or []
    if not text_lines or not isinstance(raw_lines, list) or len(raw_lines) < len(text_lines):
        return []

    boxes: list[RenderLineBox] = []
    for text, raw_line in zip(text_lines, raw_lines, strict=False):
        if not isinstance(raw_line, dict):
            return []
        bbox = raw_line.get("bbox")
        if not isinstance(bbox, list) or len(bbox) != 4:
            return []
        try:
            line_bbox = [float(value) for value in bbox]
        except (TypeError, ValueError):
            return []
        if line_bbox[2] <= line_bbox[0] or line_bbox[3] <= line_bbox[1]:
            return []
        boxes.append(RenderLineBox(text=text, bbox=line_bbox))
    return boxes


def looks_like_structured_line_block(item: dict, lines: list[str] | None = None) -> bool:
    semantic_role = str(item.get("semantic_role") or item.get("layout_role") or "").strip().lower()
    structure_role = str(item.get("structure_role") or "").strip().lower()
    explicit_preserve_lines = str(item.get("text_flow", "") or "").strip().lower() == TEXT_FLOW_PRESERVE_LINES
    if explicit_preserve_lines and _has_line_contract(item):
        if semantic_role in {"body", "abstract"} and structure_role != "table_of_contents":
            return _body_lines_match_preserve_whitelist(lines or source_line_texts(item))
        return True
    if structure_role != "table_of_contents" and semantic_role in {"body", "abstract"}:
        return False
    source_text = str(item.get("protected_source_text") or item.get("source_text") or "")
    del lines
    return classify_text_flow(text=source_text, lines=item.get("lines") or []) == TEXT_FLOW_PRESERVE_LINES


def _has_line_contract(item: dict) -> bool:
    return len(source_line_texts(item)) >= 2


def _body_lines_match_preserve_whitelist(lines: list[str]) -> bool:
    materialized = [str(line or "").strip() for line in lines if str(line or "").strip()]
    if len(materialized) < 2:
        return False
    expanded = "\n".join(materialized)
    if BODY_LIST_BLOCK_RE.fullmatch(expanded):
        return True
    if BODY_GLOSSARY_BLOCK_RE.fullmatch(expanded):
        return _glossary_lines_are_short_entries(materialized)
    return False


def _glossary_lines_are_short_entries(lines: list[str]) -> bool:
    for line in lines:
        if len(line) > 88:
            return False
        if SENTENCE_END_RE.search(line):
            return False
        if len(re.findall(r"[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*", line)) > 9:
            return False
        if not GLOSSARY_TERM_LINE_RE.match(line):
            return False
    return True


def _token_units(token: str) -> float:
    if not token:
        return 0.0
    if token.isspace():
        return max(0.12, len(token) * 0.18)
    if re.fullmatch(r"[\u4e00-\u9fff]", token):
        return 1.0
    if re.fullmatch(r"[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*", token):
        return max(0.8, len(token) * 0.55)
    if PUNCTUATION_RE.fullmatch(token):
        return 0.5
    return 0.55


def _text_units(text: str) -> float:
    return sum(_token_units(token) for token in TOKEN_RE.findall(text or ""))


def _has_long_caption_line(lines: list[str]) -> bool:
    for line in lines:
        text = str(line or "").strip()
        if len(text) > CAPTION_PRESERVE_LINE_MAX_CHARS or _text_units(text) > CAPTION_PRESERVE_LINE_MAX_UNITS:
            return True
    return False


def _should_disable_caption_preserve_lines(item: dict, translated_lines: list[str] | None = None) -> bool:
    if not is_caption_like_block(item):
        return False
    candidate_lines = translated_lines or source_line_texts(item)
    return _has_long_caption_line(candidate_lines)


def _clean_line(tokens: list[str]) -> str:
    return re.sub(r"\s+", " ", "".join(tokens)).strip()


def split_text_by_source_line_weights(translated_text: str, source_lines: list[str]) -> list[str]:
    source_weights = [max(1.0, _text_units(line)) for line in source_lines if line.strip()]
    if not source_weights:
        return [translated_text.strip()] if translated_text.strip() else []
    marker_chunks = _split_text_by_source_line_markers(translated_text, source_lines)
    if marker_chunks is not None:
        return marker_chunks
    tokens = _line_split_tokens(translated_text or "")
    if not tokens:
        return []
    token_units = [_token_units(token) for token in tokens]
    total_units = sum(token_units)
    if total_units <= 0:
        return [_clean_line(tokens)]

    total_source_weight = sum(source_weights)
    chunks: list[str] = []
    start = 0
    running_units = 0.0
    source_running = 0.0
    token_index = 0
    for source_weight in source_weights[:-1]:
        source_running += source_weight
        target_units = total_units * (source_running / total_source_weight)
        while token_index < len(tokens) and running_units + token_units[token_index] < target_units:
            running_units += token_units[token_index]
            token_index += 1
        split_index = max(start + 1, min(len(tokens), token_index))
        while split_index < len(tokens) and tokens[split_index].isspace():
            split_index += 1
        chunks.append(_clean_line(tokens[start:split_index]))
        start = split_index
    chunks.append(_clean_line(tokens[start:]))
    return [chunk for chunk in chunks if chunk]


def _line_split_tokens(text: str) -> list[str]:
    tokens: list[str] = []
    for token in analyze_text(text or "").tokens:
        if token.kind in RAW_MATH_TOKEN_KINDS:
            tokens.append(token.value)
        else:
            tokens.extend(TOKEN_RE.findall(token.value))
    return [token for token in tokens if token]


def _split_text_by_source_line_markers(
    translated_text: str,
    source_lines: list[str],
) -> list[str] | None:
    materialized_lines = [str(line or "").strip() for line in source_lines if str(line or "").strip()]
    if len(materialized_lines) < 2:
        return None
    markers: list[str] = []
    for line in materialized_lines:
        match = re.match(r"^\s*((?:\d{1,4}|[A-Za-z])\s*[\.)、])\s+", line)
        if match is None:
            return None
        markers.append(re.sub(r"\s+", "", match.group(1)))
    if len(set(markers)) != len(markers) or not _ordered_line_markers_are_increasing(markers):
        return None

    text = str(translated_text or "").strip()
    if not text:
        return None
    marker_positions: list[int] = []
    for marker in markers:
        marker_pattern = r"(?<!\S)" + r"\s*".join(re.escape(char) for char in marker) + r"\s+"
        match = re.search(marker_pattern, text)
        if match is None:
            return None
        marker_positions.append(match.start())
    if marker_positions != sorted(marker_positions) or marker_positions[0] > 2:
        return None

    chunks: list[str] = []
    for index, start in enumerate(marker_positions):
        end = marker_positions[index + 1] if index + 1 < len(marker_positions) else len(text)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
    return chunks if len(chunks) == len(markers) else None


def _ordered_line_markers_are_increasing(markers: list[str]) -> bool:
    parsed: list[tuple[str, int]] = []
    for marker in markers:
        match = re.fullmatch(r"(?P<body>\d{1,4}|[A-Za-z])(?P<suffix>[\.)、])", marker)
        if match is None:
            return False
        body = match.group("body")
        suffix = match.group("suffix")
        if body.isdigit():
            parsed.append((f"number:{suffix}", int(body)))
        elif len(body) == 1 and body.isalpha():
            parsed.append((f"alpha:{suffix}:{'upper' if body.isupper() else 'lower'}", ord(body.lower()) - ord("a") + 1))
        else:
            return False
    if len({kind for kind, _value in parsed}) != 1:
        return False
    values = [value for _kind, value in parsed]
    return all(right > left for left, right in zip(values, values[1:]))


def maybe_preserve_structured_line_breaks(item: dict, translated_text: str) -> str:
    text = str(translated_text or "").strip()
    if not text:
        return text
    if "\n" in text:
        text_lines = [line.strip() for line in text.splitlines() if line.strip()]
        if _should_disable_caption_preserve_lines(item, text_lines):
            return re.sub(r"[ \t]*[\r\n]+[ \t]*", " ", text).strip()
        if looks_like_structured_line_block(item):
            item["_render_preserve_line_breaks"] = True
            item["_render_line_structure"] = "structured_lines"
            return text
        return re.sub(r"[ \t]*[\r\n]+[ \t]*", " ", text).strip()
    lines = source_line_texts(item)
    if _should_disable_caption_preserve_lines(item, lines):
        return text
    if not looks_like_structured_line_block(item, lines):
        return text
    chunks = split_text_by_source_line_weights(text, lines)
    if len(chunks) < 2:
        return text
    item["_render_preserve_line_breaks"] = True
    item["_render_line_structure"] = "structured_lines"
    return "\n".join(chunks)


def fit_preserved_line_block_metrics(
    inner: list[float],
    protected_text: str,
    font_size_pt: float,
    leading_em: float,
) -> tuple[float, float]:
    if len(inner) != 4:
        return font_size_pt, leading_em
    line_count = max(1, len([line for line in str(protected_text or "").splitlines() if line.strip()]))
    if line_count <= 1:
        return font_size_pt, leading_em
    height = max(1.0, float(inner[3]) - float(inner[1]))
    if height <= 0:
        return font_size_pt, leading_em

    best: tuple[float, float, float] | None = None
    source_font_hint = max(float(font_size_pt or 0.0), PRESERVED_LINE_IDEAL_FONT_PT)
    for candidate_leading in PRESERVED_LINE_LEADING_CANDIDATES:
        candidate_font = height * PRESERVED_LINE_HEIGHT_FILL / max(1.0, line_count * (1.0 + candidate_leading))
        if candidate_font < PRESERVED_LINE_MIN_FONT_PT:
            continue
        line_pitch = candidate_font * (1.0 + candidate_leading)
        target_pitch = height / max(1.0, line_count)
        pitch_error = abs(line_pitch - target_pitch) / max(1.0, target_pitch)
        leading_error = abs(candidate_leading - PRESERVED_LINE_IDEAL_LEADING) * 0.9
        font_error = abs(candidate_font - min(source_font_hint, PRESERVED_LINE_IDEAL_FONT_PT + 1.0)) / 18.0
        score = pitch_error + leading_error + font_error
        if best is None or score < best[0]:
            best = (score, candidate_font, candidate_leading)

    if best is None:
        fallback_leading = PRESERVED_LINE_LEADING_CANDIDATES[0]
        fallback_font = height * PRESERVED_LINE_HEIGHT_FILL / max(1.0, line_count * (1.0 + fallback_leading))
        return round(max(PRESERVED_LINE_MIN_FONT_PT, fallback_font), 2), fallback_leading
    return round(best[1], 2), round(best[2], 2)


__all__ = [
    "fit_preserved_line_block_metrics",
    "looks_like_structured_line_block",
    "maybe_preserve_structured_line_breaks",
    "preserved_line_boxes_for_item",
    "source_line_texts",
    "split_text_by_source_line_weights",
]
