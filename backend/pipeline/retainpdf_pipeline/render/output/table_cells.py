"""Fit translated table cells without reflowing the original table grid."""
from __future__ import annotations

from html import escape
from pathlib import Path
import re

import fitz

from retainpdf_pipeline.render.layout.text_analysis import analyze_text
from retainpdf_pipeline.render.layout.text_analysis import math_token_body
from retainpdf_pipeline.render.layout.text_analysis import RAW_MATH_TOKEN_KINDS


def _cell_html(text: str) -> str | None:
    chunks = []
    for token in analyze_text(text).tokens:
        if token.kind in RAW_MATH_TOKEN_KINDS:
            body = math_token_body(token).strip()
            # Simple inline symbols need no equation layout. Complex formulas stay
            # in the original PDF rather than displaying raw LaTeX in the table.
            if not re.fullmatch(r"[\w\s.,+\-]+", body):
                return None
            chunks.append(f"<i>{escape(body)}</i>")
        else:
            chunks.append(escape(token.value).replace("\n", "<br>"))
    return "<div>" + "".join(chunks) + "</div>"


def is_table_cell(item: dict) -> bool:
    return bool((item.get("metadata") or {}).get("table_cell"))


def render_translated_table_cells(
    output_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    *,
    mode: str,
    start_page: int = 0,
    extract_selected_pages: bool = False,
) -> dict:
    cells_by_page = {index: [item for item in items if is_table_cell(item)]
                     for index, items in translated_pages.items()}
    if not any(cells_by_page.values()):
        return {"translated": 0, "kept_source": []}
    rendered = 0
    kept_source: list[dict] = []
    with fitz.open(output_pdf_path) as pdf, fitz.open() as overlays:
        for page_index, items in cells_by_page.items():
            output_index = page_index - start_page if mode == "dual" or extract_selected_pages else page_index
            page = pdf[output_index]
            shift = fitz.Rect(page.rect.width / 2, 0, page.rect.width / 2, 0) if mode == "dual" else fitz.Rect()
            placements: list[tuple] = []
            original_links = page.get_links()
            cell_links = []
            for item in items:
                text = str(item.get("translated_text") or "").strip()
                if not item.get("should_translate", True) or not text or text == item["source_text"]:
                    kept_source.append({"item_id": item["item_id"], "reason": "untranslated"})
                    continue
                html = _cell_html(text)
                if html is None:
                    kept_source.append({"item_id": item["item_id"], "reason": "complex_cell_math"})
                    continue
                cell = item["metadata"]["table_cell"]
                if sorted(re.findall(r"\d+(?:[.,]\d+)*", text)) != sorted(re.findall(r"\d+(?:[.,]\d+)*", item["source_text"])):
                    kept_source.append({"item_id": item["item_id"], "reason": "numeric_content_changed"})
                    continue
                box = fitz.Rect(cell["bbox"]) + shift
                padding_x = min(2.0, box.width * 0.05)
                padding_y = min(0.25, box.height * 0.02)
                target = box + (padding_x, padding_y, -padding_x, -padding_y)
                font_size = float(cell["font_size"])
                color = f"#{int(cell['color']):06x}"
                weight = "bold" if cell["bold"] else "normal"
                css = (f"* {{ margin: 0; padding: 0; }} div {{ font-family: sans-serif; "
                       f"font-size: {font_size}pt; line-height: 1.05; font-weight: {weight}; "
                       f"color: {color}; text-align: {cell.get('align', 'left')}; }}")
                overlay = overlays.new_page(width=page.rect.width, height=page.rect.height)
                spare, scale = overlay.insert_htmlbox(
                    target, html,
                    css=css, scale_low=min(1.0, 6.0 / font_size),
                )
                if spare < 0:
                    kept_source.append({"item_id": item["item_id"], "reason": "cell_overflow"})
                    continue
                # Centre the fitted content vertically without moving it outside its cell.
                height = target.height - spare
                clip = fitz.Rect(target.x0, target.y0, target.x1, target.y0 + height)
                destination = clip + (0, spare / 2, 0, spare / 2)
                source_box = fitz.Rect(cell["source_bbox"]) + shift
                for link in original_links:
                    if fitz.Rect(link["from"]).intersects(source_box):
                        anchor = page.get_text(clip=fitz.Rect(link["from"]) + (-1, -1, 1, 1)).strip()
                        cell_links.append((link, anchor, box, destination))
                page.add_redact_annot(source_box, fill=False, cross_out=False)
                placements.append((overlay.number, destination, clip))
            if placements:
                # Remove only original text: table rules, fills, images and numeric cells survive.
                page.apply_redactions(images=0, graphics=0, text=0)
                page = pdf.reload_page(page)
                for overlay_index, destination, clip in placements:
                    page.show_pdf_page(destination, overlays, overlay_index, clip=clip)
                    rendered += 1
                surviving_links = {link["xref"] for link in page.get_links()}
                for link, anchor, box, destination in cell_links:
                    if link["xref"] in surviving_links:
                        continue
                    restored = {key: value for key, value in link.items() if key not in {"xref", "id"}}
                    matches = page.search_for(anchor, clip=box) if anchor else []
                    restored["from"] = matches[0] if matches else destination
                    page.insert_link(restored)
        if rendered:
            pdf.saveIncr()
    return {"translated": rendered, "kept_source": kept_source}
