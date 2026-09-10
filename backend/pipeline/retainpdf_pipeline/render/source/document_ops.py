from __future__ import annotations

from pathlib import Path

import fitz

from retainpdf_pipeline.render.document.pdf_ops import save_optimized_pdf
from retainpdf_pipeline.render.document.pdf_ops import strip_page_links
from retainpdf_pipeline.render.document.pikepdf_pages import extract_pages_with_pikepdf
from retainpdf_pipeline.render.source.background.detect import page_has_large_background_image


EDITABLE_TEXT_MIN_WORDS = 20


def page_word_count(page: fitz.Page) -> int:
    try:
        return len(page.get_text("words"))
    except Exception:
        return 0


def page_is_pseudo_editable_scan(page: fitz.Page) -> bool:
    return page_has_large_background_image(page) and page_has_editable_text(page)


def page_has_editable_text(page: fitz.Page) -> bool:
    return _visible_text_traces(page) > 0 or page_word_count(page) >= EDITABLE_TEXT_MIN_WORDS


def _visible_text_traces(page: fitz.Page) -> int:
    try:
        traces = page.get_texttrace()
    except Exception:
        return 0
    visible = 0
    for trace in traces:
        try:
            render_mode = int(trace.get("type", 0))
        except Exception:
            render_mode = 0
        if render_mode != 3:
            visible += 1
    return visible


def extract_single_page_pdf(source_pdf_path: Path, output_pdf_path: Path, page_idx: int) -> None:
    extract_pages_with_pikepdf(
        source_pdf_path=source_pdf_path,
        output_pdf_path=output_pdf_path,
        start_page=page_idx,
        end_page=page_idx,
    )
