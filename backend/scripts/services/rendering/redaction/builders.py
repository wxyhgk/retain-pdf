from pathlib import Path

import fitz

from services.rendering.redaction.document_ops import save_optimized_pdf, strip_page_links
from services.rendering.redaction.text_draw import apply_translated_items_to_page


def build_dev_pdf(
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_items: list[dict],
    page_idx: int,
    font_path: Path,
) -> None:
    doc = fitz.open(source_pdf_path)
    page = doc[page_idx]
    strip_page_links(page)
    apply_translated_items_to_page(page, translated_items, font_path)

    save_optimized_pdf(doc, output_pdf_path)
    doc.close()


def build_single_page_dev_pdf(
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_items: list[dict],
    page_idx: int,
    font_path: Path,
) -> None:
    temp_doc = fitz.open()
    source_doc = fitz.open(source_pdf_path)
    temp_doc.insert_pdf(source_doc, from_page=page_idx, to_page=page_idx)
    page = temp_doc[0]
    strip_page_links(page)
    apply_translated_items_to_page(page, translated_items, font_path)

    save_optimized_pdf(temp_doc, output_pdf_path)
    temp_doc.close()
    source_doc.close()
