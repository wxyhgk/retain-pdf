"""接续组（分栏、分页拆开的同一段）译文怎么切回各块。

模型只翻整段（2026-10-30 起不再让它放 `[[BREAK]]`：它常把断点放到整句之后，按原文大小定的小框被塞进整句），
程序按原文各段的正文长度比例，在附近找最近的中文标点切开，不切开公式、脚注标记、行内代码。
后半块不许以标点开头：开头的标点挪回前一块末尾。
"""

from __future__ import annotations

import re

# 切点前面最好是这些标点（句号、分号优先，逗号其次）
STRONG = "。；！？"
WEAK = "，、：）」』”"
LEADING_PUNCT = "，。；：、！？）」』”"
PROTECTED_RE = re.compile(r"\$[^$]+\$|\{\{fn:[^}]+\}\}|`[^`\n]+`")
WINDOW = 0.35  # 在比例位置前后各找这一段（占一段平均长度的比例）


def _protected(text: str) -> list[tuple[int, int]]:
    return [(m.start(), m.end()) for m in PROTECTED_RE.finditer(text)]


def _safe(position: int, text: str, spans: list[tuple[int, int]]) -> bool:
    """能不能在 position 前切：不在公式、脚注标记、行内代码中间，不把英文单词、数字切开。"""
    if position <= 0 or position >= len(text):
        return False
    if any(start < position < end for start, end in spans):
        return False
    if text.startswith("{{fn:", position) or text[position - 1] in "（(“「《":
        return False  # 脚注标记跟着前面的词；左括号、左引号不放在段尾
    before, after = text[position - 1], text[position]
    return not (before.isascii() and before.isalnum() and after.isascii() and after.isalnum())


def _prose_positions(text: str, spans: list[tuple[int, int]]) -> list[int]:
    """译文里每个正文字符（不在公式、脚注标记、行内代码里）的位置。"""
    inside = set()
    for start, end in spans:
        inside.update(range(start, end))
    return [i for i in range(len(text)) if i not in inside and not text[i].isspace()]


def split_by_ratio(text: str, source_lengths: list[int]) -> list[str]:
    """把一整段译文按原文各段长度的比例切成 len(source_lengths) 段，切点尽量落在标点后面。

    比例按正文算（`source_lengths` 是各段原文的正文长度，译文这边也只数正文）：公式两边一样长，算进去会把切点推偏。"""
    count = len(source_lengths)
    if count <= 1:
        return [text.strip()]
    total = sum(source_lengths) or 1
    spans = _protected(text)
    length = len(text)
    prose = _prose_positions(text, spans)
    window = max(4, int(length / count * WINDOW))
    cuts: list[int] = []
    cumulative = 0
    for size in source_lengths[:-1]:
        cumulative += size
        if prose:
            target = prose[min(len(prose) - 1, max(0, round(len(prose) * cumulative / total) - 1))] + 1
        else:
            target = round(length * cumulative / total)
        low = max((cuts[-1] + 1) if cuts else 1, target - window)
        high = min(length - 1, target + window)
        best = None
        for marks, weight in ((STRONG, 0), (WEAK, 1)):
            candidates = [i + 1 for i in range(low - 1, high) if 0 <= i < length and text[i] in marks and _safe(i + 1, text, spans)]
            if candidates:
                best = min(candidates, key=lambda c: (abs(c - target), weight))
                break
        if best is None:
            near = sorted(range(low, high + 1), key=lambda c: abs(c - target))
            best = next((c for c in near if _safe(c, text, spans)), None)
        if best is None:
            # 比例位置落在一个长公式中间，附近一个能切的地方都没有：往两边找最近的能切处，宁可偏一点，
            # 也不把公式切成两半（2026-10-30 论文第 5 页：前块以 `$ \Delta\mathbf{g}_{l+1}=\mathbf` 结尾，两块都判 `$` 不成对）
            first = (cuts[-1] + 1) if cuts else 1
            anywhere = sorted(range(first, length), key=lambda c: abs(c - target))
            best = next((c for c in anywhere if _safe(c, text, spans)), max(low, min(target, high)))
        cuts.append(best)
    parts, start = [], 0
    for cut in cuts + [length]:
        parts.append(text[start:cut].strip())
        start = cut
    return parts


def move_leading_punctuation(parts: list[str]) -> list[str]:
    """后面一段以标点开头（"。然后……"），把标点挪到前一段末尾。"""
    out = list(parts)
    for index in range(1, len(out)):
        moved = ""
        while out[index] and out[index][0] in LEADING_PUNCT:
            moved += out[index][0]
            out[index] = out[index][1:].lstrip()
        if moved:
            out[index - 1] = out[index - 1].rstrip() + moved
    return out
