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

STYLE_WRAPPER_MACROS = r"(?:bf|rm|it|sf|tt|pmb|mathbf|mathrm|mathit|mathsf|mathtt)"
LEGACY_LAYOUT_WRAPPER_MACROS = r"(?:smash|mbox|hbox|vbox|fbox|textnormal|textrm|textsf|texttt)"


def _unwrap_style_wrappers(expr: str) -> str:
    group_prefixed_re = re.compile(r"\{\s*\\" + STYLE_WRAPPER_MACROS + r"\s+([^{}]+?)\s*\}")
    direct_group_re = re.compile(r"\\" + STYLE_WRAPPER_MACROS + r"\s*\{\s*([^{}]+?)\s*\}")

    prev = None
    while expr != prev:
        prev = expr
        expr = group_prefixed_re.sub(lambda m: m.group(1).strip(), expr)
        expr = direct_group_re.sub(lambda m: m.group(1).strip(), expr)
    return expr


def _find_balanced_group(text: str, start: int) -> tuple[str, int]:
    if start >= len(text) or text[start] != "{":
        raise ValueError("expected {")
    depth = 0
    for idx in range(start, len(text)):
        if text[idx] == "{":
            depth += 1
        elif text[idx] == "}":
            depth -= 1
            if depth == 0:
                return text[start + 1 : idx], idx + 1
    raise ValueError("unbalanced braces")


def _unwrap_named_macros(expr: str, macro_names: set[str]) -> str:
    out: list[str] = []
    i = 0
    while i < len(expr):
        if expr[i] == "\\":
            j = i + 1
            while j < len(expr) and expr[j].isalpha():
                j += 1
            macro_name = expr[i + 1 : j]
            if macro_name in macro_names:
                k = j
                while k < len(expr) and expr[k].isspace():
                    k += 1
                if k < len(expr) and expr[k] == "{":
                    inner, end = _find_balanced_group(expr, k)
                    out.append(normalize_formula_for_latex_math(inner))
                    i = end
                    continue
        out.append(expr[i])
        i += 1
    return "".join(out)


def _unwrap_legacy_layout_wrappers(expr: str) -> str:
    return _unwrap_named_macros(
        expr,
        {
            "smash",
            "mbox",
            "hbox",
            "vbox",
            "fbox",
            "textnormal",
            "textrm",
            "textsf",
            "texttt",
        },
    )


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
    expr = re.sub(r"\\Vec\b", r"\\vec", expr)
    expr = re.sub(r"\\bf\b", r"\\mathbf", expr)
    expr = re.sub(r"\\pmb\b", r"\\mathbf", expr)
    expr = re.sub(r"\\rm\b", r"\\mathrm", expr)
    expr = re.sub(r"\\it\b", r"\\mathit", expr)
    expr = re.sub(r"\\sf\b", r"\\mathsf", expr)
    expr = re.sub(r"\\tt\b", r"\\mathtt", expr)
    expr = re.sub(r"\\textsuperscript\s*\{\s*([^{}]+?)\s*\}", r"^{\1}", expr)
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

    expr = _unwrap_style_wrappers(expr)
    expr = _unwrap_legacy_layout_wrappers(expr)
    expr = re.sub(r"\{\s*\\(?:bf|rm|it|tt|sf|pmb)\s*\}", "", expr)

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
