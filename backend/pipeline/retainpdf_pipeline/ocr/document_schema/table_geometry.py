"""Locate OCR HTML cells in a PDF text layer, including borderless tables."""
from __future__ import annotations

from html.parser import HTMLParser
import re
from statistics import median
import unicodedata

import fitz


class _TableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.cells: list[dict] = []
        self.row = -1
        self.column = 0
        self.occupied: set[tuple[int, int]] = set()
        self.current: dict | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row += 1
            self.column = 0
        elif tag in {"td", "th"}:
            attributes = dict(attrs)
            while (self.row, self.column) in self.occupied:
                self.column += 1
            rowspan = max(1, int(attributes.get("rowspan", "1")))
            colspan = max(1, int(attributes.get("colspan", "1")))
            self.current = dict(row=self.row, column=self.column, rowspan=rowspan, colspan=colspan, parts=[])
            self.cells.append(self.current)
            for row in range(self.row, self.row + rowspan):
                for column in range(self.column, self.column + colspan):
                    self.occupied.add((row, column))
            self.column += colspan
        elif tag == "br" and self.current is not None:
            self.current["parts"].append(" ")

    def handle_endtag(self, tag):
        if tag in {"td", "th"}:
            self.current = None

    def handle_data(self, data):
        if self.current is not None:
            self.current["parts"].append(data)


def _key(text: str) -> str:
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", text)).replace("\u00ad", "").casefold()


def _matches(text: str, words: list) -> list[fitz.Rect]:
    target = _key(text)
    result = []
    if not target:
        return result
    for start, word in enumerate(words):
        value = ""
        box = fitz.Rect(word[:4])
        for candidate in words[start:]:
            value += _key(candidate[4])
            if not target.startswith(value):
                break
            box |= fitz.Rect(candidate[:4])
            if value == target:
                result.append(box)
                break
    return result


def html_cell_geometry(table: dict, page: fitz.Page, area: fitz.Rect, words: list) -> list[dict] | None:
    content = table.get("content", {})
    html = str(content.get("table_html") or content.get("text") or "")
    if "<table" not in html.lower():
        return None
    parser = _TableParser()
    try:
        parser.feed(html)
    except ValueError:
        return None  # Invalid OCR span attributes: the PDF grid remains usable.
    cells = parser.cells
    if not cells:
        return None
    row_count = max(cell["row"] + cell["rowspan"] for cell in cells)
    column_count = max(cell["column"] + cell["colspan"] for cell in cells)
    row_anchors: dict[int, list[float]] = {}
    column_anchors: dict[int, list[float]] = {}
    for cell in cells:
        cell["text"] = "".join(cell.pop("parts")).strip()
        cell["matches"] = _matches(cell["text"], words)
        if len(cell["matches"]) == 1:
            box = cell["matches"][0]
            if cell["rowspan"] == 1:
                row_anchors.setdefault(cell["row"], []).append((box.y0 + box.y1) / 2)
            if cell["colspan"] == 1:
                column_anchors.setdefault(cell["column"], []).append((box.x0 + box.x1) / 2)
    located = []
    for cell in cells:
        matches = cell.pop("matches")
        if not matches:
            continue
        expected_y = median(row_anchors[cell["row"]]) if cell["row"] in row_anchors else (
            area.y0 + area.height * (cell["row"] + cell["rowspan"] / 2) / row_count
        )
        expected_x = median(column_anchors[cell["column"]]) if cell["column"] in column_anchors else (
            area.x0 + area.width * (cell["column"] + cell["colspan"] / 2) / column_count
        )
        cell["source_bbox"] = min(matches, key=lambda box: (
            abs((box.y0 + box.y1) / 2 - expected_y) / area.height
            + abs((box.x0 + box.x1) / 2 - expected_x) / area.width
        ))
        located.append(cell)
    # Infer separators in the actual gaps between source text, not equal fractions
    # of the OCR rectangle. Merged cells do not contribute false internal edges.
    def boundaries(axis, count, low, high):
        edges = [low]
        for index in range(1, count):
            before = [cell["source_bbox"][axis + 2] for cell in located
                      if cell["rowspan" if axis == 1 else "colspan"] == 1
                      and cell["row" if axis == 1 else "column"] == index - 1]
            after = [cell["source_bbox"][axis] for cell in located
                     if cell["rowspan" if axis == 1 else "colspan"] == 1
                     and cell["row" if axis == 1 else "column"] == index]
            if not before or not after or max(before) >= min(after):
                return None
            edges.append((max(before) + min(after)) / 2)
        return edges + [high]
    xs = boundaries(0, column_count, area.x0, area.x1)
    ys = boundaries(1, row_count, area.y0, area.y1)
    if xs is None or ys is None:
        return None
    for cell in located:
        cell["bbox"] = fitz.Rect(xs[cell["column"]], ys[cell["row"]],
                                 xs[cell["column"] + cell["colspan"]], ys[cell["row"] + cell["rowspan"]])
    return located
