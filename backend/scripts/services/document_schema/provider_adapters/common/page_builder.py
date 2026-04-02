from __future__ import annotations

from services.document_schema.provider_adapters.common.specs import NormalizedPageSpec


def build_page_record(spec: NormalizedPageSpec) -> dict:
    return {
        "page_index": int(spec.get("page_index", 0) or 0),
        "width": float(spec.get("width", 0) or 0),
        "height": float(spec.get("height", 0) or 0),
        "unit": str(spec.get("unit", "pt") or "pt"),
        "blocks": list(spec.get("blocks", []) or []),
        "metadata": dict(spec.get("metadata", {}) or {}),
    }
