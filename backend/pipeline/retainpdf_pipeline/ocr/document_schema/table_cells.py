"""Recover independently translatable cells inside OCR-detected PDF tables.

The table stays a source asset. Cell rectangles come from the PDF table grid,
never from dividing an OCR rectangle into equally sized rows or columns.
"""
from __future__ import annotations

import re
from statistics import median

import fitz

from retainpdf_pipeline.ocr.document_schema.defaults import default_block_continuation_hint
from retainpdf_pipeline.ocr.document_schema.table_geometry import html_cell_geometry


def _grid_cells(page: fitz.Page, area: fitz.Rect, words: list) -> list[dict]:
    cells = []
    seen: set[tuple] = set()
    for grid in page.find_tables(clip=area + (-1, -1, 1, 1)).tables:
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
                                  source_bbox=source_box & box,
                                  text=" ".join(word[4] for word in cell_words)))
    return cells


def enrich_table_cells(document: dict, pdf: fitz.Document) -> None:
    for page_record in document.get("pages", []):
        page_index = page_record["page_index"]
        page = pdf[page_index]
        blocks = page_record.get("blocks", [])
        tables = [block for block in blocks if block.get("content", {}).get("kind") == "table"]
        existing = {block.get("metadata", {}).get("table_cell", {}).get("table_id") for block in blocks}
        additions: list[dict] = []
        for table in tables:
            table_id = table["block_id"]
            if table_id in existing:
                continue
            area = fitz.Rect(table["geometry"]["bbox"]) & page.rect
            if area.is_empty:
                continue
            words = page.get_text("words", clip=area)
            if not words:
                table.setdefault("metadata", {})["table_translation_reason"] = "no_pdf_text_layer"
                continue
            cells = _grid_cells(page, area, words)
            if not cells:
                cells = html_cell_geometry(table, page, area, words)
            if not cells:
                table.setdefault("metadata", {})["table_translation_reason"] = "cell_geometry_unavailable"
                continue
            context = " | ".join(cell["text"].strip() for cell in cells if cell["text"].strip())[:2000]
            caption = str(table.get("content", {}).get("caption") or "")
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
                    "align": "center" if abs((source_box.x0 + source_box.x1) / 2 - (box.x0 + box.x1) / 2) < box.width * 0.1 else "left",
                    "context": f"Table: {caption}\n{context}",
                }
                index = len(blocks) + len(additions)
                provenance = dict(table.get("provenance", {}))
                provenance.update(raw_label="table_cell", raw_sub_type="", raw_bbox=list(box))
                additions.append({
                    "block_id": f"p{page_index + 1:03d}-b{index:04d}",
                    "page_index": page_index, "order": index, "reading_order": index,
                    "type": "text", "block_class": "body", "sub_type": "text",
                    "bbox": list(box), "geometry": {"bbox": list(box)},
                    "text": text, "content": {"kind": "text", "text": text},
                    "layout_role": "paragraph", "semantic_role": "body", "structure_role": "body",
                    "policy": {"translate": True, "translate_reason": "pdf_table_cell"},
                    "provenance": provenance,
                    "continuation_hint": default_block_continuation_hint(),
                    "source": {"provider": provenance["provider"], "raw_type": "table_cell"},
                    "metadata": {"table_cell": cell_info},
                    "lines": [], "segments": [],
                })
            table.setdefault("metadata", {})["table_translation_reason"] = "pdf_table_cells"
        blocks.extend(additions)
