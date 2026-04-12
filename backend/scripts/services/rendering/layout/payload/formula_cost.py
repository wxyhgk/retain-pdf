from __future__ import annotations

import re

from services.rendering.formula.normalizer import aggressively_simplify_formula_for_latex_math


FORMULA_TOKEN_RE = re.compile(r"<[futnvc]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]")
STYLE_ONLY_LATEX_COMMAND_RE = re.compile(
    r"\\(?:left|right|mathrm|mathbf|mathit|mathsf|mathtt|text|operatorname|displaystyle|textstyle|scriptstyle|scriptscriptstyle)\b"
)
GENERIC_LATEX_COMMAND_RE = re.compile(r"\\[A-Za-z]+")


def approx_formula_visible_text(formula_text: str) -> str:
    expr = aggressively_simplify_formula_for_latex_math(formula_text or "")
    if not expr:
        return ""
    expr = STYLE_ONLY_LATEX_COMMAND_RE.sub("", expr)
    expr = GENERIC_LATEX_COMMAND_RE.sub("x", expr)
    expr = re.sub(r"[{}]", "", expr)
    expr = expr.replace("~", "")
    expr = re.sub(r"\s+", "", expr)
    return expr


def token_units(token: str, formula_lookup: dict[str, str]) -> float:
    if not token:
        return 0.0
    if token.isspace():
        return max(0.2, len(token) * 0.25)
    if FORMULA_TOKEN_RE.fullmatch(token):
        formula_text = formula_lookup.get(token, token)
        normalized = approx_formula_visible_text(formula_text)
        if not normalized:
            normalized = re.sub(r"\s+", "", formula_text)
        return max(1.35, len(normalized) * 0.42)
    if re.fullmatch(r"[\u4e00-\u9fff]", token):
        return 1.0
    if re.fullmatch(r"[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*", token):
        return max(1.0, len(token) * 0.55)
    return 0.45
