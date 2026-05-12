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

STYLE_WRAPPER_MACROS = r"(?:pmb|bf|rm|it|sf|tt|em)"
LEGACY_LAYOUT_WRAPPER_MACROS = r"(?:smash|mbox|hbox|vbox|fbox|textnormal|textrm|textsf|texttt)"


def _strip_trailing_formula_punctuation(expr: str) -> str:
    return re.sub(r"\s*([,.;:])\s*$", "", expr)


def _compact_mathrm_payload(expr: str) -> str:
    def _collapse_mathrm_letters(match: re.Match[str]) -> str:
        inner = match.group(1)
        collapsed = re.sub(r"\s+", "", inner)
        return f"\\mathrm{{{collapsed}}}"

    expr = re.sub(
        r"\\mathrm\s*\{\s*\{\s*([A-Za-z0-9](?:\s+[A-Za-z0-9])+)\s*\}\s*\}",
        _collapse_mathrm_letters,
        expr,
    )
    expr = re.sub(
        r"\\mathrm\s*\{\s*([A-Za-z0-9](?:\s+[A-Za-z0-9])+)\s*\}",
        _collapse_mathrm_letters,
        expr,
    )
    return expr


def _repair_common_ocr_formula_noise(expr: str) -> str:
    expr = re.sub(r"\bC\s*0\s*0\s*H(?=\s*\^\s*\{\s*\*\s*\})", "COOH", expr)

    def _compact_superscript_mathrm(match: re.Match[str]) -> str:
        superscript = re.sub(r"\s+", "", match.group(2))
        return rf"\mathrm{{{match.group(1)}^{{{superscript}}}}}"

    expr = re.sub(
        r"\\mathrm\s*\{\s*([A-Za-z0-9]+)\s*\^\s*\{\s*([^{}]+?)\s*\}\s*\}",
        _compact_superscript_mathrm,
        expr,
    )
    expr = re.sub(r"(?<=\d)\s*\.\s*(?=\d)", ".", expr)
    expr = re.sub(r"(?<=\d)\s+(?=\d)", "", expr)
    expr = re.sub(r"~\s*\\mathrm\s*\{\s*e\s*V\s*\}\s*\.?", r" \\mathrm{eV}", expr)
    expr = re.sub(r"\\vec\s*\{\s*([A-Za-z])\s*\}", r"\1", expr)
    expr = re.sub(r"\\bf\s*\{\s*([A-Za-z0-9\-+*/]+)\s*\}", r"\1", expr)
    expr = re.sub(r"\{\s*\\bf\s+([^{}]+?)\s*\}", r"{\1}", expr)
    expr = re.sub(r"^\{\s*([A-Za-z])\s*\}(?=\s+\{)", r"\1", expr)
    expr = _strip_trailing_formula_punctuation(expr)
    return expr


def _unwrap_style_wrappers(expr: str) -> str:
    group_prefixed_re = re.compile(r"\{\s*\\" + STYLE_WRAPPER_MACROS + r"\s+([^{}]+?)\s*\}")
    direct_group_re = re.compile(r"\\" + STYLE_WRAPPER_MACROS + r"\s*\{\s*([^{}]+?)\s*\}")

    prev = None
    while expr != prev:
        prev = expr
        expr = group_prefixed_re.sub(lambda m: "{" + m.group(1).strip() + "}", expr)
        expr = direct_group_re.sub(lambda m: "{" + m.group(1).strip() + "}", expr)
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


def _unwrap_inline_text_wrappers(expr: str) -> str:
    return _unwrap_named_macros(expr, {"textbf", "textit", "emph", "em"})


def _compact_script_groups(expr: str) -> str:
    prev = None
    while expr != prev:
        prev = expr
        expr = re.sub(
            r"_\s*\{\s*([^{}]+?)\s*\}",
            lambda m: "_{" + _compact_script_groups(m.group(1).strip()) + "}",
            expr,
        )
        expr = re.sub(
            r"\^\s*\{\s*([^{}]+?)\s*\}",
            lambda m: "^{" + _compact_script_groups(m.group(1).strip()) + "}",
            expr,
        )
        expr = re.sub(r"(?<=[A-Za-z0-9\}\)\]])\s*_\s*([A-Za-z0-9*+\-]+)", r"_\1", expr)
        expr = re.sub(r"(?<=[A-Za-z0-9\}\)\]])\s*\^\s*([A-Za-z0-9*+\-]+)", r"^\1", expr)
        expr = re.sub(r"(?<=[A-Za-z0-9\}\)\]])\s*\^\s*(\\[A-Za-z]+)", r"^\1", expr)
        expr = re.sub(r"(\\[A-Za-z]+|[A-Za-z0-9\}\)\]])\s+(_\{[^{}]*\})", r"\1\2", expr)
        expr = re.sub(r"(\\[A-Za-z]+|[A-Za-z0-9\}\)\]])\s+(\^\{[^{}]*\})", r"\1\2", expr)
        expr = re.sub(r"\^\s+\*", r"^*", expr)
    return expr


def _compact_letter_hyphen_runs(expr: str) -> str:
    prev = None
    while expr != prev:
        prev = expr
        expr = re.sub(
            r"(?P<left>(?:\\[A-Za-z]+|[A-Za-z])[A-Za-z0-9]*)\s*-\s*(?P<right>(?:\\[A-Za-z]+|[A-Za-z])[A-Za-z0-9]*)",
            r"\g<left>-\g<right>",
            expr,
        )
    return expr


def normalize_formula_for_latex_math(formula_text: str) -> str:
    expr = " ".join(formula_text.strip().split())
    if not expr:
        return expr

    expr = re.sub(r"\\begin\{array\}\s*\{[^{}]*\}\s*", "", expr)
    expr = re.sub(r"\s*\\end\{array\}", "", expr)
    expr = re.sub(r"\\cal\s+([A-Za-z])", r"\\mathcal{\1}", expr)
    expr = re.sub(r"\\mathscr\b", r"\\mathcal", expr)
    expr = re.sub(r"\\rrangle\b", r"\\rangle", expr)
    expr = re.sub(r"\\llangle\b", r"\\langle", expr)
    expr = re.sub(r"\\Breve\b", r"\\breve", expr)
    expr = re.sub(r"\\Vec\b", r"\\vec", expr)
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

    expr = _compact_mathrm_payload(expr)

    expr = re.sub(r"(?<=\d)\s*\\dot\b(?=\s*$)", ".", expr)
    expr = re.sub(r"(?<=\d)\s*\\dot\b(?=\s*[\)\],;])", ".", expr)

    expr = _unwrap_style_wrappers(expr)
    expr = _unwrap_legacy_layout_wrappers(expr)
    expr = _unwrap_inline_text_wrappers(expr)
    expr = re.sub(r"\{\s*\\(?:bf|rm|it|tt|sf|pmb)\s*\}", "", expr)
    expr = re.sub(r"^\{\s*([^{}]+?)\s*\}$", r"\1", expr)

    expr = _repair_common_ocr_formula_noise(expr)
    expr = _compact_script_groups(expr)
    expr = _compact_letter_hyphen_runs(expr)
    expr = re.sub(r"\.\s+([\)\],;])", r".\1", expr)
    expr = re.sub(r"(?<=\d)\s*\.\s*(?=\d)", ".", expr)
    expr = re.sub(r"(?<=\d)\s+(?=\d)", "", expr)
    expr = re.sub(r"\s*([=+*/<>:,;])\s*", r" \1 ", expr)
    expr = re.sub(
        r"(?P<left>(?:\d+|[)\]}]|\\[A-Za-z]+))\s*-\s*(?P<right>(?:\d+|[(\[{]|\\[A-Za-z]+))",
        r"\g<left> - \g<right>",
        expr,
    )
    expr = _compact_script_groups(expr)
    expr = re.sub(r"(?<=\^)\s+([*+\-])", r"\1", expr)
    expr = re.sub(r"\^([*+\-])\s+(?=[}\)])", r"^\1", expr)
    expr = re.sub(r"\s+", " ", expr).strip()
    expr = re.sub(r"\\mathrm\s*\{\s*COOH\s*\^\s*\{\s*\*\s*\}\s*\}", r"\\mathrm{COOH^{*}}", expr)
    expr = re.sub(r"^([_^])\{([^{}]+)\}$", r"\1{{\2}}", expr)
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
