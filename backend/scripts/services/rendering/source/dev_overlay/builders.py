from pathlib import Path

import fitz

from services.rendering.document.metadata import copy_toc
from services.rendering.document.pikepdf_pages import extract_pages_with_pikepdf
from services.rendering.source.document_ops import save_optimized_pdf
from services.rendering.source.document_ops import strip_page_links
from services.rendering.source.dev_overlay.text_draw import apply_translated_items_to_page


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
    temp_source_path = output_pdf_path.with_suffix(".source-page.pdf")
    extract_pages_with_pikepdf(
        source_pdf_path=source_pdf_path,
        output_pdf_path=temp_source_path,
        start_page=page_idx,
        end_page=page_idx,
    )
    source_doc = fitz.open(source_pdf_path)
    temp_doc = fitz.open(temp_source_path)
    copy_toc(source_doc, temp_doc, start_page=page_idx, end_page=page_idx)
    page = temp_doc[0]
    strip_page_links(page)
    apply_translated_items_to_page(page, translated_items, font_path)

    save_optimized_pdf(temp_doc, output_pdf_path)
    temp_doc.close()
    source_doc.close()
