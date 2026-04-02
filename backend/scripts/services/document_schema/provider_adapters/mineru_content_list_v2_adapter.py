from __future__ import annotations

from pathlib import Path

from services.document_schema import default_block_derived
from services.document_schema.providers import PROVIDER_MINERU_CONTENT_LIST_V2
from services.document_schema.provider_adapters.common import build_block_record
from services.document_schema.provider_adapters.common import build_document_record
from services.document_schema.provider_adapters.common import build_line_records
from services.document_schema.provider_adapters.common import build_page_record
from services.document_schema.provider_adapters.common import build_text_segments
from services.document_schema.provider_adapters.common import normalize_bbox
from services.mineru.contracts import MINERU_CONTENT_LIST_V2_FILE_NAME


TEXTUAL_BLOCK_TYPES = {
    "title",
    "paragraph",
    "page_header",
    "page_footer",
    "page_number",
    "page_aside_text",
}


def looks_like_mineru_content_list_v2(payload: dict | list) -> bool:
    if not isinstance(payload, list):
        return False
    if not payload:
        return True
    first_page = payload[0]
    if not isinstance(first_page, list):
        return False
    if not first_page:
        return True
    first_block = first_page[0]
    return isinstance(first_block, dict) and "type" in first_block and "content" in first_block


def build_mineru_content_list_v2_document(
    payload: list,
    document_id: str,
    source_json_path: Path,
    provider_version: str,
) -> dict:
    pages = [build_page_spec(page, page_idx=page_idx) for page_idx, page in enumerate(payload)]
    return build_document_record(
        document_id=document_id,
        provider=PROVIDER_MINERU_CONTENT_LIST_V2,
        provider_version=provider_version,
        source_json_path=source_json_path,
        raw_file_key=MINERU_CONTENT_LIST_V2_FILE_NAME.removesuffix(".json"),
        pages=[build_page_record(page) for page in pages],
        notes="Adapted from MinerU content_list_v2 experimental payload.",
    )


def build_page_spec(page: list, *, page_idx: int) -> dict:
    blocks = []
    x1_max = 0.0
    y1_max = 0.0
    for order, block in enumerate(page or []):
        record = build_block_record(build_block_spec(block, page_idx=page_idx, order=order))
        blocks.append(record)
        bbox = record["bbox"]
        if len(bbox) == 4:
            x1_max = max(x1_max, float(bbox[2]))
            y1_max = max(y1_max, float(bbox[3]))
    return {
        "page_index": page_idx,
        "width": x1_max,
        "height": y1_max,
        "unit": "pt",
        "blocks": blocks,
    }


def build_block_spec(block: dict, *, page_idx: int, order: int) -> dict:
    raw_type = str(block.get("type", "") or "")
    bbox = normalize_bbox(block.get("bbox"))
    block_type, sub_type = map_block_kind(raw_type)
    lines, segments, text = extract_text_structure(block)
    return {
        "block_id": f"p{page_idx + 1:03d}-b{order:04d}",
        "page_index": page_idx,
        "order": order,
        "block_type": block_type,
        "sub_type": sub_type,
        "bbox": bbox,
        "text": text,
        "lines": lines,
        "segments": segments,
        "tags": [],
        "derived": default_block_derived(),
        "metadata": {
            "raw_sub_type": "",
            "parent_block_id": "",
        },
        "source": {
            "provider": PROVIDER_MINERU_CONTENT_LIST_V2,
            "raw_page_index": page_idx,
            "raw_type": raw_type,
            "raw_sub_type": "",
            "raw_bbox": bbox,
            "raw_text_excerpt": text[:200],
        },
    }


def map_block_kind(raw_type: str) -> tuple[str, str]:
    if raw_type == "title":
        return "text", "title"
    if raw_type in {"paragraph", "page_aside_text", "list"}:
        return "text", "body"
    if raw_type == "page_header":
        return "text", "header"
    if raw_type == "page_footer":
        return "text", "footer"
    if raw_type == "page_number":
        return "text", "page_number"
    if raw_type == "image":
        return "image", "figure"
    return "unknown", ""


def extract_text_structure(block: dict) -> tuple[list[dict], list[dict], str]:
    raw_type = str(block.get("type", "") or "")
    if raw_type == "list":
        items = (((block.get("content") or {}).get("list_items")) or [])
        segments = []
        for list_item in items:
            for seg in normalize_segments((list_item.get("item_content") or [])):
                segments.append(seg)
        text = " ".join(seg["text"] for seg in segments if seg["text"]).strip()
        line_bbox = normalize_bbox(block.get("bbox"))
        lines = build_line_records(line_bbox, segments)
        return lines, segments, text

    content = block.get("content") or {}
    key_map = {
        "title": "title_content",
        "paragraph": "paragraph_content",
        "page_header": "page_header_content",
        "page_footer": "page_footer_content",
        "page_number": "page_number_content",
        "page_aside_text": "page_aside_text_content",
    }
    raw_segments = content.get(key_map.get(raw_type, ""), []) if raw_type in TEXTUAL_BLOCK_TYPES else []
    segments = normalize_segments(raw_segments)
    text = " ".join(seg["text"] for seg in segments if seg["text"]).strip()
    line_bbox = normalize_bbox(block.get("bbox"))
    lines = build_line_records(line_bbox, segments)
    return lines, segments, text


def normalize_segments(raw_segments: list[dict]) -> list[dict]:
    segments = []
    for raw in raw_segments or []:
        if not isinstance(raw, dict):
            continue
        raw_type = str(raw.get("type", "") or "text")
        text = str(raw.get("content", "") or "").strip()
        if not text:
            continue
        seg_type = "formula" if raw_type == "equation_inline" else "text"
        segments.extend(build_text_segments(text, raw_type=raw_type, segment_type=seg_type))
    return segments


__all__ = [
    "build_mineru_content_list_v2_document",
    "looks_like_mineru_content_list_v2",
]
