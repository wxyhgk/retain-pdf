from __future__ import annotations

from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru.adapter import (
    build_mineru_document,
)


def looks_like_mineru_layout(payload: dict) -> bool:
    pdf_info = payload.get("pdf_info")
    if not isinstance(pdf_info, list):
        return False
    if not pdf_info:
        return True
    first_page = pdf_info[0]
    return isinstance(first_page, dict) and "para_blocks" in first_page


__all__ = [
    "build_mineru_document",
    "looks_like_mineru_layout",
]
