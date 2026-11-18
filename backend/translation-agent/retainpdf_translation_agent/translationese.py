"""翻译腔信号：程序按句式圈出译文里可能是照搬英文结构的地方，交给编辑重点看（不一定都错，改不改由编辑判断）。

只放误报少、编辑一看就懂的句式；每条带一句改法提示。2026-11-18 从一本人文书（The Interloper）qwen 译文里统计来的：
"表现出阻碍态度""通过不再继续观看，""进行……访谈""所带来的""阻碍的具体风味"。
"""

from __future__ import annotations

import re

PATTERNS: list[tuple[str, re.Pattern, str]] = [
    ("empty_verb", re.compile(r"(设置|形成|构成|制造|施加)了?[^，。；]{0,4}(阻碍|障碍|阻挠|阻力|限制|压力)"), "抽象名词配虚动词：说成动作（“就百般阻挠”“不肯配合”）"),
    ("attitude", re.compile(r"表现出[^，。；]{0,8}(态度|姿态|倾向)"), "“表现出……态度”：直接说他做了什么"),
    ("jinxing", re.compile(r"进行了?[^，。；]{0,6}(研究|访谈|观察|分析|探究|调查|讨论|比较)"), "“进行……”：去掉“进行”，直接用动词"),
    ("tongguo_head", re.compile(r"(?:^|(?<=[。！？；]))\s*通过[^，。]{2,24}，"), "句首“通过……，”照搬 by/through：换成“靠……”“……以后”或调语序"),
    ("zuowei_head", re.compile(r"作为一[名个位][^，。]{1,12}，"), "照搬 As a …：多半能删掉或并进主语"),
    ("suo_de", re.compile(r"所(具有|带来|蕴含|涉及)的"), "“所……的”定语太重：拆开说"),
    ("de_chain", re.compile(r"[^，。；的]{1,8}的[^，。；的]{1,8}的[^，。；的]{1,8}的[^，。；的]{1,8}"), "一句里一串“的”：拆句或换说法"),
    ("bei", re.compile(r"被[^，。；]{1,12}(视为|认为|告知|驱逐|拒绝)"), "被字句：中文多用主动句，或“遭到”“给……”"),
    ("flavor", re.compile(r"的(具体)?(风味|味道)"), "flavor 是“样子、色彩、意味”，不是“风味”"),
]


def translationese_signals(translation: str) -> list[dict]:
    """译文里命中的可疑句式：[{code, text, hint}]。同一句里重复的“同样”也算（Similarly 和 also 都译出来了）。"""
    found: list[dict] = []
    for code, pattern, hint in PATTERNS:
        for match in pattern.finditer(translation or ""):
            found.append({"code": code, "text": match.group(0).strip(), "hint": hint})
    for sentence in re.split(r"[。！？]", translation or ""):
        if sentence.count("同样") >= 2:
            found.append({"code": "repeat_similarly", "text": sentence.strip()[:40], "hint": "Similarly 和 also 只译一次"})
    return found


__all__ = ["PATTERNS", "translationese_signals"]
