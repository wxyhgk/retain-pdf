"""表格模型 table.v1：一张表的结构、每格的位置、原文、内容类型和"翻不翻"的规则建议。

结构来自 OCR 的 HTML，格子的位置和原文来自原文 PDF 文字层。文字层对不上的表标出原因、置信度低，不硬造。
第一版只处理有文字层的表（`source_kind=text_layer`，摸底里约 81%）；字转曲线、图片表要看图，以后做。
"""
from __future__ import annotations

import re
from typing import Any

import fitz

from .assemble import _column_of as _column_of_word, _tokens, assign_cells, column_bounds, map_rows
from .html_grid import drop_caption_rows, parse_html_grid
from .text_layer import table_text_lines

TABLE_MODEL_VERSION = "table.v1"
MIN_WORDS_FOR_TEXT_LAYER = 3
# 折行判断：上一行写到这一列文字范围的这个比例以上，才算写满了折下来
WRAP_FILL_RATIO = 0.7

_NUMBER = r"[-+±−–—~∼≈<>≤≥]?\s*\d+(?:[.,]\d+)?(?:\s*(?:%|°C|K|eV|nm|ms|μs|ns|s|h|min|wt%|mol%|equiv|×\s*10\S*))?"
_NUMERIC_LIKE = re.compile(rf"^(?:{_NUMBER}|[-–—−/]+|n\.?d\.?|N/A|\s|[()\[\]/,;:±×x*†‡§]|<sup>[^<]*</sup>|<sub>[^<]*</sub>)+$", re.IGNORECASE)
_CHEMICAL = re.compile(r"^(?:[A-Z][a-z]?\d*|<sub>\d+</sub>|[()\[\]·+\-])+$")
_ABBREVIATION = re.compile(r"^(?:<sup>[^<]*</sup>)?[A-Za-z0-9\-]{1,6}(?:<sup>[^<]*</sup>)?$")
_WORD = re.compile(r"[A-Za-z]{2,}")


def _plain(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text)


def content_kind(text: str) -> str:
    stripped = text.strip()
    if not stripped:
        return "empty"
    if _NUMERIC_LIKE.match(stripped):
        return "numeric"
    plain = _plain(stripped)
    if _CHEMICAL.match(stripped) and any(char.isdigit() for char in plain) and " " not in plain:
        return "chemical"
    if _ABBREVIATION.match(stripped) and not any(len(word) >= 4 and word.islower() for word in _WORD.findall(plain)):
        return "code"  # 样品编号、缩写、短符号
    return "text"


def suggested_action(kind: str) -> str:
    """规则先挑：数字、化学式、编号、空格子不翻；剩下的交给模型决定（这里先标 translate）。"""
    return "translate" if kind == "text" else "keep"


def _roles(cells: list[dict], n_rows: int) -> None:
    """表头：从第 1 行起、除第一列外没有数字格的行（最多 3 行）；行标签：表头以下的第一列。"""
    by_row: dict[int, list[dict]] = {}
    for cell in cells:
        by_row.setdefault(cell["row"], []).append(cell)
    header_rows = 0
    for row_index in range(min(3, n_rows)):
        row = by_row.get(row_index, [])
        if any(cell["content_kind"] == "numeric" and cell["col"] > 0 for cell in row):
            break
        header_rows += 1
    if header_rows == n_rows:
        header_rows = min(1, n_rows)
    for cell in cells:
        if not cell["text"].strip():
            cell["role"] = "empty"
        elif cell["row"] < header_rows:
            cell["role"] = "header"
        elif cell["col"] == 0:
            cell["role"] = "stub"
        else:
            cell["role"] = "data"


def build_table_model(block: dict, page: fitz.Page) -> dict[str, Any]:
    """一张表（document.v1 的 table block + 原文 PDF 那一页）→ table.v1。"""
    bbox = block.get("bbox") or (block.get("geometry") or {}).get("bbox")
    html = _block_html(block)
    model: dict[str, Any] = {
        "model_version": TABLE_MODEL_VERSION,
        "block_id": block.get("block_id"),
        "page_index": block.get("page_index"),
        "bbox": bbox,
        "source_kind": "unknown",
        "structure_source": "ocr_html",
        "n_rows": 0,
        "n_cols": 0,
        "cells": [],
        "skipped_lines": [],
        "confidence": 0.0,
        "issues": [],
    }
    grid = parse_html_grid(html)
    for text in drop_caption_rows(grid):
        model["issues"].append("dropped_caption_row")
        model["structure_source"] = "ocr_html+rules"
    model["n_rows"], model["n_cols"] = grid.n_rows, grid.n_cols
    if not grid.cells:
        model["issues"].append("ocr_html_missing")
        return model
    lines = table_text_lines(page, bbox)
    if sum(len(line.words) for line in lines) < MIN_WORDS_FOR_TEXT_LAYER:
        model["source_kind"] = "no_text_layer"
        model["issues"].append("no_text_layer")
        return model
    model["source_kind"] = "text_layer"
    mapping = map_rows(grid, lines)
    bounds = column_bounds(grid, lines, mapping)
    if bounds is None:
        model["issues"].append("columns_not_found")
        return model
    words_of = assign_cells(grid, lines, mapping, bounds)
    cells: list[dict] = []
    for cell in grid.cells:
        words = words_of[(cell.row, cell.col)]
        text = " ".join(word.text for word in words)
        kind = content_kind(text)
        cells.append(
            {
                "id": f"r{cell.row}c{cell.col}",
                "row": cell.row,
                "col": cell.col,
                "rowspan": cell.rowspan,
                "colspan": cell.colspan,
                "text": text,
                "ocr_text": cell.ocr_text,
                "bbox": [
                    min(word.x0 for word in words),
                    min(word.y0 for word in words),
                    max(word.x1 for word in words),
                    max(word.y1 for word in words),
                ]
                if words
                else None,
                "font_size": round(max(word.size for word in words), 2) if words else None,
                "content_kind": kind,
                "suggested_action": suggested_action(kind),
            }
        )
    _roles(cells, grid.n_rows)
    model["cells"] = cells
    model["skipped_lines"] = [lines[index].text for index in mapping.skipped_lines]
    row_score = mapping.matched_rows / grid.n_rows if grid.n_rows else 0.0
    agreement = [
        _similarity_text(cell["text"], cell["ocr_text"]) for cell in cells if cell["text"] or cell["ocr_text"]
    ]
    cell_score = sum(agreement) / len(agreement) if agreement else 0.0
    model["confidence"] = round(min(row_score, cell_score), 3)
    if row_score < 0.8:
        model["issues"].append("rows_poorly_matched")
    # 结构可能有错、规则修不了的，标出来交给后面看图裁决
    for column in range(grid.n_cols):
        if all(not cell["text"].strip() for cell in cells if cell["col"] == column and cell["colspan"] == 1):
            model["issues"].append("empty_column")
            break
    if any(len(lines[index].words) >= 2 for index in mapping.skipped_lines):
        model["issues"].append("unassigned_text_lines")
    if any(not indexes for indexes in mapping.row_lines):
        model["issues"].append("row_without_text")
    # 一行表格吃了好几行"每列都有字"的文字：多半是 OCR 把几行并成了一行（漏行）
    def _filled_columns(line_index: int) -> int:
        return len({_column_of_word(word, bounds) for word in lines[line_index].words})

    extents = _column_extents(lines, mapping, bounds)
    for indexes in mapping.row_lines:
        full = [index for index in indexes if _filled_columns(index) >= max(2, (grid.n_cols + 1) // 2)]
        if len(full) >= 2 and not _wrapped_prose_row(lines, indexes, bounds, extents):
            model["issues"].append("row_swallows_rows")
            break
    return model


def _column_extents(lines, mapping, bounds) -> list[tuple[float, float] | None]:
    """每列文字实际占到的左右范围（全表用到的文字行里，落在这一列的词）。"""
    extents: list[tuple[float, float] | None] = [None] * len(bounds)
    for indexes in mapping.row_lines:
        for index in indexes:
            for word in lines[index].words:
                column = _column_of_word(word, bounds)
                old = extents[column]
                extents[column] = (word.x0, word.x1) if old is None else (min(old[0], word.x0), max(old[1], word.x1))
    return extents


def _wrapped_prose_row(lines, indexes: list[int], bounds, extents) -> bool:
    """一行表格里的几行文字是不是同一批格子折行（说明文字表），而不是 OCR 把几行表格并成了一行。

    折行的下一行接着上一句往下写：大半有字的列，这一行是小写字母开头，而且同一列的上一行写到了接近这一列的最右边
    （写满了才折）。漏行的下一行是新的一条数据，开头是大写、数字、代号（"B-02"、"265.9"），上一行也写不满。
    没有大小写的文字（中文等）判断不了，照旧当漏行（2026-11-22，回归样本表 2 每格三五行说明文字被误判）。
    """
    if len(indexes) < 2:
        return False
    for previous, current in zip(indexes, indexes[1:]):
        segments: dict[int, list] = {}
        for word in lines[current].words:
            segments.setdefault(_column_of_word(word, bounds), []).append(word)
        before: dict[int, float] = {}
        for word in lines[previous].words:
            column = _column_of_word(word, bounds)
            before[column] = max(before.get(column, float("-inf")), word.x1)
        continued = 0
        for column, words in segments.items():
            first = min(words, key=lambda word: word.x0).text.lstrip("([\"'“‘")
            extent = extents[column]
            if not first[:1].islower() or column not in before or extent is None:
                continue
            width = extent[1] - extent[0]
            if width > 0 and before[column] >= extent[0] + WRAP_FILL_RATIO * width:
                continued += 1
        if continued * 2 < len(segments):
            return False
    return True


def _similarity_text(left: str, right: str) -> float:
    a, b = _tokens(left), _tokens(right)
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return sum((a & b).values()) / max(sum(a.values()), sum(b.values()))


def _block_html(block: dict) -> str:
    text = str(block.get("text", "") or "")
    if "<table" in text or "<tr" in text:
        return text
    parts = []
    for segment in block.get("segments") or []:
        piece = str(segment.get("text", "") or "")
        parts.append(f"$ {piece} $" if segment.get("type") == "inline_formula" else piece)
    return "".join(parts)
