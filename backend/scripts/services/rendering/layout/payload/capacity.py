from __future__ import annotations

from math import ceil
from math import exp
import re

from services.rendering.layout.payload.shared import tokenize_protected_text
from services.rendering.layout.payload.shared import token_units


COMPLEX_FORMULA_COMMAND_RE = re.compile(r"\\(?:frac|dfrac|tfrac|sqrt|sum|prod|int|begin|delta|Delta|partial|mathbf|overline|underline)")


def formula_estimate_discount(protected_text: str, formula_map: list[dict]) -> float:
    tokens = tokenize_protected_text(protected_text)
    formula_lookup = {entry["placeholder"]: entry["formula_text"] for entry in formula_map}
    formula_tokens = [token for token in tokens if token in formula_lookup or (token.startswith("$") and token.endswith("$"))]
    if not formula_tokens:
        return 1.0
    visible_tokens = [token for token in tokens if token.strip()]
    formula_count = len(formula_tokens)
    complex_count = sum(1 for token in formula_tokens if COMPLEX_FORMULA_COMMAND_RE.search(formula_lookup.get(token, token.strip("$"))))
    count_ratio = formula_count / max(1.0, len(visible_tokens))
    uncertainty = formula_count * 0.06 + complex_count * 0.06 + count_ratio * 0.9
    return round(1.0 - 0.14 * (1.0 - exp(-1.7 * max(0.0, uncertainty))), 3)


def box_capacity_units(
    inner: list[float],
    font_size_pt: float,
    leading_em: float,
    visual_lines: int | None = None,
) -> float:
    if len(inner) != 4:
        return 0.0
    width = max(8.0, inner[2] - inner[0])
    height = max(8.0, inner[3] - inner[1])
    line_step = max(font_size_pt * 1.02, font_size_pt * (1.0 + leading_em))
    lines = max(1, int(height / line_step))
    if visual_lines and visual_lines > 1:
        lines = min(lines, max(1, visual_lines + 1))
    chars_per_line = max(4.0, width / max(font_size_pt * 0.92, 1.0))
    return lines * chars_per_line * 0.98


def text_demand_units(protected_text: str, formula_map: list[dict]) -> float:
    if not protected_text:
        return 0.0
    formula_lookup = {entry["placeholder"]: entry["formula_text"] for entry in formula_map}
    return sum(token_units(token, formula_lookup) for token in tokenize_protected_text(protected_text))


def estimated_required_lines(
    inner: list[float],
    protected_text: str,
    formula_map: list[dict],
    font_size_pt: float,
) -> int:
    if len(inner) != 4:
        return 1
    width = max(8.0, inner[2] - inner[0])
    chars_per_line = max(4.0, width / max(font_size_pt * 0.92, 1.0))
    demand = text_demand_units(protected_text, formula_map)
    if demand <= 0:
        return 1
    return max(1, ceil(demand / max(chars_per_line * 0.98, 1.0)))


def estimated_render_height_pt(
    inner: list[float],
    protected_text: str,
    formula_map: list[dict],
    font_size_pt: float,
    leading_em: float,
) -> float:
    if len(inner) != 4:
        return 0.0
    line_step = max(font_size_pt * 1.02, font_size_pt * (1.0 + leading_em))
    required_lines = estimated_required_lines(inner, protected_text, formula_map, font_size_pt)
    return required_lines * line_step * formula_estimate_discount(protected_text, formula_map)


def source_layout_density_reference(
    item: dict,
    inner: list[float],
    font_size_pt: float,
    leading_em: float,
) -> float:
    del item, inner, font_size_pt, leading_em
    return 0.0
