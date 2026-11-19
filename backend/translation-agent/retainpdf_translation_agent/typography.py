"""原文排版造成的误读，发给模型前由程序修掉（2026-11-19）。

章首小型大写：书的每章第一段开头几个词常排成小型大写，OCR 出来是全大写（"CATCH," HE CALLED OUT LOUDLY. I was …）。
11-19 实验里 Haiku 把 CATCH 当成拟声词译成"咔嚓一声"，编辑也没改回来。正文段落开头连着两个以上全大写的词、后面接着
普通的小写正文时，把这几个词还原成句首大写（"Catch," he called out loudly.），不靠模型去猜。

只动段落开头那一串；标题（整块都是大写）、正文中间的缩写（FBI、NASA）不动。开头那串里的词在这段后面也以全大写出现的，
当成缩写保留；只在开头出现的缩写会被一起改小写（很少见，宁可这样也不让模型误读整句）。单独的 I 保持大写。
"""

from __future__ import annotations

import re
from dataclasses import replace

from retainpdf_translation_agent.contract import PageInput

# 开头的引号、括号，然后连着的全大写词（词之间可以夹标点、引号、破折号）
_LEAD_RE = re.compile(r"^(?P<lead>[\s\"'“‘(\[]*)(?P<caps>(?:[A-Z][A-Z'’-]*[A-Z]|[AI])(?:[\s,;:!?.\"'“”‘’()\-–—]+(?:[A-Z][A-Z'’-]*[A-Z]|[AI]))+)")
_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'’-]*")
SKIP_CLASSES = {"section_heading", "toc_entry", "title", "header", "footer", "page_number"}
MIN_LOWER_WORDS = 3  # 后面至少有这么多个小写词，才算正文


def _sentence_case(caps: str, keep: set[str]) -> str:
    seen_first = False
    sentence_start = True

    def fix(match: re.Match) -> str:
        nonlocal seen_first, sentence_start
        word = match.group(0)
        start = sentence_start
        before = caps[: match.start()].rstrip(" \"'“”‘’()")
        if seen_first and before.endswith((".", "!", "?")):
            start = True
        seen_first = True
        sentence_start = False
        if word == "I" or word in keep:
            return word
        lower = word.lower()
        return lower[0].upper() + lower[1:] if start else lower

    return _WORD_RE.sub(fix, caps)


def fix_small_caps_opening(text: str) -> str:
    """段落开头的全大写词还原成句首大写；不像章首小型大写的原样返回。"""
    match = _LEAD_RE.match(text or "")
    if not match:
        return text
    caps = match.group("caps")
    rest = text[match.end() :]
    if len(_WORD_RE.findall(caps)) < 2 or sum(1 for w in _WORD_RE.findall(rest) if w.islower()) < MIN_LOWER_WORDS:
        return text
    keep = {w for w in _WORD_RE.findall(rest) if len(w) > 1 and w.isupper()}
    return match.group("lead") + _sentence_case(caps, keep) + rest


def fix_page_typography(pages: list[PageInput]) -> list[PageInput]:
    """调度开头调一次：改过的块换成新文本，其余原样。"""
    out = []
    for page in pages:
        blocks = []
        changed = False
        for block in page.blocks:
            text = block.text if block.cls in SKIP_CLASSES else fix_small_caps_opening(block.text)
            if text != block.text:
                block = replace(block, text=text)
                changed = True
            blocks.append(block)
        out.append(replace(page, blocks=blocks) if changed else page)
    return out
