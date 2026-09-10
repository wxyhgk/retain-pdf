"""direct_typst 译文的机械格式规整。

direct_typst 模式让模型直接输出 `$...$` inline LaTeX(渲染时由 mitex 解析)。
模型可靠地完成语义任务(识别公式、翻译、修复 OCR 损伤),但偶尔违反机械格式
规则:`$...$` 与正文紧贴、相邻公式 `$..$$..$`、双反斜杠命令。这些规则在 `$`
边界存在的前提下是确定性文本操作,由本模块在翻译时统一保证(验证前、入缓存
前),而不是靠提示词要求模型自律。

`$` 扫描语义对齐渲染层 tokenizer(render/layout/text_tokens.py),
使翻译时规整与渲染时 passthrough 对跨度边界的判定一致。渲染层既有的规整链
(surround_inline_math_with_spaces 等)保持不动,作为旧缓存条目的幂等兜底。
本模块必须保持零依赖:translation 与 rendering 都可以 import pipeline_shared,
但二者不能互相 import。
"""

from __future__ import annotations

import re

MAX_INLINE_MATH_CHARS = 1200

_LEFT_NO_SPACE = set("([{\"'“‘（【「『")
_RIGHT_NO_SPACE = set(".,;:!?)]}，。！？；：、（）【】「」『』")
_DOUBLE_BACKSLASH_COMMAND_RE = re.compile(r"\\{2,}(?=[A-Za-z])")
_MULTI_SPACE_RE = re.compile(r"[ \t]{2,}")


def _is_cjk_char(char: str) -> bool:
    if not char:
        return False
    code = ord(char)
    return 0x3400 <= code <= 0x4DBF or 0x4E00 <= code <= 0x9FFF or 0x3000 <= code <= 0x303F or 0xFF00 <= code <= 0xFFEF


def _is_escaped(text: str, index: int) -> bool:
    backslashes = 0
    cursor = index - 1
    while cursor >= 0 and text[cursor] == "\\":
        backslashes += 1
        cursor -= 1
    return backslashes % 2 == 1


def has_balanced_unescaped_dollars(text: str) -> bool:
    source = text or ""
    count = sum(
        1
        for index, char in enumerate(source)
        if char == "$" and not _is_escaped(source, index)
    )
    return count % 2 == 0


def _match_display_math(text: str, index: int) -> int:
    if not text.startswith("$$", index) or _is_escaped(text, index):
        return index
    cursor = index + 2
    while cursor + 1 < len(text):
        if text[cursor] == "\\":
            cursor += 2
            continue
        if text.startswith("$$", cursor):
            return cursor + 2
        cursor += 1
    return index


def _match_inline_math(text: str, index: int) -> int:
    if (
        text[index] != "$"
        or text.startswith("$$", index)
        or _is_escaped(text, index)
        or index + 1 >= len(text)
    ):
        return index
    cursor = index + 1
    while cursor < len(text):
        if cursor - index > MAX_INLINE_MATH_CHARS:
            return index
        char = text[cursor]
        if char == "\n":
            return index
        if char == "\\":
            cursor += 2
            continue
        if char == "$":
            body = text[index + 1 : cursor].strip()
            return cursor + 1 if body else index
        cursor += 1
    return index


def _scan_math_spans(text: str) -> list[tuple[int, int, bool]]:
    spans: list[tuple[int, int, bool]] = []
    index = 0
    while index < len(text):
        if text[index] == "$":
            end = _match_display_math(text, index)
            if end > index:
                spans.append((index, end, True))
                index = end
                continue
            end = _match_inline_math(text, index)
            if end > index:
                spans.append((index, end, False))
                index = end
                continue
        index += 1
    return spans


def _collapse_newlines_inside_inline_math(text: str) -> str:
    # 对齐渲染层 normalize_direct_typst_inline_math_whitespace:inline 数学
    # 内的换行会让扫描器拒绝识别该跨度,必须先折叠成空格再扫描。
    chunks: list[str] = []
    index = 0
    in_inline_math = False
    while index < len(text):
        char = text[index]
        next_char = text[index + 1] if index + 1 < len(text) else ""
        if char == "$" and not _is_escaped(text, index):
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
            while index < len(text) and text[index] in "\r\n\t ":
                index += 1
            continue
        chunks.append(char)
        index += 1
    return "".join(chunks)


def _normalize_math_body(value: str, *, display: bool) -> str:
    marker = "$$" if display else "$"
    body = value[len(marker) : len(value) - len(marker)]
    body = _DOUBLE_BACKSLASH_COMMAND_RE.sub(r"\\", body)
    return f"{marker}{body}{marker}"


def normalize_direct_typst_translation(text: str) -> str:
    source = str(text or "")
    if not source or "$" not in source:
        return source
    if not has_balanced_unescaped_dollars(source):
        # 定界符不平衡属于结构性损坏,交给 math_delimiter_unbalanced 验证和
        # LLM 修复处理原始文本,不在残缺输入上做规整。
        return source
    source = _collapse_newlines_inside_inline_math(source)
    spans = _scan_math_spans(source)
    if not spans:
        return source
    chunks: list[str] = []
    last_end = 0
    prev_span_end = -1
    for start, end, display in spans:
        chunks.append(source[last_end:start])
        expr = _normalize_math_body(source[start:end], display=display)
        prev_char = source[start - 1] if start > 0 else ""
        next_char = source[end] if end < len(source) else ""
        # 只修确定是违规的紧贴:跨度紧邻中文正文,或两个公式跨度直接相邻
        # ($a$$b$)。ASCII 相邻不动——译文里可能出现字面 $ 变量(如 $rem),
        # 扫描器会把 `$rem ... $` 误判成跨度,补空格会破坏字面文本。
        prefix = " " if (_is_cjk_char(prev_char) and prev_char not in _LEFT_NO_SPACE) or start == prev_span_end else ""
        suffix = " " if _is_cjk_char(next_char) and next_char not in _RIGHT_NO_SPACE else ""
        chunks.append(f"{prefix}{expr}{suffix}")
        last_end = end
        prev_span_end = end
    chunks.append(source[last_end:])
    return _MULTI_SPACE_RE.sub(" ", "".join(chunks))


# mitex 不兼容写法数据库:与渲染层 sanitize_direct_typst_inline_math 的
# 改写规则对应(services/rendering/layout/inline_content/core/inline_math.py)。
# 用途:翻译前扫描源文本,匹配到哪条就把哪条提示给模型,由模型在语义层
# 完成替换——复杂公式里正则改写必然出错,但"检测某命令出现过"是可靠的。
# 渲染期正则改写保留作兜底。
MITEX_REWRITE_DATABASE: tuple[tuple[str, str], ...] = (
    (r"\hbar", "ℏ"),
    (r"\partial", "∂"),
    (r"\otimes", "⊗"),
    (r"\mathscr", r"\mathcal"),
    (r"\varPhi", r"\Phi"),
    (r"\langle", "⟨"),
    (r"\rangle", "⟩"),
    (r"\circled", r"\otimes 或普通字符"),
)


def find_mitex_rewrites(text: str) -> list[tuple[str, str]]:
    source = str(text or "")
    if "\\" not in source:
        return []
    matched: list[tuple[str, str]] = []
    for command, preferred in MITEX_REWRITE_DATABASE:
        if re.search(re.escape(command) + r"(?![A-Za-z])", source):
            matched.append((command, preferred))
    return matched


__all__ = [
    "MITEX_REWRITE_DATABASE",
    "find_mitex_rewrites",
    "has_balanced_unescaped_dollars",
    "normalize_direct_typst_translation",
]
