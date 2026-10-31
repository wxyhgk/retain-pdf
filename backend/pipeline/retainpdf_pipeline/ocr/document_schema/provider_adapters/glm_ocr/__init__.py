from __future__ import annotations


def build_glm_ocr_document(*args, **kwargs):
    from retainpdf_pipeline.ocr.document_schema.provider_adapters.glm_ocr.adapter import build_glm_ocr_document as _impl

    return _impl(*args, **kwargs)


def looks_like_glm_ocr_layout(*args, **kwargs):
    from retainpdf_pipeline.ocr.document_schema.provider_adapters.glm_ocr.adapter import looks_like_glm_ocr_layout as _impl

    return _impl(*args, **kwargs)

__all__ = [
    "build_glm_ocr_document",
    "looks_like_glm_ocr_layout",
]
