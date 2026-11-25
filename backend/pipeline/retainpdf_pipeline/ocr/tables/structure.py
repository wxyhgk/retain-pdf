"""表格 agent 定结构（表格翻译 G4）用的表格模型一侧：结构初稿、按改过的结构重建 table.v1。

初稿就是表格模型自己用的那一份：OCR 网格（去掉表题表注行以后）每格的起始行列和跨度、每行表格占文字层的哪几行。
表格 agent（核心包 ``retainpdf_table_agent.structure``）只改这份初稿；格子原文照旧按位置从文字层取
（``assemble_table_model``），不从模型那里来。

初稿（交给 agent 的字典，agent 改完原样交回 ``rebuild``）::

    {"n_rows": 3, "n_cols": 2,
     "cells": [{"row": 0, "col": 0, "rowspan": 1, "colspan": 1, "ocr_text": "Entry"}, ...],
     "row_lines": [[0], [1, 2], [3]],      # 每行表格占文字层的哪几行（下标对 lines）
     "caption_lines": [], "skipped_lines": [],
     "header_rows": None, "wrapped_rows": []}
"""
from __future__ import annotations

from collections import Counter
from typing import Any

import fitz

from .assemble import RowMapping, _similarity, _tokens, map_rows
from .html_grid import GridCell, HtmlGrid, drop_caption_rows, parse_html_grid
from .model import MIN_WORDS_FOR_TEXT_LAYER, _block_html, assemble_table_model, block_bbox, empty_table_model
from .text_layer import table_text_lines

STRUCTURE_SOURCE = "ocr_html+agent"


class TableStructure:
    """一张表的结构初稿和重建（同一页、同一个框里的文字层只取一次）。"""

    def __init__(self, block: dict, page: fitz.Page) -> None:
        self.block = block
        self.bbox = block_bbox(block)
        self.grid = parse_html_grid(_block_html(block))
        self.dropped_caption_rows = drop_caption_rows(self.grid)
        self.lines = table_text_lines(page, self.bbox) if self.grid.cells else []
        self.mapping = map_rows(self.grid, self.lines) if self.lines else None

    @property
    def usable(self) -> bool:
        """OCR 给了网格、框里有文字层：才有初稿可改（没文字层、没网格的这一版不修）。"""
        return bool(self.grid.cells) and sum(len(line.words) for line in self.lines) >= MIN_WORDS_FOR_TEXT_LAYER

    def line_texts(self) -> list[str]:
        return [line.text for line in self.lines]

    def draft(self) -> dict[str, Any]:
        assert self.mapping is not None
        return {
            "n_rows": self.grid.n_rows,
            "n_cols": self.grid.n_cols,
            "cells": [
                {"row": cell.row, "col": cell.col, "rowspan": cell.rowspan, "colspan": cell.colspan, "ocr_text": cell.ocr_text}
                for cell in self.grid.cells
            ],
            "row_lines": [list(indexes) for indexes in self.mapping.row_lines],
            "caption_lines": [],
            "skipped_lines": list(self.mapping.skipped_lines),
            "header_rows": None,
            "wrapped_rows": [],
        }

    def rebuild(self, draft: dict[str, Any]) -> dict[str, Any]:
        """按初稿（agent 改过的）重建 table.v1：格子原文、角色、issues 照表格模型的规则重新算。

        多出来的字段：``caption_lines``（移出表格的文字行）、``suspect_rows``（看起来吞了好几行的行）。
        表题表注的行在框里的，表格的框（``bbox``）收到表格本体，免得译文 PDF 盖掉它们。
        """
        n_rows, n_cols = int(draft["n_rows"]), int(draft["n_cols"])
        grid = HtmlGrid(
            cells=[
                GridCell(row=int(cell["row"]), col=int(cell["col"]), rowspan=int(cell["rowspan"]),
                         colspan=int(cell["colspan"]), ocr_text=str(cell.get("ocr_text") or ""))
                for cell in draft["cells"]
            ],
            n_rows=n_rows,
            n_cols=n_cols,
        )
        row_lines = [[int(index) for index in indexes] for indexes in draft["row_lines"]]
        if len(row_lines) != n_rows:
            raise ValueError("row_lines 和行数对不上")
        line_tokens = [_tokens(line.text) for line in self.lines]
        matched = 0
        for row, indexes in zip(grid.rows(), row_lines):
            ocr = sum((_tokens(cell.ocr_text) for cell in row), Counter())
            if indexes and _similarity(ocr, sum((line_tokens[index] for index in indexes), Counter())) >= 0.5:
                matched += 1
        mapping = RowMapping(row_lines=row_lines, skipped_lines=sorted(int(i) for i in draft.get("skipped_lines") or []),
                             matched_rows=matched)
        model = empty_table_model(self.block)
        model["structure_source"] = STRUCTURE_SOURCE
        if self.dropped_caption_rows:
            model["issues"].append("dropped_caption_row")
        model["source_kind"] = "text_layer"
        model["n_rows"], model["n_cols"] = n_rows, n_cols
        caption_lines = sorted(int(index) for index in draft.get("caption_lines") or [])
        model["caption_lines"] = [self.lines[index].text for index in caption_lines]
        model["bbox"] = self._body_bbox(row_lines, caption_lines)
        details: dict[str, Any] = {}
        assemble_table_model(
            model, grid, self.lines, mapping,
            header_rows=draft.get("header_rows"),
            wrapped_rows=frozenset(int(row) for row in draft.get("wrapped_rows") or []),
            details=details,
        )
        model["suspect_rows"] = details.get("suspect_rows", [])
        return model

    def _body_bbox(self, row_lines: list[list[int]], caption_lines: list[int]) -> Any:
        """表题表注的行移出表格以后，框的上下边收到它们和表格本体之间（左右不动）。"""
        if not caption_lines or not self.bbox:
            return self.bbox
        used = [index for indexes in row_lines for index in indexes]
        if not used:
            return self.bbox
        x0, y0, x1, y1 = (float(value) for value in self.bbox)
        top = min(self.lines[index].y0 for index in used)
        bottom = max(self.lines[index].y1 for index in used)
        above = [self.lines[index].y1 for index in caption_lines if self.lines[index].y1 <= top + 0.5]
        below = [self.lines[index].y0 for index in caption_lines if self.lines[index].y0 >= bottom - 0.5]
        if above:
            y0 = max(y0, (max(above) + top) / 2)
        if below:
            y1 = min(y1, (min(below) + bottom) / 2)
        return [x0, y0, x1, y1]


def table_structure(block: dict, page: fitz.Page) -> TableStructure | None:
    """能给表格 agent 改的结构初稿；没有 OCR 网格、没有文字层的表返回 None。"""
    structure = TableStructure(block, page)
    return structure if structure.usable else None


__all__ = ["STRUCTURE_SOURCE", "TableStructure", "table_structure"]
