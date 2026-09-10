from __future__ import annotations

from retainpdf_pipeline.ocr.document_schema.provider_adapters.common.specs import NormalizedPageSpec
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.page_reader import build_page_spec


def data_info_is_complete(payload: dict) -> bool:
    metadata = payload.get("_meta") or {}
    if metadata.get("dataInfoComplete") is False:
        return False

    source = str(metadata.get("source", "") or "").strip().lower()
    if source == "paddle_jsonl":
        layout_results = payload.get("layoutParsingResults") or []
        pages_meta = ((payload.get("dataInfo") or {}).get("pages") or [])
        if isinstance(layout_results, list) and isinstance(pages_meta, list):
            return len(layout_results) == len(pages_meta)
    return True


def iter_page_specs(payload: dict) -> list[NormalizedPageSpec]:
    pages_meta = ((payload.get("dataInfo") or {}).get("pages") or [])
    if not data_info_is_complete(payload):
        # Partial/ambiguous JSONL metadata must not be positionally attached to
        # the wrong layout page.  Paddle prunedResult still carries width and
        # height and is the safe fallback used by build_page_spec.
        pages_meta = []
    layout_results = payload.get("layoutParsingResults") or []
    preprocessed_images = payload.get("preprocessedImages") or []

    page_specs: list[NormalizedPageSpec] = []
    for page_index, page_payload in enumerate(layout_results):
        page_meta = pages_meta[page_index] if page_index < len(pages_meta) else {}
        page_specs.append(
            build_page_spec(
                page_payload=page_payload or {},
                page_index=page_index,
                page_meta=page_meta if isinstance(page_meta, dict) else {},
                preprocessed_image=preprocessed_images[page_index] if page_index < len(preprocessed_images) else "",
            )
        )
    return page_specs


__all__ = ["data_info_is_complete", "iter_page_specs"]
