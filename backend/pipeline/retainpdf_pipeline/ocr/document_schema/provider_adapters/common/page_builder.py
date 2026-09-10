from __future__ import annotations

from retainpdf_pipeline.ocr.document_schema.provider_adapters.common.specs import NormalizedPageSpec


def build_page_record(spec: NormalizedPageSpec) -> dict:
    page_index = int(spec.get("page_index", 0) or 0)
    return {
        "page_index": page_index,
        "page": int(spec.get("page", page_index + 1) or (page_index + 1)),
        "width": float(spec.get("width", 0) or 0),
        "height": float(spec.get("height", 0) or 0),
        "unit": str(spec.get("unit", "pt") or "pt"),
        "blocks": list(spec.get("blocks", []) or []),
        "metadata": dict(spec.get("metadata", {}) or {}),
    }
