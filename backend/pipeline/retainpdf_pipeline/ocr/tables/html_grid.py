"""OCR 给的表格 HTML → 逻辑网格（每格的起始行列、跨几行几列、OCR 认出的文字）。

只解析结构，不信 OCR 的文字（评测集量过：格子原文能原样对上的只有约六成），文字由文字层另取。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from html.parser import HTMLParser


@dataclass
class GridCell:
    row: int
    col: int
    rowspan: int = 1
    colspan: int = 1
    ocr_text: str = ""


@dataclass
class HtmlGrid:
    cells: list[GridCell] = field(default_factory=list)
    n_rows: int = 0
    n_cols: int = 0

    def rows(self) -> list[list[GridCell]]:
        """按起始行分组、每行按起始列排好的格子。"""
        grouped: list[list[GridCell]] = [[] for _ in range(self.n_rows)]
        for cell in self.cells:
            grouped[cell.row].append(cell)
        for row in grouped:
            row.sort(key=lambda cell: cell.col)
        return grouped


class _Parser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[dict]] = []
        self._cell: dict | None = None
        self._sup_depth = 0

    def handle_starttag(self, tag, attrs):  # noqa: ANN001 - HTMLParser 的签名
        attributes = dict(attrs)
        if tag == "tr":
            self.rows.append([])
        elif tag in ("td", "th"):
            if not self.rows:
                self.rows.append([])
            self._cell = {
                "text": [],
                "rowspan": _span(attributes.get("rowspan")),
                "colspan": _span(attributes.get("colspan")),
            }
            self.rows[-1].append(self._cell)
        elif tag in ("sup", "sub") and self._cell is not None:
            self._cell["text"].append(f"<{tag}>")
        elif tag == "br" and self._cell is not None:
            self._cell["text"].append(" ")

    def handle_endtag(self, tag):  # noqa: ANN001
        if tag in ("td", "th"):
            self._cell = None
        elif tag in ("sup", "sub") and self._cell is not None:
            self._cell["text"].append(f"</{tag}>")

    def handle_data(self, data):  # noqa: ANN001
        if self._cell is not None:
            self._cell["text"].append(data)


def _span(value: object) -> int:
    try:
        return max(1, int(str(value or "1").strip()))
    except ValueError:
        return 1


def parse_html_grid(html: str) -> HtmlGrid:
    parser = _Parser()
    parser.feed(html or "")
    parser.close()
    grid = HtmlGrid()
    occupied: set[tuple[int, int]] = set()
    for row_index, row in enumerate(parser.rows):
        column = 0
        for raw in row:
            while (row_index, column) in occupied:
                column += 1
            cell = GridCell(
                row=row_index,
                col=column,
                rowspan=raw["rowspan"],
                colspan=raw["colspan"],
                ocr_text=" ".join("".join(raw["text"]).split()),
            )
            grid.cells.append(cell)
            for dr in range(cell.rowspan):
                for dc in range(cell.colspan):
                    occupied.add((row_index + dr, column + dc))
            column += cell.colspan
    grid.n_rows = len(parser.rows)
    grid.n_cols = max((column for _, column in occupied), default=-1) + 1
    # 越过表格最后一行的 rowspan 截掉（OCR 偶尔给错）
    for cell in grid.cells:
        cell.rowspan = min(cell.rowspan, max(1, grid.n_rows - cell.row))
    return grid


_CAPTION_ROW = re.compile(r"^\s*(?:<[^>]+>)*\s*(?:table|tab\.)\s*[0-9ivx]+", __import__("re").IGNORECASE)
_FOOTNOTE_ROW = re.compile(r"^\s*(?:<sup>)?\s*[a-h*†‡§]\s*(?:</sup>)?\s+\S", __import__("re").IGNORECASE)


def drop_caption_rows(grid: HtmlGrid) -> list[str]:
    """OCR 把表题、表注当成了表格的一行（整行一个格子横跨所有列，文字以 "Table N" 或脚注标记开头）：去掉。

    只动第一行和最后一行。返回去掉的行的文字（写进 issues）。
    """
    removed: list[str] = []
    for position in ("first", "last"):
        if grid.n_rows <= 1:
            break
        row_index = 0 if position == "first" else grid.n_rows - 1
        row = [cell for cell in grid.cells if cell.row == row_index]
        if len(row) != 1 or row[0].colspan < grid.n_cols or grid.n_cols < 2:
            continue
        text = row[0].ocr_text
        pattern = _CAPTION_ROW if position == "first" else _FOOTNOTE_ROW
        if not pattern.match(text) and not (position == "last" and _CAPTION_ROW.match(text)):
            continue
        removed.append(text)
        grid.cells = [cell for cell in grid.cells if cell.row != row_index]
        if position == "first":
            for cell in grid.cells:
                cell.row -= 1
        grid.n_rows -= 1
    return removed
