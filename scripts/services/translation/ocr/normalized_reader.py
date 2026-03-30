from __future__ import annotations

from typing import Iterable

SCHEMA_PREFIX = "normalized_document_v"


def is_normalized_document(data: dict) -> bool:
    return str(data.get("schema", "") or "").startswith(SCHEMA_PREFIX)


def ensure_normalized_document(data: dict) -> dict:
    if not is_normalized_document(data):
        raise RuntimeError("expected normalized_document_v1 JSON data")
    return data


def iter_page_blocks(data: dict, page: dict) -> Iterable[dict]:
    ensure_normalized_document(data)
    return page.get("blocks", []) or []


def block_children(data: dict, block: dict) -> list[dict]:
    ensure_normalized_document(data)
    return block.get("blocks", []) or []


def raw_block_type(block: dict) -> str:
    source = block.get("source", {}) or {}
    return str(source.get("raw_type", block.get("type", "unknown")) or "unknown")


def normalized_block_kind(block: dict, data: dict | None = None) -> str:
    if data is not None:
        ensure_normalized_document(data)
    block_type = str(block.get("type", "") or "")
    sub_type = str(block.get("sub_type", "") or "")
    tags = {str(tag or "") for tag in (block.get("tags", []) or [])}
    derived = block.get("derived", {}) or {}
    derived_role = str(derived.get("role", "") or "")
    if block_type == "formula" and sub_type == "display_formula":
        return "interline_equation"
    if block_type == "image":
        return "image_body"
    if block_type == "table":
        return "table_body"
    if block_type == "code":
        return "code_body"
    if block_type == "text" and sub_type == "title":
        return "title"
    if derived_role == "caption":
        if "image_caption" in tags:
            return "image_caption"
        if "table_caption" in tags:
            return "table_caption"
        if "table_footnote" in tags:
            return "table_footnote"
        return "text"
    if "image_caption" in tags:
        return "image_caption"
    if "table_caption" in tags:
        return "table_caption"
    if "table_footnote" in tags:
        return "table_footnote"
    if "image_footnote" in tags:
        return "text"
    if block_type == "text":
        return "text"
    return str(block.get("type", "unknown") or "unknown")


def block_sub_type(block: dict, data: dict | None = None) -> str:
    if data is not None:
        ensure_normalized_document(data)
    return str(block.get("sub_type", "") or "")
