import re
from statistics import median
from dataclasses import dataclass

from common.config import DEFAULT_FONT_SIZE


@dataclass
class RenderBlock:
    bbox: list[float]
    markdown_text: str
    font_size_pt: float
    leading_em: float


MIN_FONT_SIZE_PT = 8.8
MAX_FONT_SIZE_PT = 12.2
ZH_FONT_SCALE = 0.94
BLOCK_SCALE_MIN = 0.90
BLOCK_SCALE_MAX = 1.05
DENSITY_SCALE_STEP = 0.03
DEFAULT_LEADING_EM = 0.42
TIGHT_LEADING_EM = 0.33


def _formula_map_lookup(formula_map: list[dict]) -> dict[str, str]:
    return {item["placeholder"]: item["formula_text"] for item in formula_map}


def _split_protected_text(protected_text: str) -> list[str]:
    parts: list[str] = []
    cursor = 0
    while cursor < len(protected_text):
        start = protected_text.find("[[FORMULA_", cursor)
        if start == -1:
            parts.append(protected_text[cursor:])
            break
        if start > cursor:
            parts.append(protected_text[cursor:start])
        end = protected_text.find("]]", start)
        if end == -1:
            parts.append(protected_text[start:])
            break
        parts.append(protected_text[start : end + 2])
        cursor = end + 2
    return [part for part in parts if part]


def _normalize_formula_for_latex_math(formula_text: str) -> str:
    expr = " ".join(formula_text.strip().split())
    if not expr:
        return expr
    expr = re.sub(r"\\begin\{array\}\s*\{[^{}]*\}\s*", "", expr)
    expr = re.sub(r"\s*\\end\{array\}", "", expr)
    expr = re.sub(r"\\cal\s+([A-Za-z])", r"\\mathcal{\1}", expr)
    if expr.startswith(("_", "^")):
        expr = "{} " + expr
    return expr


def _looks_like_citation(formula_text: str) -> bool:
    expr = " ".join(formula_text.strip().split())
    return bool(re.fullmatch(r"\[\s*\d+(?:\s*[-,]\s*\d+)*\s*\]", expr))


def _normalize_plain_citation(formula_text: str) -> str:
    digits = re.findall(r"\d+", formula_text)
    return f"[{','.join(digits)}]" if digits else formula_text.strip()


def _line_height(line: dict) -> float:
    bbox = line.get("bbox", [])
    if len(bbox) != 4:
        return 0.0
    return max(0.0, bbox[3] - bbox[1])


def _median_line_height(item: dict) -> float:
    heights = [_line_height(line) for line in item.get("lines", [])]
    heights = [height for height in heights if height > 0]
    return median(heights) if heights else 0.0


def _plain_text_chars_per_line(item: dict) -> float:
    counts: list[int] = []
    for line in item.get("lines", []):
        text_chunks: list[str] = []
        for span in line.get("spans", []):
            if span.get("type") != "text":
                continue
            text_chunks.append(span.get("content", ""))
        plain = re.sub(r"\s+", "", "".join(text_chunks))
        if plain:
            counts.append(len(plain))
    return median(counts) if counts else 0.0


def _formula_ratio(item: dict) -> float:
    text_spans = 0
    formula_spans = 0
    for line in item.get("lines", []):
        for span in line.get("spans", []):
            span_type = span.get("type")
            if span_type == "inline_equation":
                formula_spans += 1
            elif span_type == "text":
                text_spans += 1
    total = text_spans + formula_spans
    return formula_spans / total if total else 0.0


def _bbox_width(item: dict) -> float:
    bbox = item.get("bbox", [])
    return max(0.0, bbox[2] - bbox[0]) if len(bbox) == 4 else 0.0


def _bbox_height(item: dict) -> float:
    bbox = item.get("bbox", [])
    return max(0.0, bbox[3] - bbox[1]) if len(bbox) == 4 else 0.0


def _occupied_ratio(item: dict) -> float:
    block_height = _bbox_height(item)
    if block_height <= 0:
        return 0.0
    total_line_height = sum(_line_height(line) for line in item.get("lines", []))
    return total_line_height / block_height


def _candidate_text_items(items: list[dict]) -> list[dict]:
    candidates: list[dict] = []
    widths = [_bbox_width(item) for item in items if item.get("block_type") == "text"]
    page_text_width_med = median(widths) if widths else 0.0
    for item in items:
        if item.get("block_type") != "text":
            continue
        if len(item.get("lines", [])) < 3:
            continue
        if len(re.sub(r"\s+", "", item.get("source_text", ""))) < 40:
            continue
        if _formula_ratio(item) > 0.35:
            continue
        if page_text_width_med > 0 and _bbox_width(item) < page_text_width_med * 0.6:
            continue
        candidates.append(item)
    return candidates


def _is_body_text_candidate(item: dict, page_text_width_med: float) -> bool:
    if item.get("block_type") != "text":
        return False
    if len(item.get("lines", [])) < 3:
        return False
    if len(re.sub(r"\s+", "", item.get("source_text", ""))) < 120:
        return False
    if _formula_ratio(item) > 0.35:
        return False
    if page_text_width_med > 0 and _bbox_width(item) < page_text_width_med * 0.75:
        return False
    return True


def _page_baseline_font_size(items: list[dict]) -> tuple[float, float, float]:
    candidates = _candidate_text_items(items)
    line_heights = [_median_line_height(item) for item in candidates]
    line_heights = [height for height in line_heights if height > 0]
    baseline_line_height = median(line_heights) if line_heights else 0.0
    if baseline_line_height <= 0:
        return DEFAULT_FONT_SIZE, 0.0, 0.0
    page_font_size = max(
        MIN_FONT_SIZE_PT,
        min(MAX_FONT_SIZE_PT, baseline_line_height * ZH_FONT_SCALE),
    )
    chars_per_line = [_plain_text_chars_per_line(item) for item in candidates]
    chars_per_line = [value for value in chars_per_line if value > 0]
    density_baseline = median(chars_per_line) if chars_per_line else 0.0
    return page_font_size, baseline_line_height, density_baseline


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def estimate_font_size_pt(item: dict, page_font_size: float, page_line_height: float, density_baseline: float) -> float:
    if item.get("block_type") != "text":
        return DEFAULT_FONT_SIZE

    if not item.get("_is_body_text_candidate", False):
        return DEFAULT_FONT_SIZE

    block_scale = 1.0
    block_line_height = _median_line_height(item)
    if page_line_height > 0 and block_line_height > 0:
        block_scale = _clamp(block_line_height / page_line_height, BLOCK_SCALE_MIN, BLOCK_SCALE_MAX)

    density_scale = 1.0
    chars_per_line = _plain_text_chars_per_line(item)
    if density_baseline > 0 and chars_per_line > density_baseline * 1.15:
        density_scale -= DENSITY_SCALE_STEP
    elif density_baseline > 0 and chars_per_line < density_baseline * 0.85:
        density_scale += DENSITY_SCALE_STEP

    occupied_ratio = _occupied_ratio(item)
    if occupied_ratio > 0.9:
        density_scale -= 0.02
    elif occupied_ratio < 0.55:
        density_scale += 0.02

    return round(_clamp(page_font_size * block_scale * density_scale, MIN_FONT_SIZE_PT, MAX_FONT_SIZE_PT), 2)


def estimate_leading_em(item: dict) -> float:
    if item.get("_is_body_text_candidate", False):
        return TIGHT_LEADING_EM
    return DEFAULT_LEADING_EM


def build_markdown_paragraph(item: dict) -> str:
    protected = item.get("protected_translated_text") or item.get("protected_source_text", "")
    parts = _split_protected_text(protected)
    formula_lookup = _formula_map_lookup(item.get("formula_map", []))
    chunks: list[str] = []

    for part in parts:
        if part.startswith("[[FORMULA_"):
            formula_text = formula_lookup.get(part, part)
            if _looks_like_citation(formula_text):
                chunks.append(_normalize_plain_citation(formula_text))
                continue
            chunks.append(f"${_normalize_formula_for_latex_math(formula_text)}$")
        else:
            text = part.strip()
            if text:
                chunks.append(text)

    return "".join(chunks).strip()


def build_render_blocks(translated_items: list[dict]) -> list[RenderBlock]:
    blocks: list[RenderBlock] = []
    page_font_size, page_line_height, density_baseline = _page_baseline_font_size(translated_items)
    text_widths = [_bbox_width(item) for item in translated_items if item.get("block_type") == "text"]
    page_text_width_med = median(text_widths) if text_widths else 0.0
    for item in translated_items:
        translated_text = (item.get("translated_text") or "").strip()
        bbox = item.get("bbox", [])
        if len(bbox) != 4 or not translated_text:
            continue
        item = dict(item)
        item["_is_body_text_candidate"] = _is_body_text_candidate(item, page_text_width_med)
        blocks.append(
            RenderBlock(
                bbox=bbox,
                markdown_text=build_markdown_paragraph(item),
                font_size_pt=estimate_font_size_pt(item, page_font_size, page_line_height, density_baseline),
                leading_em=estimate_leading_em(item),
            )
        )
    return blocks
