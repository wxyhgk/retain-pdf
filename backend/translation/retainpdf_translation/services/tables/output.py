"""翻好的表 → 整表译文（HTML 表格，跨行跨列照原表），给阅读页悬浮框和复制用。"""
from __future__ import annotations

import html
import re

from .agent import TableResult
from .cells import table_cells

_ALLOWED_TAG = re.compile(r"(</?(?:sup|sub)>)")


def _cell_html(text: str) -> str:
    # 格子文字里只有 <sup>/<sub> 是标记，其余照字面转义
    return "".join(part if _ALLOWED_TAG.fullmatch(part) else html.escape(part, quote=False) for part in _ALLOWED_TAG.split(text))


def translated_table_html(model: dict, result: TableResult) -> str:
    translations = result.translations()
    rows: dict[int, list[str]] = {}
    for cell in table_cells(model):
        text = translations.get(cell.cell_id) or cell.text
        tag = "th" if cell.role == "header" else "td"
        attrs = ""
        if cell.rowspan > 1:
            attrs += f' rowspan="{cell.rowspan}"'
        if cell.colspan > 1:
            attrs += f' colspan="{cell.colspan}"'
        rows.setdefault(cell.row, []).append(f"<{tag}{attrs}>{_cell_html(text)}</{tag}>")
    body = "".join(f"<tr>{''.join(cells)}</tr>" for _, cells in sorted(rows.items()))
    return f"<table>{body}</table>"


__all__ = ["translated_table_html"]
