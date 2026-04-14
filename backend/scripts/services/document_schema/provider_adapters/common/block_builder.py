from __future__ import annotations

from services.document_schema.defaults import normalize_block_continuation_hint
from services.document_schema.provider_adapters.common.specs import NormalizedBlockSpec


def build_block_record(spec: NormalizedBlockSpec) -> dict:
    return {
        "block_id": str(spec.get("block_id", "") or ""),
        "page_index": int(spec.get("page_index", 0) or 0),
        "order": int(spec.get("order", 0) or 0),
        "type": str(spec.get("block_type", "unknown") or "unknown"),
        "sub_type": str(spec.get("sub_type", "") or ""),
        "bbox": list(spec.get("bbox", [0, 0, 0, 0]) or [0, 0, 0, 0]),
        "text": str(spec.get("text", "") or ""),
        "lines": list(spec.get("lines", []) or []),
        "segments": list(spec.get("segments", []) or []),
        "tags": list(spec.get("tags", []) or []),
        "derived": dict(spec.get("derived", {}) or {}),
        "continuation_hint": normalize_block_continuation_hint(spec.get("continuation_hint")),
        "metadata": dict(spec.get("metadata", {}) or {}),
        "source": dict(spec.get("source", {}) or {}),
    }
