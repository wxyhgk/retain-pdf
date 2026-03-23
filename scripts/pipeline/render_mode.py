from __future__ import annotations

from pathlib import Path

import fitz


def resolve_page_range(total_pages: int, start_page: int, end_page: int) -> tuple[int, int]:
    start = max(0, start_page)
    stop = total_pages - 1 if end_page < 0 else min(end_page, total_pages - 1)
    if start > stop:
        raise RuntimeError(f"Invalid page range: start_page={start}, end_page={stop}")
    return start, stop


def is_editable_pdf(doc: fitz.Document, start_page: int, end_page: int) -> bool:
    sample_pages = range(start_page, min(end_page, start_page + 2) + 1)
    words = 0
    for page_idx in sample_pages:
        if 0 <= page_idx < len(doc):
            words += len(doc[page_idx].get_text("words"))
    return words >= 20


def resolve_effective_render_mode(
    *,
    render_mode: str,
    source_pdf_path: Path,
    start_page: int,
    end_page: int,
) -> str:
    if render_mode != "auto":
        return render_mode

    doc = fitz.open(source_pdf_path)
    try:
        effective_render_mode = "direct" if is_editable_pdf(doc, start_page, end_page) else "typst"
    finally:
        doc.close()
    print(f"auto render mode selected: {effective_render_mode}")
    return effective_render_mode
