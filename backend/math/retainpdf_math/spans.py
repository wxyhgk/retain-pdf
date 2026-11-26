"""从文本里找公式：`$...$` 行内、`$$...$$` 行间（按未转义的 `$` 切开，奇数段就是公式）。"""

from __future__ import annotations

import re

UNESCAPED_INLINE_DOLLAR_RE = re.compile(r"(?<!\\)\$")
# 行内代码 `…`：里面的 `$` 是字面的（`echo $HOME`、`s/a$/b/`），不算公式边界
INLINE_CODE_RE = re.compile(r"`[^`\n]+`")


def has_balanced_inline_math_delimiters(text: str) -> bool:
    """未转义的 `$` 成对（`\\$` 是字面美元符，行内代码里的 `$` 不算）。

    译文「`$` 成对没有」只有这一份判定（2026-11-26，S02）：classic 的质量校验（`quality.py`）、请求缓存、读页的可疑译文日志都用它；
    agent 核心只许用标准库，`retainpdf_translation_agent.checks.dollars_balanced` 是同一条规则的抄本，翻译测试里钉着两边一致。"""
    return len(UNESCAPED_INLINE_DOLLAR_RE.findall(INLINE_CODE_RE.sub(" ", text or ""))) % 2 == 0


# `$$...$$` 要先认：按 `$` 切开取奇数段的做法遇到 `$$` 会把奇偶错开，行间公式整个漏掉（math_safety 的老写法就是这样）。
_FORMULA_RE = re.compile(r"(?<!\\)\$\$(.+?)(?<!\\)\$\$|(?<!\\)\$(.+?)(?<!\\)\$", re.S)


def formula_spans(text: str) -> list[tuple[str, bool]]:
    """文本里每个公式：(TeX（不含 `$`）, 是不是行间公式)，按出现顺序；空的跳过，落单的 `$` 不算。"""
    spans = []
    for match in _FORMULA_RE.finditer(text or ""):
        display = match.group(1) is not None
        tex = match.group(1) if display else match.group(2)
        if tex.strip():
            spans.append((tex, display))
    return spans


def math_spans(text: str) -> list[str]:
    """文本里每个公式的 TeX（不含 `$`），按出现顺序。"""
    return [tex for tex, _display in formula_spans(text)]


def compact_tex(tex: str) -> str:
    """比较两个公式是不是同一个写法时用：去掉所有空白。"""
    return re.sub(r"\s+", "", tex or "")


__all__ = [
    "INLINE_CODE_RE",
    "UNESCAPED_INLINE_DOLLAR_RE",
    "compact_tex",
    "formula_spans",
    "has_balanced_inline_math_delimiters",
    "math_spans",
]
