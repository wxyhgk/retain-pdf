from __future__ import annotations

from pathlib import Path

from services.document_schema.providers import PROVIDER_PADDLE
from services.document_schema.provider_adapters.common import build_document_record
from services.document_schema.provider_adapters.common import build_page_record
from services.document_schema.provider_adapters.paddle.payload_reader import iter_page_specs


def looks_like_paddle_layout(payload: dict) -> bool:
    if not isinstance(payload, dict):
        return False
    layout_results = payload.get("layoutParsingResults")
    data_info = payload.get("dataInfo")
    return isinstance(layout_results, list) and isinstance(data_info, dict)


def build_paddle_document(
    payload: dict,
    document_id: str,
    source_json_path: Path,
    provider_version: str,
) -> dict:
    pages = [build_page_record(page_spec) for page_spec in iter_page_specs(payload)]
    return build_document_record(
        document_id=document_id,
        provider=PROVIDER_PADDLE,
        provider_version=provider_version,
        source_json_path=source_json_path,
        pages=pages,
        notes="Adapted from PaddleOCR layoutParsingResults payload.",
    )


__all__ = [
    "build_paddle_document",
    "looks_like_paddle_layout",
]
