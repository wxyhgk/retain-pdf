from pathlib import Path

import fitz

from services.rendering.document.metadata import copy_toc
from services.rendering.document.pdf_ops import save_optimized_pdf
from services.rendering.document.pdf_ops import strip_page_links
from services.rendering.source.cleanup.analysis import page_has_large_background_image


EDITABLE_TEXT_MIN_WORDS = 20
PSEUDO_EDITABLE_SCAN_MIN_WORDS = 80


def page_word_count(page: fitz.Page) -> int:
    try:
        return len(page.get_text("words"))
    except Exception:
        return 0


def page_is_pseudo_editable_scan(page: fitz.Page) -> bool:
    words = page_word_count(page)
    if words < PSEUDO_EDITABLE_SCAN_MIN_WORDS:
        return False
    return page_has_large_background_image(page)


def page_has_editable_text(page: fitz.Page) -> bool:
    words = page_word_count(page)
    if words < EDITABLE_TEXT_MIN_WORDS:
        return False
    if page_is_pseudo_editable_scan(page):
        return False
    return True


def extract_single_page_pdf(source_pdf_path: Path, output_pdf_path: Path, page_idx: int) -> None:
    source_doc = fitz.open(source_pdf_path)
    output_doc = fitz.open()
    output_doc.insert_pdf(source_doc, from_page=page_idx, to_page=page_idx)
    copy_toc(source_doc, output_doc, start_page=page_idx, end_page=page_idx)
    strip_page_links(output_doc[0])
    save_optimized_pdf(output_doc, output_pdf_path)
    output_doc.close()
    source_doc.close()
