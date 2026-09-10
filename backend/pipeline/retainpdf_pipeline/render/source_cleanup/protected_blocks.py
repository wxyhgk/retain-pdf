from __future__ import annotations

import json
from pathlib import Path

from retainpdf_pipeline.render.semantics.document_reader import block_bbox
from retainpdf_pipeline.render.semantics.document_reader import block_kind
from retainpdf_pipeline.render.semantics.document_reader import block_policy_translate
from retainpdf_pipeline.render.semantics.document_reader import block_text
from retainpdf_pipeline.render.semantics.document_reader import get_pages


def protected_pages_from_document_path(document_path: Path | None) -> dict[int, list[dict]]:
    if document_path is None or not Path(document_path).exists():
        return {}
    try:
        data = json.loads(Path(document_path).read_text(encoding="utf-8"))
    except Exception:
        return {}
    return protected_pages_from_document(data)


def protected_pages_from_document(data: dict) -> dict[int, list[dict]]:
    protected_pages: dict[int, list[dict]] = {}
    for page in get_pages(data):
        page_index = int(page.get("page_index", page.get("page", 1) - 1) or 0)
        protected_items = [
            protected_item_from_block(block)
            for block in page.get("blocks", []) or []
            if block_should_protect_source(block)
        ]
        protected_items = [item for item in protected_items if item is not None]
        if protected_items:
            protected_pages[page_index] = protected_items
    return protected_pages


def block_should_protect_source(block: dict) -> bool:
    if block_kind(block) != "text":
        return False
    if block_policy_translate(block) is not False:
        return False
    bbox = block_bbox(block)
    if len(bbox) != 4 or all(float(value or 0.0) == 0.0 for value in bbox):
        return False
    return bool(block_text(block).strip())


def protected_item_from_block(block: dict) -> dict | None:
    bbox = block_bbox(block)
    if len(bbox) != 4:
        return None
    return {
        "item_id": str(block.get("block_id") or ""),
        "block_kind": "text",
        "block_type": "text",
        "bbox": bbox,
        "source_text": block_text(block),
        "protected_source_text": block_text(block),
        "final_status": "kept_origin",
    }


__all__ = [
    "block_should_protect_source",
    "protected_pages_from_document",
    "protected_pages_from_document_path",
]
