from __future__ import annotations

import re


STRUCTURAL_LATEX_COMMANDS = {
    "begin",
    "end",
    "frac",
    "sqrt",
    "left",
    "right",
    "overline",
    "underline",
    "overset",
    "underset",
    "stackrel",
    "operatorname",
    "text",
    "textbf",
    "textit",
    "boxed",
    "binom",
}


def normalize_formula_for_latex_math(formula_text: str) -> str:
    expr = " ".join(formula_text.strip().split())
    if not expr:
        return expr

    def _collapse_mathrm_letters(match: re.Match[str]) -> str:
        inner = match.group(1)
        collapsed = re.sub(r"\s+", "", inner)
        return f"\\mathrm{{{collapsed}}}"

    expr = re.sub(r"\\begin\{array\}\s*\{[^{}]*\}\s*", "", expr)
    expr = re.sub(r"\s*\\end\{array\}", "", expr)
    expr = re.sub(r"\\cal\s+([A-Za-z])", r"\\mathcal{\1}", expr)
    expr = re.sub(r"\\mathscr\b", r"\\mathcal", expr)
    expr = re.sub(r"\\Breve\b", r"\\breve", expr)
    expr = re.sub(r"\\bf\b", r"\\mathbf", expr)
    expr = re.sub(r"\\pmb\b", r"\\mathbf", expr)
    expr = re.sub(r"\\rm\b", r"\\mathrm", expr)
    expr = re.sub(r"\\it\b", r"\\mathit", expr)
    expr = re.sub(r"\\sf\b", r"\\mathsf", expr)
    expr = re.sub(r"\\tt\b", r"\\mathtt", expr)
    expr = re.sub(r"\\textcircled\s*\{\s*\\times\s*\}", r"\\otimes", expr)
    expr = re.sub(
        r"\\textcircled\s*\{\s*\\scriptsize\s*\{\s*\\parallel\s*\}\s*\}",
        r"\\circ",
        expr,
    )
    expr = re.sub(r"\\textcircled\s*\{\s*\\parallel\s*\}", r"\\circ", expr)
    expr = re.sub(r"\\textcircled\s*\{\s*([^{}]+?)\s*\}", r"\1", expr)
    expr = re.sub(r"\\(?:scriptstyle|scriptscriptstyle|textstyle|displaystyle)\b", "", expr)

    expr = re.sub(
        r"\\mathrm\s*\{\s*\{\s*([A-Za-z](?:\s+[A-Za-z])+)\s*\}\s*\}",
        _collapse_mathrm_letters,
        expr,
    )
    expr = re.sub(
        r"\\mathrm\s*\{\s*([A-Za-z](?:\s+[A-Za-z])+)\s*\}",
        _collapse_mathrm_letters,
        expr,
    )

    expr = re.sub(r"(?<=\d)\s*\\dot\b(?=\s*$)", ".", expr)
    expr = re.sub(r"(?<=\d)\s*\\dot\b(?=\s*[\)\],;])", ".", expr)

    style_group_re = re.compile(r"\{\s*\\(?:bf|rm|it|tt|sf)\s*([^{}]*)\}")
    prev = None
    while expr != prev:
        prev = expr
        expr = style_group_re.sub(lambda m: m.group(1).strip(), expr)

    expr = re.sub(r"\{\s*\\(?:bf|rm|it|tt|sf)\s*\}", "", expr)

    modern_style_group_re = re.compile(r"\{\s*\\(?:mathbf|mathrm|mathit|mathsf|mathtt)\s+([^{}]+?)\s*\}")
    prev = None
    while expr != prev:
        prev = expr
        expr = modern_style_group_re.sub(lambda m: m.group(1).strip(), expr)

    direct_modern_style_re = re.compile(r"\\(?:mathbf|mathrm|mathit|mathsf|mathtt)\s*\{\s*([^{}]+?)\s*\}")
    prev = None
    while expr != prev:
        prev = expr
        expr = direct_modern_style_re.sub(lambda m: m.group(1).strip(), expr)

    expr = re.sub(r"\\textcircled\s*\{\s*\\times\s*\}", r"\\otimes", expr)
    expr = re.sub(
        r"\\textcircled\s*\{\s*\\scriptsize\s*\{\s*\\parallel\s*\}\s*\}",
        r"\\circ",
        expr,
    )
    expr = re.sub(r"\\textcircled\s*\{\s*\\parallel\s*\}", r"\\circ", expr)
    expr = re.sub(r"\\textcircled\s*\{\s*([^{}]+?)\s*\}", r"\1", expr)

    expr = re.sub(r"\.\s+([\)\],;])", r".\1", expr)
    expr = re.sub(r"(?<=\d)\s*\.\s*(?=\d)", ".", expr)
    expr = re.sub(r"(?<=\d)\s+(?=\d)", "", expr)
    expr = re.sub(r"\s*([=+\-*/<>:,;])\s*", r" \1 ", expr)
    expr = re.sub(r"\s+", " ", expr).strip()
    if expr.startswith(("_", "^")):
        expr = "{} " + expr
    return expr


def aggressively_simplify_formula_for_latex_math(formula_text: str) -> str:
    expr = normalize_formula_for_latex_math(formula_text)
    if not expr:
        return expr

    single_arg_command_re = re.compile(r"\\([A-Za-z]+)\s*(?:\[[^\]]*])?\s*\{\s*([^{}]*)\s*\}(?!\s*\{)")
    prev = None
    while expr != prev:
        prev = expr

        def _unwrap(match: re.Match[str]) -> str:
            command = match.group(1)
            inner = match.group(2).strip()
            if command in STRUCTURAL_LATEX_COMMANDS:
                return match.group(0)
            return inner

        expr = single_arg_command_re.sub(_unwrap, expr)

    expr = re.sub(r"\s+", " ", expr).strip()
    if expr.startswith(("_", "^")):
        expr = "{} " + expr
    return expr
