"""Extract translation-only cells from OCR-detected PDF tables."""
from __future__ import annotations

import logging
import re
from statistics import median

import fitz

from retainpdf_translation.core.ocr.models import TextItem
from retainpdf_translation.core.ocr.table_geometry import html_cell_geometry

logger = logging.getLogger(__name__)


def _grid_cells(grids: list, area: fitz.Rect, words: list) -> list[dict]:
    cells = []
    seen: set[tuple] = set()
    for grid in grids:
        # Horizontal rules alone don't prove that a whole row is a cell.
        # Use OCR HTML for these tables instead of merging labels with numbers.
        if grid.col_count < 2 or not (area + (-1, -1, 1, 1)).contains(fitz.Rect(grid.bbox)):
            continue
        for row_index, row in enumerate(grid.rows):
            for column_index, cell in enumerate(row.cells):
                if cell is None or tuple(cell) in seen:
                    continue
                seen.add(tuple(cell))
                box = fitz.Rect(cell) & area
                cell_words = [word for word in words if box.contains(fitz.Point(
                    (word[0] + word[2]) / 2, (word[1] + word[3]) / 2,
                ))]
                if not cell_words:
                    continue
                cell_words.sort(key=lambda word: (word[5], word[6], word[7]))
                source_box = fitz.Rect(cell_words[0][:4])
                for word in cell_words[1:]:
                    source_box |= fitz.Rect(word[:4])
                cells.append(dict(row=row_index, column=column_index, bbox=box,
                                  source_bbox=source_box,
                                  text=" ".join(word[4] for word in cell_words)))
    return cells


def _table_context(cells: list[dict], cell: dict, caption: str) -> str:
    row, column = cell["row"], cell["column"]
    labels = [
        other["text"][:100]
        for other in cells
        if other is not cell and other["text"] != cell["text"]
        and (
            (other["row"] == 0 and other["column"] <= column < other["column"] + other.get("colspan", 1))
            or (other["column"] == 0 and other["row"] <= row < other["row"] + other.get("rowspan", 1))
        )
    ]
    return " | ".join(dict.fromkeys(part for part in [caption[:160], *labels[:4]] if part))


def _table_items(page: fitz.Page, page_idx: int, block_idx: int, table: dict, grids: list) -> list[TextItem]:
    area = fitz.Rect(table["geometry"]["bbox"]) & page.rect
    if area.is_empty:
        return []
    words = page.get_text("words", clip=area)
    if not words:
        table.setdefault("metadata", {})["table_translation_reason"] = "no_pdf_text_layer"
        return []
    cells = _grid_cells(grids, area, words) or html_cell_geometry(table, area, words)
    if not cells:
        table.setdefault("metadata", {})["table_translation_reason"] = "cell_geometry_unavailable"
        return []

    caption = str(table["content"].get("caption") or "")
    table_id = table["block_id"]
    items = []
    for cell in cells:
        text = cell["text"].strip()
        # Numeric results, symbols and mathematical variables stay untouched.
        prose = re.sub(r"\$.*?\$|\\\(.*?\\\)", "", text)
        if not re.search(r"[A-Za-z]{3,}", prose):
            continue
        box, source_box = cell["bbox"], cell["source_bbox"]
        spans = [span for block in page.get_text("dict", clip=source_box)["blocks"]
                 for line in block.get("lines", []) for span in line["spans"]]
        font_size = median(span["size"] for span in spans) if spans else source_box.height / 1.4
        cell_info = {
            "table_id": table_id, "row": cell["row"], "column": cell["column"],
            "bbox": list(box), "source_bbox": list(source_box), "font_size": font_size,
            "bold": bool(spans and spans[0]["flags"] & 16),
            "color": spans[0]["color"] if spans else 0,
            "align": "center" if abs((source_box.x0 + source_box.x1 - box.x0 - box.x1) / 2) < box.width * 0.1 else "left",
            "context": _table_context(cells, cell, caption),
        }
        items.append(TextItem(
            item_id=f"{table_id}-cell-{cell['row']}-{cell['column']}",
            page_idx=page_idx, block_idx=block_idx, reading_order=block_idx,
            block_type="table_cell", block_kind="table_cell", block_class="table_cell",
            structure_role="table_cell", policy_translate=True,
            bbox=list(box), text=text, segments=[{"type": "text", "content": text}], lines=[],
            metadata={"table_cell": cell_info},
        ))
    return items


def extract_table_cell_items(data: dict, page_idx: int, pdf: fitz.Document) -> list[TextItem]:
    tables = [
        (index, block) for index, block in enumerate(data["pages"][page_idx].get("blocks", []))
        if block.get("content", {}).get("kind") == "table"
    ]
    if not tables:
        return []
    reason = "page_outside_pdf"
    if 0 <= page_idx < len(pdf):
        try:
            page = pdf[page_idx]
            # PyMuPDF analyzes page drawings; reuse the result for all tables on the page.
            grids = page.find_tables().tables
            return [
                item for index, table in tables
                for item in _table_items(page, page_idx, index, table, grids)
            ]
        except Exception as error:
            # Table extraction is optional. A PDF inspection failure on one page
            # must not stop translation of its body or other pages.
            reason = "page_extraction_failed"
            logger.warning("Table extraction failed on page %d: %s", page_idx + 1, error)
    else:
        logger.warning("Skipping table extraction on page %d: %s", page_idx + 1, reason)
    for _, table in tables:
        table.setdefault("metadata", {})["table_translation_reason"] = reason
    return []
