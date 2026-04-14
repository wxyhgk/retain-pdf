from __future__ import annotations

from pathlib import Path

import fitz

from services.rendering.api.pdf_overlay import redact_translated_text_areas
from services.rendering.api.pdf_overlay import save_optimized_pdf
from services.rendering.redaction.shared import iter_valid_translated_items
from services.rendering.redaction.vector_text_cleanup import collect_vector_text_rects


def build_clean_background_pdf(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    output_pdf_path: Path,
) -> Path:
    source_doc = fitz.open(source_pdf_path)
    output_doc = fitz.open()
    try:
        output_doc.insert_pdf(source_doc)
        for page_index in sorted(translated_pages):
            if not (0 <= page_index < len(output_doc)):
                continue
            page = output_doc[page_index]
            target_rects = [
                rect for rect, _item, _translated_text in iter_valid_translated_items(translated_pages[page_index])
            ]
            redact_translated_text_areas(
                page,
                translated_pages[page_index],
                fill_background=None,
                cover_only=bool(collect_vector_text_rects(page, target_rects)),
            )
        output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
        save_optimized_pdf(output_doc, output_pdf_path)
        return output_pdf_path
    finally:
        output_doc.close()
        source_doc.close()
