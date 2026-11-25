"""正文标题对上目录条目：原文一样（不计大小写、空白、首尾标点）就用同一个译名。

正文标题常带章号（「1 Analyzing the Audience」「2.3 Choose the right word」「Chapter 1: Operators」
「Appendix A Matlab Code」），目录条目的标题不带：去掉开头的章号再比，对上了译文前面照样带章号
（「1 译名」「第1章 译名」「附录A 译名」）。认不出的（「Chapter 1」这种章号另起一块的、改了措辞的）不碰，交给普通翻译。

比的时候不计大小写、空白、首尾标点、重音（文字层常把「ö」拆成「o」加一个单独的分音符：「Schr ̈odinger」）。
"""
from __future__ import annotations

import re
import unicodedata

_NUMBER_PREFIX = re.compile(r"^(\d+(?:\.\d+)*)\.?\s+(\S.*)$")
_CHAPTER_PREFIX = re.compile(r"^chapter\s+(\d+)\s*[:.\-–—]?\s+(\S.*)$", re.IGNORECASE)
_APPENDIX_PREFIX = re.compile(r"^appendix\s+([A-Z]|\d+)\s*[:.\-–—]?\s+(\S.*)$", re.IGNORECASE)
_SPACE_BEFORE_MARK = re.compile(r"\s+(?=[\u0300-\u036f\u00a8\u00b4\u02c6-\u02dd])")
_SPACING_ACCENTS = str.maketrans({"\u00a8": "", "\u00b4": "", "\u02c6": "", "\u02c7": "", "\u02d8": "", "\u02d9": "", "\u02da": "", "\u02db": "", "\u02dc": "", "\u02dd": ""})
_EDGE_PUNCT = " \t.:：;；,，-–—·•\"'“”‘’()（）[]"


def title_key(text: str) -> str:
    text = _SPACE_BEFORE_MARK.sub("", str(text or "")).translate(_SPACING_ACCENTS)
    text = "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("’", "'").replace("‘", "'").replace("–", "-").replace("—", "-")
    return " ".join(text.split()).strip(_EDGE_PUNCT).casefold()


def split_number(text: str) -> tuple[str, str]:
    """「2.3 Choose the right word」→（「2.3」，「Choose the right word」）；没有章号就是（""，原文）。"""
    match = _NUMBER_PREFIX.match(" ".join(str(text or "").split()))
    return (match.group(1), match.group(2)) if match else ("", str(text or ""))


def heading_translation(text: str, translations_by_key: dict[str, str]) -> str | None:
    """正文标题的译文：整句对上用整句；去掉章号对上，就是「章号 译名」。"""
    whole = translations_by_key.get(title_key(text))
    if whole:
        return whole
    flat = " ".join(str(text or "").split())
    for pattern, compose in (
        (_NUMBER_PREFIX, lambda label, zh: f"{label} {zh}"),
        (_CHAPTER_PREFIX, lambda label, zh: f"第{label}章 {zh}"),
        (_APPENDIX_PREFIX, lambda label, zh: f"附录{label.upper()} {zh}"),
    ):
        match = pattern.match(flat)
        translated = translations_by_key.get(title_key(match.group(2))) if match else None
        if translated:
            return compose(match.group(1), translated)
    return None


__all__ = ["heading_translation", "split_number", "title_key"]
