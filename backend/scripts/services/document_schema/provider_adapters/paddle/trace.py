from __future__ import annotations

from services.document_schema import default_block_derived
from services.document_schema.providers import PROVIDER_PADDLE
from services.document_schema.provider_adapters.common import normalize_polygon


def build_derived(raw_label: str, *, sub_type: str = "") -> dict:
    derived = default_block_derived()
    label = raw_label.strip().lower()
    if label == "doc_title":
        derived["role"] = "title"
        derived["by"] = "provider_rule"
        derived["confidence"] = 0.98
    elif label == "abstract":
        derived["role"] = "abstract"
        derived["by"] = "provider_rule"
        derived["confidence"] = 0.98
    elif label == "figure_title":
        derived["role"] = "caption"
        derived["by"] = "provider_rule"
        derived["confidence"] = 0.95
        if sub_type in {"table_caption", "image_caption", "code_caption"}:
            derived["role"] = sub_type
    elif label in {"header", "footer"}:
        derived["role"] = label
        derived["by"] = "provider_rule"
        derived["confidence"] = 0.98
    elif label == "reference_content":
        derived["role"] = "reference_entry"
        derived["by"] = "provider_rule"
        derived["confidence"] = 0.98
    elif label == "formula_number":
        derived["role"] = "formula_number"
        derived["by"] = "provider_rule"
        derived["confidence"] = 0.98
    elif label == "number":
        derived["role"] = "page_number"
        derived["by"] = "provider_rule"
        derived["confidence"] = 0.95
    elif label == "aside_text":
        derived["role"] = "metadata"
        derived["by"] = "provider_rule"
        derived["confidence"] = 0.95
    elif label == "footnote":
        derived["role"] = "footnote"
        derived["by"] = "provider_rule"
        derived["confidence"] = 0.9
    elif label == "vision_footnote":
        derived["role"] = sub_type or "footnote"
        derived["by"] = "provider_rule"
        derived["confidence"] = 0.9
    return derived


def build_metadata(block: dict, kind_metadata: dict) -> dict:
    return {
        "raw_group_id": block.get("group_id"),
        "raw_global_block_id": block.get("global_block_id"),
        "raw_global_group_id": block.get("global_group_id"),
        "raw_block_order": block.get("block_order"),
        "raw_polygon": normalize_polygon(block.get("block_polygon_points")),
        **kind_metadata,
    }


def build_source(
    *,
    block: dict,
    page_index: int,
    raw_label: str,
    bbox: list[float],
    text: str,
    order: int,
) -> dict:
    return {
        "provider": PROVIDER_PADDLE,
        "raw_page_index": page_index,
        "raw_type": raw_label,
        "raw_sub_type": "",
        "raw_bbox": bbox,
        "raw_text_excerpt": text[:200],
        "raw_block_id": block.get("block_id"),
        "raw_path": f"/layoutParsingResults/{page_index}/prunedResult/parsing_res_list/{order}",
    }


__all__ = [
    "build_derived",
    "build_metadata",
    "build_source",
]
