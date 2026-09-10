from __future__ import annotations

from pathlib import Path

from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_PADDLE
from retainpdf_pipeline.ocr.document_schema.provider_adapters.common import build_document_record
from retainpdf_pipeline.ocr.document_schema.provider_adapters.common import build_page_record
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.column_signals import summarize_document_column_signals
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.caption_asset_relations import (
    attach_adjacent_caption_asset_relations,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.continuation import assign_paddle_continuation_hints
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.payload_reader import iter_page_specs


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
    assign_paddle_continuation_hints(pages)
    attach_adjacent_caption_asset_relations(pages)
    document = build_document_record(
        document_id=document_id,
        provider=PROVIDER_PADDLE,
        provider_version=provider_version,
        source_json_path=source_json_path,
        pages=pages,
        notes="Adapted from PaddleOCR layoutParsingResults payload.",
    )
    document.setdefault("derived", {})
    document["derived"]["provider_signals"] = summarize_document_column_signals(pages)
    document["derived"]["provider_payload_meta"] = dict(payload.get("_meta") or {})
    data_info = dict(payload.get("dataInfo") or {})
    document["derived"]["provider_data_info"] = {
        key: value for key, value in data_info.items() if key != "pages"
    }
    return document


__all__ = [
    "build_paddle_document",
    "looks_like_paddle_layout",
]
