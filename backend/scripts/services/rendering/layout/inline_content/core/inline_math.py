from __future__ import annotations

import re


INLINE_MATH_BLOCK_RE = re.compile(r"(?<!\\)\$(?:\\.|[^$\\\n])+(?<!\\)\$")
MARKDOWN_EMPHASIS_RE = re.compile(
    r"(?<![\\*])(?P<marker>\*\*|\*)"
    r"(?=\S)"
    r"(?P<body>[^*\n]*?\S)"
    r"(?P=marker)"
    r"(?!\*)"
)


def apply_to_non_math_segments(text: str, replacer) -> str:
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


def sanitize_direct_typst_inline_math(text: str) -> str:
    def _replace(match: re.Match[str]) -> str:
        expr = match.group(0)[1:-1].strip()
        if not expr:
            return match.group(0)
        expr = re.sub(r"\\angle(?=[A-Za-z])", r"\\angle ", expr)
        expr = re.sub(r"\\mathscr\b", r"\\mathcal", expr)
        return f"${expr}$"

    return INLINE_MATH_BLOCK_RE.sub(_replace, text or "")


def build_direct_typst_passthrough_markdown(text: str) -> str:
    markdown = apply_to_non_math_segments(str(text or "").strip(), escape_literal_asterisks_preserving_emphasis)
    markdown = sanitize_direct_typst_inline_math(markdown)
    return surround_inline_math_with_spaces(markdown)
