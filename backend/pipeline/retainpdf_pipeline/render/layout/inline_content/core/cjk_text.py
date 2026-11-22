"""排版前的中文文字规范化（2026-11-22）。

译文按原样排时，几类小问题让版面看着不讲究（三个排版检查在两本教材译文里找到的，见
docs/ops/planning/body-typesetting/20261122-排版细节清单.md）。这里在渲染用的 markdown 定稿前统一处理，
Typst 和 rpr 引擎两条路线都经过这里（``mode_router.build_item_render_markdown``）。公式（``$…$``）原样不动，
只改公式之外的文字；没有汉字的文字不动。

- 不该断开的空格换成不可断空格（U+00A0）：引用词和编号之间（"图 2.7""式 (2.21)""第 3 章"）、数字和单位之间
  （"300 K""40 kJ/mol"），缺空格的数字和单位补上（"250kJ/mol" → "250 kJ/mol"）。引擎和 Typst 都不在不可断空格处断行。
- 引号统一成“”‘’：成对的英文直引号 " 按开合配成“”，直角引号「」『』换成“”‘’。
- 圆括号：里面有汉字的半角括号换成全角（"(固定)" → "（固定）"）；全角括号里全是西文的引文换成半角，里面的全角逗号、
  分号、冒号一起换成半角（"（Bloomfield，2010）" → "(Bloomfield, 2010)"）。
- 段首的列表符号 "- "、"* " 换成 "• "。
- 单个省略号 … 在汉字之间换成 ……。
- 注释号这类纯上标公式（$^{14}$）和前后汉字、中文标点之间的空格去掉（"刚度”。¹ 力场" → "刚度”。¹力场"）。
"""

from __future__ import annotations

import re

from retainpdf_pipeline.render.layout.text_analysis import RAW_MATH_TOKEN_KINDS
from retainpdf_pipeline.render.layout.text_analysis import analyze_text
from retainpdf_pipeline.render.layout.inline_content.core.inline_math import is_pure_superscript

NBSP = " "
_HAN = r"㐀-鿿豈-﫿"
_HAN_RE = re.compile(f"[{_HAN}]")

# 后面跟编号时，和编号之间不断开的词
_REFERENCE_WORDS = (
    "参考文献", "习题", "例题", "定理", "引理", "推论", "定义", "附录", "公式", "方程",
    "图", "表", "式", "节", "章", "题", "例", "第", "页", "卷", "期",
)
# 编号也可能是公式（"式 $(2.21)$"），公式在这里是占位 \u0000n\u0000
_REFERENCE_RE = re.compile(rf"({'|'.join(_REFERENCE_WORDS)})[ \t]+(?=[0-9(（\[IVX\u0000])")
# 编号和后面的量词之间（"第 3 章""2.2.6 节"）
_NUMBER_COUNTER_RE = re.compile(rf"([0-9])[ \t]+(?=[章节页条款卷期部篇次版])")

# 数字后面的单位。单个字母的单位只收 K（温度），s、g、A、V 这些在化学、物理文里太容易和别的东西混（1s 轨道、3d）。
_UNITS = (
    "kJ/mol", "kcal/mol", "J/mol", "cm⁻¹", "cm-1", "kJ", "kcal", "mol", "mmol", "μmol", "µmol",
    "keV", "MeV", "GeV", "meV", "eV",
    "nm", "pm", "μm", "µm", "mm", "cm", "km", "Å",
    "GHz", "MHz", "kHz", "Hz", "GPa", "MPa", "kPa", "Pa", "bar", "atm", "Torr",
    "mL", "μL", "µL", "mg", "μg", "µg", "kg", "ms", "μs", "µs", "ns", "ps", "fs",
    "mV", "kV", "mA", "μA", "µA", "kW", "MW", "mW", "°C", "K",
)
_UNIT_RE = re.compile(
    r"(?<![A-Za-z])([0-9](?:[0-9.,]*[0-9])?)[ \t]?("
    + "|".join(re.escape(unit) for unit in sorted(_UNITS, key=len, reverse=True))
    + r")(?![A-Za-z0-9])"
)

_HALF_PAREN_HAN_RE = re.compile(rf"\(([^()（）]*[{_HAN}][^()（）]*)\)")
_FULL_PAREN_LATIN_RE = re.compile(rf"（([^（）{_HAN}]*[A-Za-z][^（）{_HAN}]*)）")
_FULL_TO_HALF_PUNCT = {"，": ", ", "；": "; ", "：": ": "}
_LIST_MARK_RE = re.compile(r"(?m)^([ \t]*)[-*][ \t]+(?=\S)")
_LONE_ELLIPSIS_RE = re.compile(r"(?<!…)…(?!…)")
_CJK_CONTEXT_RE = re.compile(rf"[{_HAN}，。、；：！？”’）]")


_CJK_SIDE = rf"[{_HAN}，。、；：！？”’）]"
_SPACE_BEFORE_SUPERSCRIPT_RE = re.compile(rf"(?<={_CJK_SIDE})[ \t]+(?=\u0001\d+\u0001)")
_SPACE_AFTER_SUPERSCRIPT_RE = re.compile(rf"(\u0001\d+\u0001)[ \t]+(?=[{_HAN}“‘（])")


def _pair_ascii_quotes(text: str) -> str:
    """成对的英文直引号配成“”；单个的（数不成对）不动。"""
    if text.count('"') < 2 or text.count('"') % 2:
        return text
    out = []
    opening = True
    for char in text:
        if char == '"':
            out.append("“" if opening else "”")
            opening = not opening
        else:
            out.append(char)
    return "".join(out)


def _latin_citation(match: re.Match) -> str:
    inner = match.group(1)
    for full, half in _FULL_TO_HALF_PUNCT.items():
        inner = inner.replace(full, half)
    return "(" + re.sub(r"[ \t]{2,}", " ", inner).strip() + ")"


def normalize_text_chunk(text: str) -> str:
    """一段不含公式的文字。"""
    if not text or not _HAN_RE.search(text):
        return text
    text = _REFERENCE_RE.sub(lambda m: m.group(1) + NBSP, text)
    text = _NUMBER_COUNTER_RE.sub(lambda m: m.group(1) + NBSP, text)
    text = _UNIT_RE.sub(lambda m: m.group(1) + NBSP + m.group(2), text)
    text = _pair_ascii_quotes(text)
    text = text.replace("「", "“").replace("」", "”").replace("『", "‘").replace("』", "’")
    text = _HALF_PAREN_HAN_RE.sub(lambda m: "（" + m.group(1) + "）", text)
    text = _FULL_PAREN_LATIN_RE.sub(_latin_citation, text)
    text = _LIST_MARK_RE.sub(lambda m: m.group(1) + "• ", text)
    text = _LONE_ELLIPSIS_RE.sub(
        lambda m: "……" if _CJK_CONTEXT_RE.match(text[m.start() - 1:m.start()] or " ")
        or _CJK_CONTEXT_RE.match(text[m.end():m.end() + 1] or " ") else "…",
        text,
    )
    return text


def normalize_cjk_markdown(markdown: str) -> str:
    """渲染用的 markdown：公式原样，其余文字按 ``normalize_text_chunk`` 规范化。

    引号要整段配对，所以公式之外的文字先拼起来（公式换成占位）一起处理，再把公式放回去。"""
    source = markdown or ""
    if not source or not _HAN_RE.search(source):
        return source
    pieces: list[str] = []
    formulas: list[str] = []
    for token in analyze_text(source).tokens:
        if token.kind in RAW_MATH_TOKEN_KINDS:
            formulas.append(token.value)
            # 纯上标用另一种占位，好去掉它和汉字之间的空格
            mark = "\u0001" if is_pure_superscript(token.value) else "\u0000"
            pieces.append(f"{mark}{len(formulas) - 1}{mark}")
        else:
            pieces.append(token.value)
    normalized = normalize_text_chunk("".join(pieces))
    normalized = _SPACE_BEFORE_SUPERSCRIPT_RE.sub("", normalized)
    normalized = _SPACE_AFTER_SUPERSCRIPT_RE.sub(r"\1", normalized)
    return re.sub(r"[\u0000\u0001](\d+)[\u0000\u0001]", lambda m: formulas[int(m.group(1))], normalized)


__all__ = ["NBSP", "normalize_cjk_markdown", "normalize_text_chunk"]
