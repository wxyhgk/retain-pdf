from __future__ import annotations

from dataclasses import dataclass
from math import ceil
import re


ZH_CHAR_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
ASCII_WORD_RE = re.compile(r"[A-Za-z0-9]+(?:[-_./][A-Za-z0-9]+)*")
FORMULA_PLACEHOLDER_RE = re.compile(r"__FORMULA_\d+__|⟦FORMULA_\d+⟧|<FORMULA_\d+>")
DOLLAR_FORMULA_RE = re.compile(r"\$(?!\s)(?:\\.|[^$\n]){1,240}?\$")
PUNCTUATION_RE = re.compile(r"[，。！？；：、,.!?;:()\[\]{}<>《》“”‘’\"']")
WHITESPACE_RE = re.compile(r"\s+")


@dataclass(frozen=True)
class ChineseBodyFitConfig:
    chinese_char_width_em: float = 1.0
    ascii_char_width_em: float = 0.55
    punctuation_width_em: float = 0.62
    space_width_em: float = 0.32
    formula_base_width_em: float = 0.65
    formula_char_width_em: float = 0.24
    formula_max_width_em: float = 4.8
    formula_height_scale: float = 1.04
    line_width_safety: float = 0.98
    line_height_floor_em: float = 1.02
    min_font_size_pt: float = 7.8
    search_precision_pt: float = 0.04


@dataclass(frozen=True)
class ChineseBodyFitResult:
    font_size_pt: float
    estimated_height_pt: float
    line_count: int
    overflow_ratio: float
    formula_ratio: float = 0.0
    confidence: float = 1.0
    max_safe_shrink_pt: float = 0.6


@dataclass(frozen=True)
class _Token:
    text: str
    units: float
    formula: bool = False


def _formula_lookup(formula_map: list[dict] | None) -> dict[str, str]:
    lookup: dict[str, str] = {}
    for entry in formula_map or []:
        placeholder = str(entry.get("placeholder", "") or "")
        formula_text = str(entry.get("formula_text", entry.get("latex", "")) or "")
        if placeholder:
            lookup[placeholder] = formula_text
    return lookup


def _formula_units(formula_text: str, config: ChineseBodyFitConfig) -> float:
    visible_len = len(re.sub(r"\\[A-Za-z]+|[\s{}]", "", formula_text or ""))
    return min(
        config.formula_max_width_em,
        config.formula_base_width_em + visible_len * config.formula_char_width_em,
    )


def formula_unit_ratio(
    text: str,
    formula_map: list[dict] | None = None,
    *,
    config: ChineseBodyFitConfig = ChineseBodyFitConfig(),
) -> float:
    tokens = tokenize_chinese_body_text(text, formula_map, config=config)
    total_units = sum(token.units for token in tokens)
    if total_units <= 0:
        return 0.0
    formula_units = sum(token.units for token in tokens if token.formula)
    return formula_units / total_units


def confidence_for_formula_ratio(formula_ratio: float) -> float:
    if formula_ratio <= 0.15:
        return 1.0
    if formula_ratio <= 0.35:
        return 0.6
    return 0.25


def max_safe_shrink_for_formula_ratio(formula_ratio: float) -> float:
    if formula_ratio <= 0.15:
        return 0.6
    if formula_ratio <= 0.35:
        return 0.4
    return 0.2


def tokenize_chinese_body_text(
    text: str,
    formula_map: list[dict] | None = None,
    *,
    config: ChineseBodyFitConfig = ChineseBodyFitConfig(),
) -> list[_Token]:
    formula_lookup = _formula_lookup(formula_map)
    tokens: list[_Token] = []
    index = 0
    while index < len(text):
        formula_match = FORMULA_PLACEHOLDER_RE.match(text, index)
        if formula_match:
            placeholder = formula_match.group(0)
            formula_text = formula_lookup.get(placeholder, placeholder)
            tokens.append(_Token(placeholder, _formula_units(formula_text, config), formula=True))
            index = formula_match.end()
            continue
        dollar_formula_match = DOLLAR_FORMULA_RE.match(text, index)
        if dollar_formula_match:
            formula_text = dollar_formula_match.group(0).strip("$")
            tokens.append(_Token(dollar_formula_match.group(0), _formula_units(formula_text, config), formula=True))
            index = dollar_formula_match.end()
            continue

        word_match = ASCII_WORD_RE.match(text, index)
        if word_match:
            word = word_match.group(0)
            tokens.append(_Token(word, max(0.8, len(word) * config.ascii_char_width_em)))
            index = word_match.end()
            continue

        char = text[index]
        index += 1
        if WHITESPACE_RE.match(char):
            tokens.append(_Token(char, config.space_width_em))
        elif ZH_CHAR_RE.match(char):
            tokens.append(_Token(char, config.chinese_char_width_em))
        elif PUNCTUATION_RE.match(char):
            tokens.append(_Token(char, config.punctuation_width_em))
        else:
            tokens.append(_Token(char, config.ascii_char_width_em))
    return tokens


def estimate_chinese_body_lines(
    bbox_width_pt: float,
    text: str,
    formula_map: list[dict] | None,
    font_size_pt: float,
    *,
    config: ChineseBodyFitConfig = ChineseBodyFitConfig(),
) -> tuple[int, int]:
    if bbox_width_pt <= 0 or font_size_pt <= 0:
        return 1, 0
    line_capacity_units = max(1.0, (bbox_width_pt * config.line_width_safety) / font_size_pt)
    line_count = 1
    formula_line_count = 0
    current_units = 0.0
    current_has_formula = False
    for token in tokenize_chinese_body_text(text, formula_map, config=config):
        token_units = max(0.01, token.units)
        if current_units > 0 and current_units + token_units > line_capacity_units:
            formula_line_count += 1 if current_has_formula else 0
            line_count += 1
            current_units = 0.0
            current_has_formula = False
        if token_units > line_capacity_units:
            wrapped_lines = max(1, ceil(token_units / line_capacity_units))
            line_count += wrapped_lines - 1
            current_units = token_units % line_capacity_units
        else:
            current_units += token_units
        current_has_formula = current_has_formula or token.formula
    formula_line_count += 1 if current_has_formula else 0
    return max(1, line_count), formula_line_count


def estimate_chinese_body_height_pt(
    bbox_width_pt: float,
    text: str,
    formula_map: list[dict] | None,
    font_size_pt: float,
    leading_em: float,
    *,
    config: ChineseBodyFitConfig = ChineseBodyFitConfig(),
) -> ChineseBodyFitResult:
    formula_ratio = formula_unit_ratio(text, formula_map, config=config)
    line_count, formula_line_count = estimate_chinese_body_lines(
        bbox_width_pt,
        text,
        formula_map,
        font_size_pt,
        config=config,
    )
    line_step = max(font_size_pt * config.line_height_floor_em, font_size_pt * (1.0 + leading_em))
    extra_formula_height = formula_line_count * font_size_pt * max(0.0, config.formula_height_scale - 1.0)
    estimated_height = line_count * line_step + extra_formula_height
    return ChineseBodyFitResult(
        font_size_pt=round(font_size_pt, 2),
        estimated_height_pt=round(estimated_height, 2),
        line_count=line_count,
        overflow_ratio=0.0,
        formula_ratio=round(formula_ratio, 3),
        confidence=confidence_for_formula_ratio(formula_ratio),
        max_safe_shrink_pt=max_safe_shrink_for_formula_ratio(formula_ratio),
    )


def solve_chinese_body_font_size_pt(
    bbox_width_pt: float,
    bbox_height_pt: float,
    text: str,
    formula_map: list[dict] | None,
    *,
    leading_em: float,
    min_font_size_pt: float,
    max_font_size_pt: float,
    config: ChineseBodyFitConfig = ChineseBodyFitConfig(),
) -> ChineseBodyFitResult:
    low = max(config.min_font_size_pt, min_font_size_pt)
    high = max(low, max_font_size_pt)
    best = estimate_chinese_body_height_pt(
        bbox_width_pt,
        text,
        formula_map,
        low,
        leading_em,
        config=config,
    )
    while high - low > config.search_precision_pt:
        mid = (low + high) / 2.0
        candidate = estimate_chinese_body_height_pt(
            bbox_width_pt,
            text,
            formula_map,
            mid,
            leading_em,
            config=config,
        )
        if candidate.estimated_height_pt <= bbox_height_pt:
            best = candidate
            low = mid
        else:
            high = mid
    overflow_ratio = best.estimated_height_pt / max(bbox_height_pt, 1.0)
    return ChineseBodyFitResult(
        font_size_pt=round(best.font_size_pt, 2),
        estimated_height_pt=best.estimated_height_pt,
        line_count=best.line_count,
        overflow_ratio=round(overflow_ratio, 3),
        formula_ratio=best.formula_ratio,
        confidence=best.confidence,
        max_safe_shrink_pt=best.max_safe_shrink_pt,
    )


__all__ = [
    "ChineseBodyFitConfig",
    "ChineseBodyFitResult",
    "estimate_chinese_body_height_pt",
    "estimate_chinese_body_lines",
    "confidence_for_formula_ratio",
    "formula_unit_ratio",
    "max_safe_shrink_for_formula_ratio",
    "solve_chinese_body_font_size_pt",
    "tokenize_chinese_body_text",
]
