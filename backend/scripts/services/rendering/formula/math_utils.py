import re

from services.rendering.formula.normalizer import normalize_formula_for_latex_math
from services.translation.payload.formula_protection import re_protect_restored_formulas


def formula_map_lookup(formula_map: list[dict]) -> dict[str, str]:
    return {item["placeholder"]: item["formula_text"] for item in formula_map}


def split_protected_text(protected_text: str) -> list[str]:
    token_re = re.compile(r"(<[futnvc]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]])")
    return [part for part in token_re.split(protected_text or "") if part]


BRACKET_CITATION_RE = re.compile(r"^\[\s*(?P<body>\d+[A-Za-z]?(?:\s*[-,]\s*\d+[A-Za-z]?)*?)\s*\]$")
SUPERSCRIPT_CITATION_RE = re.compile(r"^\^\{\s*(?P<body>\d+[A-Za-z]?(?:\s*[-,]\s*\d+[A-Za-z]?)*?)\s*\}$")
SUPERSCRIPT_CHAR_MAP = str.maketrans(
    {
        "0": "⁰",
        "1": "¹",
        "2": "²",
        "3": "³",
        "4": "⁴",
        "5": "⁵",
        "6": "⁶",
        "7": "⁷",
        "8": "⁸",
        "9": "⁹",
        "-": "⁻",
        "a": "ᵃ",
        "b": "ᵇ",
        "c": "ᶜ",
        "d": "ᵈ",
        "e": "ᵉ",
        "f": "ᶠ",
        "g": "ᵍ",
        "h": "ʰ",
        "i": "ⁱ",
        "j": "ʲ",
        "k": "ᵏ",
        "l": "ˡ",
        "m": "ᵐ",
        "n": "ⁿ",
        "o": "ᵒ",
        "p": "ᵖ",
        "r": "ʳ",
        "s": "ˢ",
        "t": "ᵗ",
        "u": "ᵘ",
        "v": "ᵛ",
        "w": "ʷ",
        "x": "ˣ",
        "y": "ʸ",
        "z": "ᶻ",
    }
)


def _compact_citation_body(body: str) -> str:
    text = re.sub(r"\s+", "", body or "")
    text = re.sub(r"\s*([,-])\s*", r"\1", text)
    return text


def looks_like_citation(formula_text: str) -> bool:
    expr = " ".join(formula_text.strip().split())
    return bool(BRACKET_CITATION_RE.fullmatch(expr) or SUPERSCRIPT_CITATION_RE.fullmatch(expr))


def normalize_plain_citation(formula_text: str) -> str:
    expr = " ".join(formula_text.strip().split())
    bracket_match = BRACKET_CITATION_RE.fullmatch(expr)
    if bracket_match is not None:
        return f"[{_compact_citation_body(bracket_match.group('body'))}]"
    superscript_match = SUPERSCRIPT_CITATION_RE.fullmatch(expr)
    if superscript_match is not None:
        body = _compact_citation_body(superscript_match.group("body"))
        return body.translate(SUPERSCRIPT_CHAR_MAP)
    return formula_text.strip()


INLINE_MATH_BLOCK_RE = re.compile(r"(?<!\\)\$(?:\\.|[^$\\\n])+(?<!\\)\$")
BARE_LATEX_COMMAND_RE = re.compile(r"(?P<expr>\\[A-Za-z]+(?:\s*\{[^{}]+\})+)")
BARE_SUPERSCRIPT_CITATION_RE = re.compile(r"(?P<expr>\^\{\s*\d+[A-Za-z]?(?:\s*[-,]\s*\d+[A-Za-z]?)*\s*\})")
LEFT_RIGHT_LATEX_RE = re.compile(
    r"(?P<expr>\\left\s*(?:\\lbrack|\\rbrack|\\lbrace|\\rbrace|\\langle|\\rangle|[\[\]()])"
    r"(?:\\.|[^$\n])+?"
    r"\\right\s*(?:\\lbrack|\\rbrack|\\lbrace|\\rbrace|\\langle|\\rangle|[\[\]()]))"
)
SCRIPTED_CHEMISTRY_RE = re.compile(
    r"(?P<expr>[A-Za-z][A-Za-z0-9]*(?:\([^()\n]+\)|\{[^{}\n]+\}|\^\{[^{}\n]+\}|_\{[^{}\n]+\}|[-/])+)"
)
BRACKETED_ION_PAIR_RE = re.compile(
    r"(?P<expr>(?:\[(?=[A-Za-z])[A-Za-z][A-Za-z0-9+\-]*\]){2,})"
)
INDEXED_TOKEN_RE = re.compile(r"(?P<expr>\[[A-Za-z0-9_]+\]_[A-Za-z0-9]+)")
SUBSCRIPT_TOKEN_RE = re.compile(
    r"(?<![$A-Za-zΑ-Ωα-ωβΔ0-9_])(?P<expr>[A-Za-zΑ-Ωα-ωβΔ]+_[A-Za-z0-9]+)(?![A-Za-zΑ-Ωα-ωβΔ0-9_])"
)
SET_POWER_TOKEN_RE = re.compile(r"(?P<expr>\{[0-9,\s]+\}\^[A-Za-z0-9]+)")
INLINE_EXPR_RE = re.compile(
    r"(?P<expr>\d+(?:\.\d+)?\s*[-+]\s*[A-Za-zΑ-Ωα-ωβΔ]+_[A-Za-z0-9]+)"
)


def _normalize_text_chunk(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def _surround_inline_math_with_spaces(markdown: str) -> str:
    text = markdown or ""
    if not text:
        return ""
    chunks: list[str] = []
    last_end = 0
    left_no_space = set("([{\"'“‘")
    right_no_space = set(".,;:!?)]}，。！？；：、）】」』")
    for match in INLINE_MATH_BLOCK_RE.finditer(text):
        chunks.append(text[last_end:match.start()])
        expr = match.group(0)
        prev_char = text[match.start() - 1] if match.start() > 0 else ""
        next_char = text[match.end()] if match.end() < len(text) else ""
        prefix = ""
        suffix = ""
        if prev_char and not prev_char.isspace() and prev_char not in left_no_space:
            prefix = " "
        if next_char and not next_char.isspace() and next_char not in right_no_space:
            suffix = " "
        chunks.append(f"{prefix}{expr}{suffix}")
        last_end = match.end()
    chunks.append(text[last_end:])
    return re.sub(r"[ \t]{2,}", " ", "".join(chunks)).strip()


def _normalize_math_candidate(expr: str) -> str:
    return normalize_formula_for_latex_math(expr.strip())


def _wrap_math_candidate(match: re.Match[str]) -> str:
    return f"${_normalize_math_candidate(match.group('expr'))}$"


def _wrap_raw_math_candidate(match: re.Match[str]) -> str:
    return f"${match.group('expr').strip()}$"


def _wrap_indexed_math_candidate(match: re.Match[str]) -> str:
    expr = match.group("expr").strip()
    expr = re.sub(r"_([A-Za-z0-9]+)$", r"_{\1}", expr)
    return f"${expr}$"


def _apply_to_non_math_segments(text: str, replacer) -> str:
    chunks: list[str] = []
    last_end = 0
    for match in INLINE_MATH_BLOCK_RE.finditer(text):
        plain = text[last_end : match.start()]
        if plain:
            chunks.append(replacer(plain))
        chunks.append(match.group(0))
        last_end = match.end()
    tail = text[last_end:]
    if tail:
        chunks.append(replacer(tail))
    return "".join(chunks)


def _sanitize_existing_inline_math_for_markdown(text: str) -> str:
    def _replace(match: re.Match[str]) -> str:
        expr = match.group(0)[1:-1].strip()
        if not expr:
            return match.group(0)
        if looks_like_citation(expr):
            return normalize_plain_citation(expr)
        expr = re.sub(r"\\angle(?=[A-Za-z])", r"\\angle ", expr)
        expr = re.sub(r"\\mathscr\b", r"\\mathcal", expr)
        return f"${expr}$"

    return INLINE_MATH_BLOCK_RE.sub(_replace, text or "")


def _normalize_plain_segment_for_math(text: str) -> str:
    return re.sub(r"\\{2,}(?=[A-Za-z])", r"\\", text or "")


def _escape_markdown_literal_asterisks(text: str) -> str:
    return (text or "").replace("*", r"\*")


def promote_inline_math_like_text(text: str) -> str:
    if not text:
        return ""

    promoted = _apply_to_non_math_segments(text, _normalize_plain_segment_for_math)
    promoted = _apply_to_non_math_segments(promoted, lambda plain: BARE_SUPERSCRIPT_CITATION_RE.sub(_wrap_raw_math_candidate, plain))
    promoted = _apply_to_non_math_segments(promoted, lambda plain: LEFT_RIGHT_LATEX_RE.sub(_wrap_math_candidate, plain))
    promoted = _apply_to_non_math_segments(promoted, lambda plain: BARE_LATEX_COMMAND_RE.sub(_wrap_math_candidate, plain))
    promoted = _apply_to_non_math_segments(promoted, lambda plain: SCRIPTED_CHEMISTRY_RE.sub(_wrap_math_candidate, plain))
    promoted = _apply_to_non_math_segments(promoted, lambda plain: BRACKETED_ION_PAIR_RE.sub(_wrap_raw_math_candidate, plain))
    promoted = _apply_to_non_math_segments(promoted, lambda plain: INDEXED_TOKEN_RE.sub(_wrap_indexed_math_candidate, plain))
    promoted = _apply_to_non_math_segments(promoted, lambda plain: INLINE_EXPR_RE.sub(_wrap_raw_math_candidate, plain))
    promoted = _apply_to_non_math_segments(promoted, lambda plain: SUBSCRIPT_TOKEN_RE.sub(_wrap_raw_math_candidate, plain))
    promoted = _apply_to_non_math_segments(promoted, lambda plain: SET_POWER_TOKEN_RE.sub(_wrap_raw_math_candidate, plain))
    promoted = _apply_to_non_math_segments(promoted, _escape_markdown_literal_asterisks)
    return promoted


def build_markdown_from_direct_text(
    text: str,
    *,
    aggressive_math_promotion: bool = True,
    normalize_existing_inline_math: bool = False,
) -> str:
    markdown = _normalize_text_chunk(text)
    if aggressive_math_promotion:
        markdown = promote_inline_math_like_text(markdown)
    else:
        markdown = _apply_to_non_math_segments(
            markdown,
            lambda plain: _escape_markdown_literal_asterisks(_normalize_plain_segment_for_math(plain)),
        )
    if normalize_existing_inline_math:
        markdown = _sanitize_existing_inline_math_for_markdown(markdown)
    markdown = _surround_inline_math_with_spaces(markdown)
    markdown = re.sub(
        r"\\textcircled\s*\{\s*\\scriptsize\s*\{\s*\\parallel\s*\}\s*\}",
        r"$\\circ$",
        markdown,
    )
    markdown = re.sub(r"\\textcircled\s*\{\s*\\parallel\s*\}", r"$\\circ$", markdown)
    markdown = re.sub(r"\\textcircled\s*\{\s*\\times\s*\}", r"$\\otimes$", markdown)
    return markdown


def build_markdown_paragraph(item: dict) -> str:
    protected = item.get("protected_translated_text") or item.get("protected_source_text", "")
    if str(item.get("math_mode", "placeholder") or "placeholder").strip() == "direct_typst":
        return build_direct_typst_passthrough_text(protected)
    return build_markdown_from_parts(
        protected,
        item.get("formula_map", []),
    )


def build_direct_typst_passthrough_text(text: str) -> str:
    markdown = _apply_to_non_math_segments(str(text or "").strip(), _escape_markdown_literal_asterisks)
    markdown = _sanitize_existing_inline_math_for_markdown(markdown)
    return _surround_inline_math_with_spaces(markdown)


def build_markdown_from_parts(
    protected: str,
    formula_map: list[dict],
) -> str:
    if not formula_map:
        return build_markdown_from_direct_text(
            protected or "",
        )
    protected = re_protect_restored_formulas(protected or "", formula_map)
    parts = split_protected_text(protected)
    formula_lookup = formula_map_lookup(formula_map)
    chunks: list[str] = []

    for part in parts:
        if part in formula_lookup:
            formula_text = formula_lookup.get(part, part)
            if looks_like_citation(formula_text):
                chunks.append(normalize_plain_citation(formula_text))
                continue
            chunks.append(f"${normalize_formula_for_latex_math(formula_text)}$")
        else:
            text = _normalize_text_chunk(part)
            if text:
                chunks.append(text)

    markdown = "".join(chunks).strip()
    return build_markdown_from_direct_text(markdown)


def build_plain_text(item: dict) -> str:
    text = (item.get("translated_text") or item.get("source_text") or "").strip()
    return build_plain_text_from_text(text)


def build_plain_text_from_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())
