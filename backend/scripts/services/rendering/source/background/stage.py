from __future__ import annotations

from pathlib import Path

import fitz

from services.rendering.source.document_ops import save_optimized_pdf
from services.rendering.document.pikepdf_pages import copy_pdf_with_pikepdf
from services.rendering.layout.model.models import RenderPageSpec
from services.rendering.policy import page_has_formula_region
from services.rendering.policy import protect_formula_regions_in_redaction_items
from services.rendering.source.background.redaction_items import redaction_items_from_layout_blocks
from services.rendering.document.metadata import copy_toc
from services.rendering.source.items import iter_valid_translated_items
from services.rendering.source.redaction import redact_source_text_areas
from services.rendering.source.vector_text import collect_vector_text_rects


def build_clean_background_pdf(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    output_pdf_path: Path,
    redaction_strategy: str | None = None,
    page_specs: list[RenderPageSpec] | None = None,
) -> Path:
    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
    working_pdf_path = output_pdf_path.with_suffix(".background-source.pdf")
    copy_pdf_with_pikepdf(source_pdf_path=source_pdf_path, output_pdf_path=working_pdf_path)
    source_doc = fitz.open(source_pdf_path)
    output_doc = fitz.open(working_pdf_path)
    specs_by_page = {spec.page_index: spec for spec in page_specs or []}
    try:
        copy_toc(source_doc, output_doc)
        for page_index in sorted(translated_pages):
            if not (0 <= page_index < len(output_doc)):
                continue
            page = output_doc[page_index]
            redaction_items = translated_pages[page_index]
            if page_index in specs_by_page:
                redaction_items = redaction_items_from_layout_blocks(
                    translated_pages[page_index],
                    specs_by_page[page_index].blocks,
                )
            redaction_items = protect_formula_regions_in_redaction_items(
                redaction_items,
                translated_pages[page_index],
            )
            target_rects = [
                rect for rect, _item, _translated_text in iter_valid_translated_items(redaction_items)
            ]
            page_redaction_strategy = (
                "visual_cover"
                if redaction_strategy is None and page_has_formula_region(translated_pages[page_index])
                else redaction_strategy
            )
            redact_source_text_areas(
                page,
                redaction_items,
                fill_background=None,
                cover_only=bool(collect_vector_text_rects(page, target_rects)),
                strategy=page_redaction_strategy,
            )
        save_optimized_pdf(output_doc, output_pdf_path)
        return output_pdf_path
    finally:
        output_doc.close()
        source_doc.close()
