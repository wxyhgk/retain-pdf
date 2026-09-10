from __future__ import annotations

"""Compatibility facade for the MinerU document adapter.

Provider transport remains under ``services.mineru``. Raw-to-document.v1
normalization is owned by ``services.document_schema.provider_adapters``.
"""

from pathlib import Path

from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru.adapter import (
    build_mineru_document,
    build_normalized_document_from_layout_path,
    build_normalized_document_from_layout_payload,
)


def build_normalized_document(
    *,
    layout_payload: dict,
    document_id: str,
    layout_json_path: Path,
    provider_version: str = "",
) -> dict:
    return build_mineru_document(
        payload=layout_payload,
        document_id=document_id,
        source_json_path=layout_json_path,
        provider_version=provider_version,
    )


__all__ = [
    "build_normalized_document",
    "build_normalized_document_from_layout_path",
    "build_normalized_document_from_layout_payload",
]
