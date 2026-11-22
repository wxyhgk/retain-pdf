from __future__ import annotations

import re

from retainpdf_math.render_prep import normalize_angstrom_in_text
from retainpdf_math.render_prep import prepare_formula_for_render

from retainpdf_math.direct_typst import is_fullwidth_punctuation
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


# 只有上标的行内公式：$^{14}$、${}^{1,2}$、$^\dagger$、$^{a}$（注释号、参考文献号）
_PURE_SUPERSCRIPT_RE = re.compile(r"^\$\s*(?:\{\})?\^\s*(?:\{[0-9a-z,\-–*†‡§\\dagger\\ddagger\s]+\}|[0-9a-z*]|\\dagger|\\ddagger)\s*\$$")


def is_pure_superscript(expr: str) -> bool:
    return bool(_PURE_SUPERSCRIPT_RE.match(str(expr or "").strip()))


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
        if is_pure_superscript(expr):
            # 注释号这类纯上标贴着前后文字，不补空格（「刚度”。¹ 力场」→「刚度”。¹力场」，2026-11-22）
            chunks.append(expr)
            after_math = False
            continue
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
    def _sanitize_token(token: TextToken) -> str:
        expr = math_token_body(token)
        if not expr:
            return token.value
        # 公式级的改写（OCR 修补、渲染器写法兼容、埃符号……）在 retainpdf_math.render_prep：
        # 翻译阶段的公式渲染检查用同一份规则，检查的就是这里交给渲染器的样子。
        prepared, still_math = prepare_formula_for_render(expr, display=token.kind == TextTokenKind.DISPLAY_MATH)
        return f"${prepared}$" if still_math else prepared

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
