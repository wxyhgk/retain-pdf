"""符号字体的错码对照表：文字层抽出来的字符和页面上画的字不一样的字体。

Elsevier / RSC 排版常用的 Advent 符号字体、Universal / MathematicalPi 符号字体没有正确的 ToUnicode，文字层里 `×` 是控制字符 `\\x04`、`°` 是 `1`、
`Δ` 是 `D`……（表格评测集里 d3cs00837a 那篇综述有 900 多个格子因此对不上）。下面的每一项都在 2026-11-12
把那个字形渲染出来看图核对过。字体名按去掉子集前缀（`ABCDEF+`）后的名字匹配；只收核对过的字体，别的字体不动。
"""
from __future__ import annotations

SYMBOL_FONTS: dict[str, dict[str, str]] = {
    # Elsevier / RSC 的 Advent 字体（d3cs00837a 那篇综述）
    "AdvP4C4E74": {"\x02": "−", "\x03": "·", "\x04": "×", "0": "′", "h": "⟨", "i": "⟩"},
    "AdvPi1": {"4": ">", "D": "Δ", "b": "β", "m": "μ", "p": "π", "s": "σ"},
    "AdvPi2": {"F": "Φ", "l": "λ", "p": "π", "t": "τ"},
    "AdvEls-ent4": {"o": "<"},
    "AdvEls-ent5": {"1": "°", "p": "∝"},
    "AdvEls-ent6": {"Q": "="},
    "AdvEls-ent7": {"B": "∼", "E": "≈"},
    # Universal / MathematicalPi 字体（tests/fixtures/pdfs/2.pdf）
    "MathematicalPi-Six": {"/": "∠"},
    "Universal-GreekwithMathP": {";": "∼", "D": "Δ", "[": "≡", "d": "δ", "k": "κ", "Þ": "≠"},
    "Universal-NewswithCommPi": {"8": "′", "9": "″"},
}


def base_font_name(font: str) -> str:
    name = font or ""
    if len(name) > 7 and name[6] == "+" and name[:6].isalpha() and name[:6].isupper():
        return name[7:]
    return name


def fix_symbol_char(font: str, char: str) -> str:
    """这个字体里的这个字符在页面上实际画的是什么；不在对照表里原样返回。"""
    table = SYMBOL_FONTS.get(base_font_name(font))
    return table.get(char, char) if table else char
