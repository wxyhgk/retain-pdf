from __future__ import annotations

from typing import Iterable

from retainpdf_pipeline.ocr.document_schema.classification import resolve_block_class
from retainpdf_pipeline.ocr.document_schema.text_flow import TEXT_FLOW_PRESERVE_LINES


SCHEMA_PREFIX = "normalized_document_v"


def is_normalized_document(data: dict) -> bool:
    return str(data.get("schema", "") or "").startswith(SCHEMA_PREFIX)


def ensure_normalized_document(data: dict) -> dict:
    if not is_normalized_document(data):
        raise RuntimeError("expected normalized_document_v1 JSON data")
    return data


def get_pages(data: dict) -> list[dict]:
    ensure_normalized_document(data)
    return data.get("pages", []) or []


def iter_page_blocks(data: dict, page: dict) -> Iterable[dict]:
    ensure_normalized_document(data)
    return page.get("blocks", []) or []


def block_children(data: dict, block: dict) -> list[dict]:
    ensure_normalized_document(data)
    return block.get("blocks", []) or []


def raw_block_type(block: dict) -> str:
    source = block.get("source", {}) or {}
    provenance = block.get("provenance", {}) or {}
    return str(provenance.get("raw_label", source.get("raw_type", "unknown")) or "unknown")


def block_bbox(block: dict) -> list[float]:
    bbox = list(block.get("bbox", []) or [])
    if len(bbox) == 4:
        return bbox
    geometry = block.get("geometry", {}) or {}
    bbox = list(geometry.get("bbox", []) or [])
    if len(bbox) == 4:
        return bbox
    return [0, 0, 0, 0]


def block_text(block: dict) -> str:
    content = block.get("content", {}) or {}
    return str(content.get("text", "") or "")


def block_line_texts(block: dict) -> list[str]:
    content = block.get("content", {}) or {}
    text = str(content.get("text", "") or "")
    explicit_lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(explicit_lines) >= 2:
        return explicit_lines
    values = content.get("line_texts", [])
    if isinstance(values, list):
        return [str(value).strip() for value in values if str(value).strip()]
    return []


def block_text_flow(block: dict) -> str:
    content = block.get("content", {}) or {}
    text = str(content.get("text", "") or "")
    if len([line for line in text.splitlines() if line.strip()]) >= 2:
        return TEXT_FLOW_PRESERVE_LINES
    return str(content.get("text_flow", "") or "").strip().lower()


def block_toc_entries(block: dict) -> list[dict]:
    content = block.get("content", {}) or {}
    entries = content.get("toc_entries", [])
    return list(entries) if isinstance(entries, list) else []


def block_kind(block: dict) -> str:
    content = block.get("content", {}) or {}
    return str(content.get("kind", "unknown") or "unknown").strip().lower()


def block_class(block: dict, data: dict | None = None) -> str:
    if data is not None:
        ensure_normalized_document(data)
    return resolve_block_class(block)


def block_asset_id(block: dict) -> str:
    content = block.get("content", {}) or {}
    return str(content.get("asset_id", "") or "").strip()


def block_asset_ids(block: dict) -> list[str]:
    content = block.get("content", {}) or {}
    raw_asset_ids = content.get("asset_ids", [])
    asset_ids = (
        [str(value).strip() for value in raw_asset_ids if str(value).strip()]
        if isinstance(raw_asset_ids, list)
        else []
    )
    primary = block_asset_id(block)
    if primary and primary not in asset_ids:
        asset_ids.insert(0, primary)
    return asset_ids


def block_reading_order(block: dict) -> int:
    value = block.get("reading_order", block.get("order", 0))
    if isinstance(value, int) and not isinstance(value, bool):
        return max(0, value)
    return 0


def block_layout_role(block: dict) -> str:
    return str(block.get("layout_role", "") or "").strip().lower()


def block_semantic_role(block: dict) -> str:
    return str(block.get("semantic_role", "") or "").strip().lower()


def block_structure_role(block: dict) -> str:
    return str(block.get("structure_role", "") or "").strip().lower()


def block_policy_translate(block: dict) -> bool | None:
    policy = block.get("policy", {}) or {}
    value = policy.get("translate")
    if isinstance(value, bool):
        return value
    return None


def normalized_block_kind(block: dict, data: dict | None = None) -> str:
    if data is not None:
        ensure_normalized_document(data)
    return block_kind(block)


def block_sub_type(block: dict, data: dict | None = None) -> str:
    if data is not None:
        ensure_normalized_document(data)
    return str(block.get("sub_type", "") or "")


__all__ = [
    "block_asset_id",
    "block_asset_ids",
    "block_bbox",
    "block_children",
    "block_class",
    "block_kind",
    "block_line_texts",
    "block_layout_role",
    "block_policy_translate",
    "block_reading_order",
    "block_semantic_role",
    "block_structure_role",
    "block_sub_type",
    "block_text",
    "block_text_flow",
    "block_toc_entries",
    "ensure_normalized_document",
    "get_pages",
    "is_normalized_document",
    "iter_page_blocks",
    "normalized_block_kind",
    "raw_block_type",
]
