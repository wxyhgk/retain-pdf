from __future__ import annotations

from services.document_schema.provider_adapters.common.specs import NormalizedPageSpec
from services.document_schema.provider_adapters.paddle.page_reader import build_page_spec


def iter_page_specs(payload: dict) -> list[NormalizedPageSpec]:
    pages_meta = ((payload.get("dataInfo") or {}).get("pages") or [])
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
