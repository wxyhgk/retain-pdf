"""接续组里两块之间夹着的独立公式。

教材里一段话常被独立公式隔开（"…whose $ x $ component is [独立公式] with similar expressions…"），接续段把公式两边
连成一组。以前拼组只把两块原文用空格连起来，公式不在里面：模型看到 "whose x component is with similar expressions"，
自己编一个公式写进正文（2026-10-30 量子化学-14 p003-b022 编出 `$ \\mu_x = \\sum_i q_i x_i $`，原式是
`\\mu_{x,cl}=\\sum Q_i x_i`），或者把公式后面的 "where φ is …" 挪到公式前面那块（p002-b013）。这本书 17 个组有 10 个这样。

现在把夹着的公式原文（`$$ … $$`）放进拼好的整段，模型看得到公式、原样留在原位；切回各块时就在这个公式处切开，
公式本身删掉（它在版面上是单独一块，照原文排）。只用于公式直写（direct_typst）：占位符模式的公式是 `<f1-abc/>`。
"""

from __future__ import annotations

import re

from retainpdf_translation.core.item_reader import item_block_kind
from retainpdf_translation.core.item_reader import item_source_text

DISPLAY_FORMULA_RE = re.compile(r"(?<!\\)\$\$[\s\S]+?(?<!\\)\$\$")


def display_formula_text(item: dict) -> str:
    """独立公式块的原文，统一写成 `$$ … $$`；不是独立公式块返回空字符串。"""
    if item_block_kind(item) != "formula" and str(item.get("block_type") or "").lower() != "formula":
        return ""
    text = item_source_text(item).strip()
    body = text.strip("$").strip()
    return f"$$ {body} $$" if body else ""


def formulas_between(payload: list[dict], members: list[dict]) -> list[str]:
    """组里每块前面、和上一块之间夹着的独立公式（阅读顺序，几个就换行连起来）；第一块和没夹公式的是空字符串。"""
    position = {id(item): index for index, item in enumerate(payload)}
    out = [""]
    for prev, item in zip(members, members[1:]):
        start, end = position.get(id(prev)), position.get(id(item))
        if start is None or end is None or end <= start:
            out.append("")
            continue
        formulas = [text for text in (display_formula_text(x) for x in payload[start + 1 : end]) if text]
        out.append("\n".join(formulas))
    return out


__all__ = ["DISPLAY_FORMULA_RE", "display_formula_text", "formulas_between"]
