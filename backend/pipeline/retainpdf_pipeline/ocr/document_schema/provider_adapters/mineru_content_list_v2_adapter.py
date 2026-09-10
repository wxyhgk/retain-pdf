from __future__ import annotations

from pathlib import Path

from retainpdf_pipeline.ocr.document_schema import default_block_derived
from retainpdf_pipeline.ocr.document_schema.provider_adapters.common import (
    build_block_record,
    build_document_record,
    build_line_records,
    build_page_record,
    build_text_segments,
    normalize_bbox,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru.projection import (
    project_mineru_block,
)
from retainpdf_pipeline.ocr.document_schema.providers import (
    PROVIDER_MINERU_CONTENT_LIST_V2,
)
from retainpdf_pipeline.ocr.document_schema.text_flow import (
    classify_text_flow,
    line_texts_from_lines,
)
from retainpdf_pipeline.ocr.mineru.contracts import (
    MINERU_CONTENT_LIST_V2_FILE_NAME,
)

TEXTUAL_BLOCK_TYPES = {
    "title",
    "paragraph",
    "page_header",
    "page_footer",
    "page_number",
    "page_aside_text",
    "page_footnote",
}

_V2_TO_MIDDLE_LABEL = {
    "paragraph": "text",
    "equation_interline": "interline_equation",
    "page_header": "header",
    "page_footer": "footer",
    "page_aside_text": "aside_text",
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
    return (
        isinstance(first_block, dict)
        and "type" in first_block
        and "content" in first_block
    )


def build_mineru_content_list_v2_document(
    payload: list,
    document_id: str,
    source_json_path: Path,
    provider_version: str,
) -> dict:
    pages = [
        build_page_spec(page, page_idx=page_idx)
        for page_idx, page in enumerate(payload)
    ]
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
        record = build_block_record(
            build_block_spec(block, page_idx=page_idx, order=order)
        )
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
    lines, segments, text = extract_text_structure(block)
    projected_label = _V2_TO_MIDDLE_LABEL.get(raw_type, raw_type)
    projection = project_mineru_block(
        projected_label,
        raw_sub_type=str(block.get("sub_type", "") or ""),
        has_text=bool(text),
    )
    explicit_line_texts = [line.strip() for line in text.splitlines() if line.strip()]
    line_texts = (
        explicit_line_texts
        if len(explicit_line_texts) >= 2
        else line_texts_from_lines(lines)
    )
    text_flow = classify_text_flow(text=text, lines=lines)
    return {
        "block_id": f"p{page_idx + 1:03d}-b{order:04d}",
        "page_index": page_idx,
        "order": order,
        "content_kind": projection.content_kind,
        "sub_type": projection.sub_type,
        "bbox": bbox,
        "content": {
            "kind": projection.content_kind,
            "text": text,
            **(
                {"line_texts": line_texts, "text_flow": text_flow} if line_texts else {}
            ),
        },
        "text": text,
        "lines": lines,
        "segments": segments,
        "tags": list(projection.tags),
        "derived": _derived_for_projection(projection),
        "layout_role": projection.layout_role,
        "semantic_role": projection.semantic_role,
        "structure_role": projection.structure_role,
        "policy": {
            "translate": projection.translate,
            "translate_reason": projection.translate_reason,
        },
        "metadata": {
            "raw_sub_type": str(block.get("sub_type", "") or ""),
            "parent_block_id": "",
        },
        "source": {
            "provider": PROVIDER_MINERU_CONTENT_LIST_V2,
            "raw_page_index": page_idx,
            "raw_type": raw_type,
            "raw_sub_type": str(block.get("sub_type", "") or ""),
            "raw_bbox": bbox,
            "raw_text_excerpt": text[:200],
            "raw_unit": "normalized_1000",
            "raw_origin": "top_left",
        },
    }


def map_block_kind(raw_type: str) -> tuple[str, str]:
    projection = project_mineru_block(_V2_TO_MIDDLE_LABEL.get(raw_type, raw_type))
    return projection.content_kind, projection.sub_type


def _derived_for_projection(projection) -> dict:
    if projection.layout_role == "caption":
        return {"role": "caption", "by": "provider_rule", "confidence": 0.98}
    if projection.semantic_role == "abstract":
        return {"role": "abstract", "by": "provider_rule", "confidence": 0.98}
    if projection.semantic_role == "reference":
        return {
            "role": "reference_entry",
            "by": "provider_rule",
            "confidence": 0.98,
        }
    return default_block_derived()


def extract_text_structure(block: dict) -> tuple[list[dict], list[dict], str]:
    raw_type = str(block.get("type", "") or "")
    if raw_type in {"list", "index"}:
        items = ((block.get("content") or {}).get("list_items")) or []
        segments = []
        for list_item in items:
            if isinstance(list_item, str):
                segments.extend(build_text_segments(list_item.strip(), raw_type="text"))
            elif isinstance(list_item, dict):
                segments.extend(normalize_segments(list_item.get("item_content") or []))
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
        "page_footnote": "page_footnote_content",
    }
    if raw_type == "equation_interline":
        return _single_value_structure(
            content.get("math_content"),
            bbox=normalize_bbox(block.get("bbox")),
            raw_type="equation_interline",
            segment_type="formula",
        )
    if raw_type in {"code", "algorithm"}:
        content_key = "code_content" if raw_type == "code" else "algorithm_content"
        return _single_value_structure(
            content.get(content_key),
            bbox=normalize_bbox(block.get("bbox")),
            raw_type=raw_type,
        )
    raw_segments = (
        content.get(key_map.get(raw_type, ""), [])
        if raw_type in TEXTUAL_BLOCK_TYPES
        else []
    )
    segments = normalize_segments(raw_segments)
    text = " ".join(seg["text"] for seg in segments if seg["text"]).strip()
    line_bbox = normalize_bbox(block.get("bbox"))
    lines = build_line_records(line_bbox, segments)
    return lines, segments, text


def _single_value_structure(
    value: object,
    *,
    bbox: list[float],
    raw_type: str,
    segment_type: str = "text",
) -> tuple[list[dict], list[dict], str]:
    if isinstance(value, list):
        segments = normalize_segments(value)
        if segment_type != "text":
            for segment in segments:
                segment["type"] = segment_type
    else:
        text = str(value or "").strip()
        segments = build_text_segments(
            text,
            raw_type=raw_type,
            segment_type=segment_type,
        )
    text = " ".join(seg["text"] for seg in segments if seg["text"]).strip()
    return build_line_records(bbox, segments), segments, text


def normalize_segments(raw_segments: list[dict]) -> list[dict]:
    segments = []
    for raw in raw_segments or []:
        if not isinstance(raw, dict):
            continue
        raw_type = str(raw.get("type", "") or "text")
        if raw_type == "hyperlink" and isinstance(raw.get("children"), list):
            segments.extend(normalize_segments(raw["children"]))
            continue
        text = str(raw.get("content", "") or "").strip()
        if not text:
            continue
        seg_type = "inline_formula" if raw_type == "equation_inline" else "text"
        segments.extend(
            build_text_segments(text, raw_type=raw_type, segment_type=seg_type)
        )
    return segments


__all__ = [
    "build_mineru_content_list_v2_document",
    "looks_like_mineru_content_list_v2",
]
