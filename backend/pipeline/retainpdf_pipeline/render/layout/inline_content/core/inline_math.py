from __future__ import annotations

import re

from retainpdf_pipeline.render.layout.text_analysis import analyze_text
from retainpdf_pipeline.render.layout.text_analysis import math_token_body
from retainpdf_pipeline.render.layout.text_analysis import normalize_direct_typst_math_boundaries
from retainpdf_pipeline.render.layout.text_analysis import RAW_MATH_TOKEN_KINDS
from retainpdf_pipeline.render.layout.text_analysis import replace_non_formula_segments
from retainpdf_pipeline.render.layout.text_analysis import TextToken
from retainpdf_pipeline.render.layout.text_analysis import TextTokenKind


MARKDOWN_EMPHASIS_RE = re.compile(
    r"(?<![\\*])(?P<marker>\*\*|\*)"
    r"(?=\S)"
    r"(?P<body>[^*\n]*?\S)"
    r"(?P=marker)"
    r"(?!\*)"
)
TEXT_HEAVY_INLINE_MATH_MIN_TEXT_CHARS = 10
TEXT_HEAVY_INLINE_MATH_MIN_TEXT_BLOCKS = 2
ANGLE_EXPECTATION_RE = re.compile(
    r"\\langle\s*(?P<body>[^$]+?)\s*\\rangle(?P<script>_\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})"
)
BARE_ANGLE_EXPECTATION_RE = re.compile(
    r"\\langle\s*(?P<body>[^$]+?)\s*\\rangle"
)
LATEX_SIZED_DELIMITER_RE = re.compile(
    r"\\(?:left|right)\s*(?P<delimiter>\\langle|\\rangle|[⟨⟩|()\[\]{}.]|\\[{}])"
)


def apply_to_non_math_segments(text: str, replacer) -> str:
    return replace_non_formula_segments(text, replacer)


def escape_markdown_literal_asterisks(text: str) -> str:
    return (text or "").replace("*", r"\*")


def escape_literal_asterisks_preserving_emphasis(text: str) -> str:
    source = text or ""
    if "*" not in source:
        return source
    chunks: list[str] = []
    last_end = 0
    for match in MARKDOWN_EMPHASIS_RE.finditer(source):
        chunks.append(escape_markdown_literal_asterisks(source[last_end : match.start()]))
        chunks.append(match.group(0))
        last_end = match.end()
    chunks.append(escape_markdown_literal_asterisks(source[last_end:]))
    return "".join(chunks)


def surround_inline_math_with_spaces(markdown: str) -> str:
    text = markdown or ""
    if not text:
        return ""
    chunks: list[str] = []
    left_no_space = set("([{\"'“‘（【「『")
    right_no_space = set(".,;:!?)]}，。！？；：、（）【】「」『』")
    for token in analyze_text(text).tokens:
        if token.kind not in RAW_MATH_TOKEN_KINDS:
            chunks.append(token.value)
            continue
        expr = token.value
        prev_char = text[token.start - 1] if token.start > 0 else ""
        next_char = text[token.end] if token.end < len(text) else ""
        prefix = ""
        suffix = ""
        if prev_char and not prev_char.isspace() and prev_char not in left_no_space:
            prefix = " "
        if next_char and not next_char.isspace() and next_char not in right_no_space:
            suffix = " "
        chunks.append(f"{prefix}{expr}{suffix}")
    return re.sub(r"[ \t]{2,}", " ", "".join(chunks)).strip()


def normalize_direct_typst_inline_math_whitespace(text: str) -> str:
    source = str(text or "")
    if not source:
        return ""
    chunks: list[str] = []
    index = 0
    in_inline_math = False
    while index < len(source):
        char = source[index]
        prev_char = source[index - 1] if index > 0 else ""
        next_char = source[index + 1] if index + 1 < len(source) else ""
        if char == "$" and prev_char != "\\":
            if next_char == "$":
                chunks.append("$$")
                index += 2
                continue
            in_inline_math = not in_inline_math
            chunks.append(char)
            index += 1
            continue
        if in_inline_math and char in "\r\n":
            if not chunks or chunks[-1] != " ":
                chunks.append(" ")
            index += 1
            while index < len(source) and source[index] in "\r\n\t ":
                index += 1
            continue
        chunks.append(char)
        index += 1
    return "".join(chunks)


def _scan_latex_text_blocks(expr: str) -> list[tuple[str, str]]:
    parts: list[tuple[str, str]] = []
    index = 0
    while index < len(expr):
        start = expr.find(r"\text{", index)
        if start < 0:
            if index < len(expr):
                parts.append(("math", expr[index:]))
            break
        if start > index:
            parts.append(("math", expr[index:start]))
        cursor = start + len(r"\text{")
        depth = 1
        body_start = cursor
        while cursor < len(expr):
            char = expr[cursor]
            if char == "\\":
                cursor += 2
                continue
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    parts.append(("text", expr[body_start:cursor]))
                    cursor += 1
                    break
            cursor += 1
        else:
            parts.append(("math", expr[start:]))
            break
        index = cursor
    return parts


def _plain_text_from_latex_text(body: str) -> str:
    text = re.sub(r"\\([{}])", r"\1", body or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _math_chunk_needs_math(chunk: str) -> bool:
    text = re.sub(r"\s+", " ", chunk or "").strip()
    if not text:
        return False
    if re.fullmatch(r"[,;:，。！？、()\[\]{}（）]+", text):
        return False
    return bool(
        "\\" in text
        or re.search(r"[_^=|<>+\-*/]", text)
        or re.search(r"\b[A-Za-z]\b", text)
        or re.search(r"[Α-Ωα-ω]", text)
    )


def _normalize_math_punctuation_chunk(chunk: str) -> str:
    text = re.sub(r"\s+", " ", chunk or "").strip()
    text = re.sub(r"\s*,\s*", ", ", text)
    text = re.sub(r"\s*\)\s*", ") ", text)
    text = re.sub(r"\s*\(\s*", " (", text)
    return re.sub(r"\s{2,}", " ", text).strip()


def _append_demoted_math_chunk(chunks: list[str], chunk: str) -> None:
    text = re.sub(r"\s+", " ", chunk or "").strip()
    if not text:
        return
    leading = ""
    trailing = ""
    while text and text[0] in "([{（":
        leading += text[0]
        text = text[1:].strip()
    while text and text[-1] in ",.;:，。；：)]）":
        trailing = text[-1] + trailing
        text = text[:-1].strip()
    if leading:
        chunks.append(leading)
    if text:
        if _math_chunk_needs_math(text):
            chunks.append(f"${text}$")
        else:
            punct = _normalize_math_punctuation_chunk(text)
            if punct:
                chunks.append(punct)
    if trailing:
        chunks.append(trailing)


def _demote_text_heavy_inline_math_expr(expr: str) -> str | None:
    parts = _scan_latex_text_blocks(expr)
    text_parts = [_plain_text_from_latex_text(value) for kind, value in parts if kind == "text"]
    text_char_count = sum(len(value) for value in text_parts)
    if text_char_count < TEXT_HEAVY_INLINE_MATH_MIN_TEXT_CHARS:
        return None

    chunks: list[str] = []
    for kind, value in parts:
        if kind == "text":
            plain = _plain_text_from_latex_text(value)
            if plain:
                chunks.append(plain)
            continue
        math = re.sub(r"\s+", " ", value or "").strip()
        if not math:
            continue
        _append_demoted_math_chunk(chunks, math)
    return re.sub(r"\s{2,}", " ", " ".join(chunks)).strip() or None


def demote_text_heavy_inline_math(text: str) -> str:
    chunks: list[str] = []
    for token in analyze_text(text or "").tokens:
        if token.kind != TextTokenKind.INLINE_MATH:
            chunks.append(token.value)
            continue
        expr = math_token_body(token)
        replacement = _demote_text_heavy_inline_math_expr(expr)
        chunks.append(replacement if replacement is not None else token.value)
    return "".join(chunks)


def normalize_angle_bracket_expectation_for_mitex(expr: str) -> str:
    normalized = ANGLE_EXPECTATION_RE.sub(
        lambda match: f"⟨{match.group('body').strip()}⟩{match.group('script')}",
        expr or "",
    )
    return BARE_ANGLE_EXPECTATION_RE.sub(
        lambda match: f"⟨{match.group('body').strip()}⟩",
        normalized,
    )


def normalize_sized_delimiters_for_mitex(expr: str) -> str:
    def _replacement(match: re.Match[str]) -> str:
        delimiter = match.group("delimiter")
        if delimiter in {r"\langle", "⟨"}:
            return "⟨"
        if delimiter in {r"\rangle", "⟩"}:
            return "⟩"
        if delimiter == ".":
            return ""
        if delimiter in {r"\{", r"\}"}:
            return delimiter[-1]
        return delimiter

    return LATEX_SIZED_DELIMITER_RE.sub(_replacement, expr or "")


def sanitize_direct_typst_inline_math(text: str) -> str:
    from retainpdf_pipeline.render.layout.inline_content.fallback.latex_normalizer import (
        normalize_formula_for_latex_math,
    )

    def _sanitize_token(token: TextToken) -> str:
        is_display = token.kind == TextTokenKind.DISPLAY_MATH
        expr = math_token_body(token)
        if not expr:
            return token.value
        if expr in {"^®", "^{®}", r"^\circled{R}", r"^\textcircled{R}"}:
            return "®"
        spreadsheet_cell = re.fullmatch(r"\\([A-Za-z]{1,3})\\([0-9]{1,7})", expr)
        if spreadsheet_cell:
            return f"{spreadsheet_cell.group(1)}{spreadsheet_cell.group(2)}"
        expr = re.sub(r"\\{2,}(?=[A-Za-z])", r"\\", expr)
        expr = re.sub(r"\\langlen\b", r"\\langle n", expr)
        expr = re.sub(r"\\angle(?=[A-Za-z])", r"\\angle ", expr)
        expr = re.sub(r"\\mathscr\b", r"\\mathcal", expr)
        expr = re.sub(r"\\varPhi(?=[^A-Za-z]|$)", r"\\Phi", expr)
        expr = re.sub(r"\\hbar\b", "ℏ", expr)
        expr = re.sub(r"\\partial\b", "∂", expr)
        expr = re.sub(r"\\otimes\b", "⊗", expr)
        expr = normalize_sized_delimiters_for_mitex(expr)
        expr = normalize_angle_bracket_expectation_for_mitex(expr)
        expr = re.sub(r"\\langle\b", "⟨", expr)
        expr = re.sub(r"\\rangle\b", "⟩", expr)
        expr = normalize_sized_delimiters_for_mitex(expr)
        # Do not rewrite prefix scripts (e.g. ⟨^{N} → ⟨{}^{N}).
        # That regex treated LaTeX "\ " (backslash-space) as a delimiter and
        # corrupted temperatures like -78\ ^{\circ}\mathrm{C} into -78\{}^{\circ}...
        # Prefix-script form is owned by translation (protect / match-then-translate);
        # rendering only does light mitex-compatible delimiter/symbol cleanup.
        expr = re.sub(r"\\circled\s*\{\s*\\times\s*\}", r"\\otimes", expr)
        expr = re.sub(r"\\circled\s*\{\s*\\parallel\s*\}", r"\\circ", expr)
        expr = re.sub(r"\\circled\s*\{\s*([^{}]+?)\s*\}", r"\1", expr)
        if is_display:
            expr = normalize_formula_for_latex_math(expr)
        return f"${expr}$"

    chunks: list[str] = []
    for token in analyze_text(text or "").tokens:
        if token.kind in RAW_MATH_TOKEN_KINDS:
            chunks.append(_sanitize_token(token))
        else:
            chunks.append(token.value)
    return "".join(chunks)


def build_direct_typst_passthrough_markdown(text: str) -> str:
    normalized = normalize_direct_typst_math_boundaries(str(text or "").strip())
    normalized = normalize_direct_typst_inline_math_whitespace(normalized)
    markdown = apply_to_non_math_segments(normalized, escape_literal_asterisks_preserving_emphasis)
    markdown = sanitize_direct_typst_inline_math(markdown)
    return surround_inline_math_with_spaces(markdown)
