from __future__ import annotations

import re

from retainpdf_pipeline.services.pipeline_shared.direct_typst_math import is_fullwidth_punctuation
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

# 埃符号。mitex 0.2.7 在文本组里把 `\AA` / `\aa` / `\r{A}` / `\mathring{A}` 翻成
# Typst 代码 `circle(A)` / `circle[A];` / `mathring[A];` 却不求值，页面上印出字面的
# "circle(A)"；数学模式里 `\AA` 出成斜体 𝐴̊，`\aa` 更是出成大写 𝐴̊。Unicode 的 Å / å
# 在两种模式下都按正体原样输出，所以统一改写成字符本身。控制词后面的 `{}` 一并吃掉；
# 后面的空格保留（LaTeX 会吞掉它，但译文里 `1 \AA thick` 想要的显然是带空格）。
_ANGSTROM_COMMAND_RE = re.compile(r"\\(AA|aa)(?![A-Za-z])(?:\{\})?")
_RING_ACCENT_RE = re.compile(r"\\r(?:\s*\{\s*([Aa])\s*\}|\s+([Aa])(?![A-Za-z]))")
# `\mathring{A}` 只在文本组里改写：数学模式下 mitex 渲染正确，而且它常常是「集合 A 的
# 内部」这类数学记号，不是埃。
_MATHRING_A_RE = re.compile(r"\\mathring(?:\s*\{\s*([Aa])\s*\}|\s+([Aa])(?![A-Za-z]))")
_LATEX_TEXT_GROUP_RE = re.compile(r"\\(?:text|textrm|textup|textnormal|textit|textbf|textsf|texttt)\s*\{")
_ANGSTROM_BY_LETTER = {"A": "Å", "a": "å"}


def _ring_letter(match: re.Match[str]) -> str:
    return _ANGSTROM_BY_LETTER[match.group(1) or match.group(2)]


def _replace_angstrom_commands(text: str) -> str:
    text = _ANGSTROM_COMMAND_RE.sub(lambda match: _ANGSTROM_BY_LETTER[match.group(1)[0]], text)
    return _RING_ACCENT_RE.sub(_ring_letter, text)


def _replace_in_latex_text_groups(expr: str, replacer) -> str:
    chunks: list[str] = []
    index = 0
    while True:
        match = _LATEX_TEXT_GROUP_RE.search(expr, index)
        if match is None:
            chunks.append(expr[index:])
            return "".join(chunks)
        body_start = match.end()
        cursor = body_start
        depth = 1
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
                    break
            cursor += 1
        if depth != 0:
            chunks.append(expr[index:])
            return "".join(chunks)
        chunks.append(expr[index:body_start])
        chunks.append(replacer(expr[body_start:cursor]))
        index = cursor


def normalize_angstrom_in_math(expr: str) -> str:
    if "\\" not in (expr or ""):
        return expr
    expr = _replace_in_latex_text_groups(expr, lambda body: _MATHRING_A_RE.sub(_ring_letter, body))
    return _replace_angstrom_commands(expr)


def normalize_angstrom_in_text(text: str) -> str:
    # 公式外的 `\AA` cmarker 原样印出反斜杠。这里只认 `\AA` / `\aa`：散文里的 `\r`
    # 可能是别的东西（路径、转义残片），不碰。
    if "\\" not in (text or ""):
        return text
    return _ANGSTROM_COMMAND_RE.sub(lambda match: _ANGSTROM_BY_LETTER[match.group(1)[0]], text)


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
    after_math = False
    for token in analyze_text(text).tokens:
        if token.kind not in RAW_MATH_TOKEN_KINDS:
            chunks.append(token.value)
            if after_math and token.value.strip():
                # 全角标点和公式之间不留空格（「$x$ 。」→「$x$。」）。分词器可能把空格单切一段，
                # 所以看的是公式之后拼起来的整段，而不是单个片段。
                tail_index = after_math_index
                tail = "".join(chunks[tail_index:])
                if tail[:1] in (" ", "\t") and is_fullwidth_punctuation(tail.lstrip(" \t")[:1]):
                    chunks[tail_index:] = [tail.lstrip(" \t")]
                after_math = False
            continue
        expr = token.value
        # 同上，公式前面（「， $x$」→「，$x$」）。
        joined = "".join(chunks)
        stripped = joined.rstrip(" \t")
        if stripped != joined and is_fullwidth_punctuation(stripped[-1:]):
            chunks = [stripped]
            joined = stripped
        prev_char = joined[-1:] if joined else ""
        next_char = text[token.end] if token.end < len(text) else ""
        prefix = ""
        suffix = ""
        if (
            prev_char and not prev_char.isspace() and prev_char not in left_no_space
            and not is_fullwidth_punctuation(prev_char)
        ):
            prefix = " "
        next_visible = text[token.end:].lstrip(" \t")[:1]
        if (
            next_char and not next_char.isspace() and next_char not in right_no_space
            and not is_fullwidth_punctuation(next_char)
        ):
            suffix = " "
        chunks.append(f"{prefix}{expr}{suffix}")
        after_math = bool(next_visible)
        after_math_index = len(chunks)
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


def sanitize_direct_typst_inline_math(text: str) -> str:
    from retainpdf_pipeline.render.layout.inline_content.fallback.latex_normalizer import (
        normalize_formula_for_latex_math,
    )

    from retainpdf_pipeline.foundation.shared.latex_source_repair import (
        collapse_doubled_command_backslashes,
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
        # 这三条修的是 OCR / 模型产物，不是 mitex 的能力缺口，所以留着。
        # 第一条曾经是无条件的，把矩阵/cases 的换行符 `\\` 也合并掉，自己制造了
        # `unknown command: \b`——约束和缘由都在 latex_source_repair 里。
        expr = collapse_doubled_command_backslashes(expr)
        expr = re.sub(r"\\langlen\b", r"\\langle n", expr)
        expr = re.sub(r"\\angle(?=[A-Za-z])", r"\\angle ", expr)
        # Do not rewrite prefix scripts (e.g. ⟨^{N} → ⟨{}^{N}).
        # That regex treated LaTeX "\ " (backslash-space) as a delimiter and
        # corrupted temperatures like -78\ ^{\circ}\mathrm{C} into -78\{}^{\circ}...
        # Prefix-script form is owned by translation (protect / match-then-translate);
        # rendering only does light mitex-compatible delimiter/symbol cleanup.
        expr = re.sub(r"\\circled\s*\{\s*\\times\s*\}", r"\\otimes", expr)
        expr = re.sub(r"\\circled\s*\{\s*\\parallel\s*\}", r"\\circ", expr)
        expr = re.sub(r"\\circled\s*\{\s*([^{}]+?)\s*\}", r"\1", expr)
        expr = normalize_angstrom_in_math(expr)
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
    markdown = apply_to_non_math_segments(
        normalized,
        lambda segment: escape_literal_asterisks_preserving_emphasis(normalize_angstrom_in_text(segment)),
    )
    markdown = sanitize_direct_typst_inline_math(markdown)
    return surround_inline_math_with_spaces(markdown)
