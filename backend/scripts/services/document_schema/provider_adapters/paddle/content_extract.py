from __future__ import annotations

from services.document_schema.provider_adapters.common import build_line_records
from services.document_schema.provider_adapters.common import build_text_segments
from services.translation.payload.formula_protection import PLACEHOLDER_RE
from services.translation.payload.formula_protection import protect_inline_formulas


def _segment_record(*, text: str, raw_label: str, segment_type: str) -> dict:
    return {
        "type": segment_type,
        "raw_type": raw_label,
        "text": text,
        "bbox": [0, 0, 0, 0],
        "score": None,
    }


def _split_text_with_inline_formulas(text: str, raw_label: str) -> list[dict]:
    protected_text, formula_map = protect_inline_formulas(text)
    if not formula_map:
        return build_text_segments(text, raw_type=raw_label, segment_type="text")

    lookup = {entry["placeholder"]: entry["formula_text"] for entry in formula_map}
    segments: list[dict] = []
    cursor = 0
    for match in PLACEHOLDER_RE.finditer(protected_text):
        start, end = match.span()
        if start > cursor:
            chunk = protected_text[cursor:start]
            if chunk.strip():
                segments.append(_segment_record(text=chunk.strip(), raw_label=raw_label, segment_type="text"))
        placeholder = match.group(0)
        formula_text = lookup.get(placeholder, "").strip()
        if formula_text:
            segments.append(_segment_record(text=formula_text, raw_label=raw_label, segment_type="formula"))
        cursor = end
    tail = protected_text[cursor:]
    if tail.strip():
        segments.append(_segment_record(text=tail.strip(), raw_label=raw_label, segment_type="text"))
    return segments or build_text_segments(text, raw_type=raw_label, segment_type="text")


def build_segments(text: str, raw_label: str) -> list[dict]:
    label = raw_label.strip().lower()
    if label in {"display_formula", "formula"}:
        return build_text_segments(text, raw_type=raw_label, segment_type="formula")
    if label == "text":
        return _split_text_with_inline_formulas(text, raw_label)
    return build_text_segments(text, raw_type=raw_label, segment_type="text")


def build_lines(*, bbox: list[float], segments: list[dict]) -> list[dict]:
    return build_line_records(bbox, segments)
