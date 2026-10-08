"""QA 各检查共用的文本工具：数学片段遮罩、中日韩字符判断、破折号归一。"""
from __future__ import annotations

import re

from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import strip_placeholders


# 行内数学片段（direct_typst 模式下原文、译文都带 $...$）。只认成对的单个 $，
# 不跨行；未闭合的 $ 保持原样，不至于把后半段正文整个吞掉。不把 $$ 当成定界符：
# 译文里紧挨着的两段公式「$x$$^{24}$」会被误认成一段跨越整段正文的 $$…$$。
MATH_SPAN_RE = re.compile(r"(?<!\\)\$(?:\\.|[^$\\\n])+(?<!\\)\$")
MATH_MASK = ""
CJK_CLASS = "㐀-䶿一-鿿豈-﫿"
CJK_RE = re.compile(f"[{CJK_CLASS}]")
DASH_CHARS = "‐‑‒–—−﹣－"
_DASH_RE = re.compile(f"[{DASH_CHARS}]")


def mask_math(text: str) -> str:
    """数学片段替换成一个占位字符：保留「这里有东西」的相邻关系，便于判断标点两侧。"""
    return MATH_SPAN_RE.sub(MATH_MASK, str(text or ""))


def strip_math(text: str) -> str:
    return MATH_SPAN_RE.sub(" ", str(text or ""))


def prose_text(text: str) -> str:
    """去掉数学片段和协议占位符后的纯叙述文本。"""
    return strip_placeholders(strip_math(text))


def cjk_count(text: str) -> int:
    return len(CJK_RE.findall(str(text or "")))


def normalize_dashes(text: str) -> str:
    return _DASH_RE.sub("-", str(text or ""))


__all__ = [
    "CJK_CLASS",
    "CJK_RE",
    "DASH_CHARS",
    "MATH_MASK",
    "MATH_SPAN_RE",
    "cjk_count",
    "mask_math",
    "normalize_dashes",
    "prose_text",
    "strip_math",
]
