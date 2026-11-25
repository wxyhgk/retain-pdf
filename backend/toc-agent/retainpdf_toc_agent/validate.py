"""逐条检查目录标题的译文。没过的连原因退回给模型重交。"""
from __future__ import annotations

import re

from retainpdf_toc_agent.contract import GlossaryTerm

_CJK = re.compile(r"[㐀-䶿一-鿿豈-﫿]")
_LETTER_WORD = re.compile(r"[A-Za-z]{2,}")
_DIGITS = re.compile(r"\d+")
_LEADING_NUMBER = re.compile(r"^\s*(?:第\s*)?(\d+(?:[.\-–]\d+)*)\s*(?:章|节)?[.．、:：]?\s+")
MAX_LENGTH_RATIO = 4

REASON_EMPTY = "empty"
REASON_NOT_TRANSLATED = "not_translated"
REASON_NUMBER_CHANGED = "number_changed"
REASON_NUMBER_MISSING = "number_missing"
REASON_TOO_LONG = "too_long"
REASON_GLOSSARY = "glossary_not_used"
REASON_MULTILINE = "multiline"

REASON_HINTS = {
    REASON_EMPTY: "译文是空的",
    REASON_NOT_TRANSLATED: "没有译成中文",
    REASON_NUMBER_CHANGED: "多出了原文里没有的数字（不要写章号、页码）",
    REASON_NUMBER_MISSING: "原文里的数字丢了",
    REASON_TOO_LONG: "太长了，标题要简洁",
    REASON_GLOSSARY: "没按术语表译",
    REASON_MULTILINE: "译文要写成一行",
}


def tidy(translation: str, *, number: str = "") -> str:
    """去掉模型常加的东西：首尾空白、引号、句号；开头重复的章号（「1 分析受众」→「分析受众」）。"""
    text = " ".join(str(translation or "").split())
    text = text.strip("\"'“”‘’「」").rstrip("。.")
    if number:
        match = _LEADING_NUMBER.match(text)
        if match and match.group(1) == number:
            text = text[match.end():]
    return text.strip()


def check_title(source: str, translation: str, *, glossary: tuple[GlossaryTerm, ...] = ()) -> str:
    """过了返回空串，没过返回原因（``REASON_*``）。"""
    if not translation.strip():
        return REASON_EMPTY
    if "\n" in translation:
        return REASON_MULTILINE
    # 一个词的标题（API、Python 这类名字、缩写）可以照原文留；两个词以上的原文要有中文
    if len(_LETTER_WORD.findall(source)) >= 2 and not _CJK.search(translation):
        return REASON_NOT_TRANSLATED
    source_numbers = _DIGITS.findall(source)
    translated_numbers = _DIGITS.findall(translation)
    if any(number not in source_numbers for number in translated_numbers):
        return REASON_NUMBER_CHANGED
    if any(number not in translated_numbers for number in source_numbers):
        return REASON_NUMBER_MISSING
    if len(translation) > max(12, len(source) * MAX_LENGTH_RATIO):
        return REASON_TOO_LONG
    lowered = source.lower()
    for term in glossary:
        if term.source.lower() in lowered and term.target not in translation:
            return REASON_GLOSSARY
    return ""


def glossary_for(title: str, glossary: tuple[GlossaryTerm, ...]) -> tuple[GlossaryTerm, ...]:
    lowered = title.lower()
    return tuple(term for term in glossary if term.source and term.target and term.source.lower() in lowered)


__all__ = ["REASON_HINTS", "check_title", "glossary_for", "tidy"]
