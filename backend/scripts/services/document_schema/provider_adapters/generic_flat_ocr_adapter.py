from __future__ import annotations

from pathlib import Path

from services.document_schema import DOCUMENT_SCHEMA_NAME
from services.document_schema import DOCUMENT_SCHEMA_VERSION
from services.document_schema import default_block_derived
from services.document_schema.providers import PROVIDER_GENERIC_FLAT_OCR


def looks_like_generic_flat_ocr(payload: dict) -> bool:
    return (
        isinstance(payload, dict)
        and str(payload.get("provider", "") or "") == PROVIDER_GENERIC_FLAT_OCR
        and isinstance(payload.get("pages"), list)
    )


def build_generic_flat_ocr_document(
    payload: dict,
    document_id: str,
    source_json_path: Path,
    provider_version: str,
) -> dict:
    pages = []
    for page_index, page in enumerate(payload.get("pages", []) or []):
        page_blocks = []
        for order, block in enumerate(page.get("blocks", []) or []):
            bbox = list(block.get("bbox", []) or [0, 0, 0, 0])
            page_blocks.append(
                {
                    "block_id": f"p{page_index + 1:03d}-b{order:04d}",
                    "page_index": page_index,
                    "order": order,
                    "type": str(block.get("type", "text") or "text"),
                    "sub_type": str(block.get("sub_type", "body") or "body"),
                    "bbox": bbox if len(bbox) == 4 else [0, 0, 0, 0],
                    "text": str(block.get("text", "") or ""),
                    "lines": list(block.get("lines", []) or []),
                    "segments": list(block.get("segments", []) or []),
                    "tags": list(block.get("tags", []) or []),
                    "derived": dict(block.get("derived", {}) or default_block_derived()),
                    "metadata": dict(block.get("metadata", {}) or {}),
                    "source": {
                        "provider": PROVIDER_GENERIC_FLAT_OCR,
                        "raw_page_index": page_index,
                        "raw_type": str(block.get("type", "text") or "text"),
                        "raw_sub_type": str(block.get("sub_type", "body") or "body"),
                        "raw_bbox": bbox,
                        "raw_text_excerpt": str(block.get("text", "") or "")[:200],
                    },
                }
            )
        pages.append(
            {
                "page_index": page_index,
                "width": float(page.get("width", 0) or 0),
                "height": float(page.get("height", 0) or 0),
                "unit": str(page.get("unit", "pt") or "pt"),
                "blocks": page_blocks,
            }
        )

    return {
        "schema": DOCUMENT_SCHEMA_NAME,
        "schema_version": DOCUMENT_SCHEMA_VERSION,
        "document_id": document_id,
        "source": {
            "provider": PROVIDER_GENERIC_FLAT_OCR,
            "provider_version": provider_version,
            "raw_files": {
                "source_json": str(source_json_path),
            },
        },
        "page_count": len(pages),
        "pages": pages,
        "derived": {
            "notes": "Adapted from generic_flat_ocr sample payload.",
        },
        "markers": {},
    }


__all__ = [
    "build_generic_flat_ocr_document",
    "looks_like_generic_flat_ocr",
]
