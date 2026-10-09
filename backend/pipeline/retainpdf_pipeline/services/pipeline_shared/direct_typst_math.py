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
import unicodedata

from retainpdf_pipeline.foundation.shared.latex_commands import mitex_rewrite_database
from retainpdf_pipeline.foundation.shared.latex_source_repair import (
    collapse_doubled_command_backslashes,
)

MAX_INLINE_MATH_CHARS = 1200

_LEFT_NO_SPACE = set("([{\"'“‘（【「『")
_RIGHT_NO_SPACE = set(".,;:!?)]}，。！？；：、（）【】「」『』")
_MULTI_SPACE_RE = re.compile(r"[ \t]{2,}")


def _is_cjk_char(char: str) -> bool:
    if not char:
        return False
    code = ord(char)
    return 0x3400 <= code <= 0x4DBF or 0x4E00 <= code <= 0x9FFF or 0x3000 <= code <= 0x303F or 0xFF00 <= code <= 0xFFEF


def is_fullwidth_punctuation(char: str) -> bool:
    """全角 / 中文标点（，。、；：？！（）「」…）。它们自带字面留白，和公式之间不该再加空格：
    「， $x$」排出来是一道明显的空隙（31 本书里有 319 块这样）。"""
    if not char or len(char) != 1:
        return False
    code = ord(char)
    if not (0x3000 <= code <= 0x303F or 0xFF00 <= code <= 0xFFEF):
        return False
    return unicodedata.category(char).startswith("P")


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
    body = collapse_doubled_command_backslashes(body)
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
        before = source[last_end:start]
        # 全角标点和公式之间不留空格：「， $x$」→「，$x$」，「$x$ 。」→「$x$。」。
        if last_end > 0 and before[:1] in (" ", "\t") and is_fullwidth_punctuation(before.lstrip(" \t")[:1]):
            before = before.lstrip(" \t")
        stripped = before.rstrip(" \t")
        if stripped != before and is_fullwidth_punctuation(stripped[-1:]):
            before = stripped
        chunks.append(before)
        expr = _normalize_math_body(source[start:end], display=display)
        prev_char = before[-1:] if before else (source[start - 1] if start > 0 else "")
        next_char = source[end] if end < len(source) else ""
        # 只修确定是违规的紧贴:跨度紧邻中文正文,或两个公式跨度直接相邻
        # ($a$$b$)。ASCII 相邻不动——译文里可能出现字面 $ 变量(如 $rem),
        # 扫描器会把 `$rem ... $` 误判成跨度,补空格会破坏字面文本。
        prefix = " " if (
            _is_cjk_char(prev_char) and prev_char not in _LEFT_NO_SPACE and not is_fullwidth_punctuation(prev_char)
        ) or start == prev_span_end else ""
        suffix = " " if (
            _is_cjk_char(next_char) and next_char not in _RIGHT_NO_SPACE and not is_fullwidth_punctuation(next_char)
        ) else ""
        chunks.append(f"{prefix}{expr}{suffix}")
        last_end = end
        prev_span_end = end
    tail = source[last_end:]
    if tail[:1] in (" ", "\t") and is_fullwidth_punctuation(tail.lstrip(" \t")[:1]):
        tail = tail.lstrip(" \t")
    chunks.append(tail)
    return _MULTI_SPACE_RE.sub(" ", "".join(chunks))


# 渲染不了的写法 → 提示给模型替换。规则在 foundation/shared/latex_commands.json，
# 每一条的 pipeline 状态都由真编译闸门验证过；往里加东西之前先让闸门实测一次——
# 渲染失败更可能是版本脱节，而不是覆盖度不足（0.2.6 吐旧版 Typst 符号名，曾被误读成
# 「mitex 不支持」，长出一整批降级规则）。
MITEX_REWRITE_DATABASE: tuple[tuple[str, str], ...] = mitex_rewrite_database()


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
    "is_fullwidth_punctuation",
    "normalize_direct_typst_translation",
]
