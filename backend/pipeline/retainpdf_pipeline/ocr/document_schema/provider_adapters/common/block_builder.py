from __future__ import annotations

from retainpdf_pipeline.ocr.document_schema.classification import (
    derive_block_class,
)
from retainpdf_pipeline.ocr.document_schema.defaults import (
    normalize_block_continuation_hint,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.common.specs import (
    NormalizedBlockSpec,
)


def build_block_record(spec: NormalizedBlockSpec) -> dict:
    bbox = list(spec.get("bbox", [0, 0, 0, 0]) or [0, 0, 0, 0])
    text = str(spec.get("text", "") or "")
    supplied_content = dict(spec.get("content", {}) or {})
    legacy_block_type = str(spec.get("block_type", "") or "").strip().lower()
    content_kind = str(
        spec.get(
            "content_kind",
            supplied_content.get("kind", legacy_block_type or "unknown"),
        )
        or "unknown"
    ).strip().lower()
    supplied_kind = str(supplied_content.get("kind", "") or "").strip().lower()
    if supplied_kind and supplied_kind != content_kind:
        raise ValueError(
            "NormalizedBlockSpec content_kind must match content.kind: "
            f"content_kind={content_kind!r} content.kind={supplied_kind!r}"
        )
    if legacy_block_type and legacy_block_type != content_kind:
        raise ValueError(
            "NormalizedBlockSpec legacy block_type must match content_kind: "
            f"block_type={legacy_block_type!r} content_kind={content_kind!r}"
        )
    supplied_content["kind"] = content_kind
    supplied_content.setdefault("text", text)
    record = {
        "block_id": str(spec.get("block_id", "") or ""),
        "page_index": int(spec.get("page_index", 0) or 0),
        "order": int(spec.get("order", 0) or 0),
        "type": content_kind,
        "sub_type": str(spec.get("sub_type", "") or ""),
        "bbox": bbox,
        "text": text,
        "lines": list(spec.get("lines", []) or []),
        "segments": list(spec.get("segments", []) or []),
        "tags": list(spec.get("tags", []) or []),
        "derived": dict(spec.get("derived", {}) or {}),
        "continuation_hint": normalize_block_continuation_hint(spec.get("continuation_hint")),
        "metadata": dict(spec.get("metadata", {}) or {}),
        "source": dict(spec.get("source", {}) or {}),
    }
    record["reading_order"] = int(spec.get("reading_order", record["order"]) or record["order"])
    record["geometry"] = dict(spec.get("geometry", {}) or {"bbox": bbox})
    record["content"] = supplied_content
    if "layout_role" in spec:
        record["layout_role"] = str(spec.get("layout_role", "") or "")
    if "semantic_role" in spec:
        record["semantic_role"] = str(spec.get("semantic_role", "") or "")
    if "structure_role" in spec:
        record["structure_role"] = str(spec.get("structure_role", "") or "")
    record["block_class"] = str(spec.get("block_class", "") or "") or derive_block_class(
        content_kind=content_kind,
        layout_role=record.get("layout_role", ""),
        semantic_role=record.get("semantic_role", ""),
        structure_role=record.get("structure_role", ""),
    )
    if "policy" in spec:
        record["policy"] = dict(spec.get("policy", {}) or {})
    if "provenance" in spec:
        record["provenance"] = dict(spec.get("provenance", {}) or {})
    return record
