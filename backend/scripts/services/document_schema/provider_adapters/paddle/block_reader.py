from __future__ import annotations

from services.document_schema.provider_adapters.common import NormalizedBlockSpec
from services.document_schema.provider_adapters.common import normalize_bbox
from services.document_schema.provider_adapters.paddle.content_extract import build_lines
from services.document_schema.provider_adapters.paddle.content_extract import build_segments
from services.document_schema.provider_adapters.paddle.context import PaddleBlockContext
from services.document_schema.provider_adapters.paddle.context import PaddlePageContext
from services.document_schema.provider_adapters.paddle.page_trace import attach_layout_trace
from services.document_schema.provider_adapters.paddle.rich_content import enrich_rich_content_trace
from services.document_schema.provider_adapters.paddle.trace import build_derived
from services.document_schema.provider_adapters.paddle.trace import build_metadata
from services.document_schema.provider_adapters.paddle.trace import build_source


def build_block_context(*, page_context: PaddlePageContext, order: int) -> PaddleBlockContext:
    block = page_context["parsing_res_list"][order]
    raw_label = str(block.get("block_label", "") or "")
    bbox = normalize_bbox(block.get("block_bbox"))
    text = str(block.get("block_content", "") or "").strip()
    return {
        "page": page_context,
        "block": block,
        "order": order,
        "resolved_kind": page_context["classified_kinds"][order],
        "raw_label": raw_label,
        "bbox": bbox,
        "text": text,
    }


def build_block_metadata(
    *,
    block_context: PaddleBlockContext,
    kind_metadata: dict,
) -> dict:
    metadata = build_metadata(block_context["block"], kind_metadata)
    attach_layout_trace(
        metadata=metadata,
        bbox=block_context["bbox"],
        layout_box_lookup=block_context["page"]["layout_box_lookup"],
    )
    enrich_rich_content_trace(
        metadata=metadata,
        raw_label=block_context["raw_label"],
        text=block_context["text"],
        markdown_images=block_context["page"]["markdown_images"],
        markdown_text=block_context["page"]["markdown_text"],
    )
    return metadata


def build_block_spec(
    *,
    page_context: PaddlePageContext,
    order: int,
) -> NormalizedBlockSpec:
    block_context = build_block_context(page_context=page_context, order=order)
    block_type, sub_type, tags, kind_metadata = block_context["resolved_kind"]
    segments = build_segments(block_context["text"], block_context["raw_label"])
    lines = build_lines(bbox=block_context["bbox"], segments=segments)
    metadata = build_block_metadata(
        block_context=block_context,
        kind_metadata=kind_metadata,
    )
    return {
        "block_id": f"p{page_context['page_index'] + 1:03d}-b{order:04d}",
        "page_index": page_context["page_index"],
        "order": order,
        "block_type": block_type,
        "sub_type": sub_type,
        "bbox": block_context["bbox"],
        "text": block_context["text"],
        "lines": lines,
        "segments": segments,
        "tags": tags,
        "derived": build_derived(block_context["raw_label"], sub_type=sub_type),
        "metadata": metadata,
        "source": build_source(
            block=block_context["block"],
            page_index=page_context["page_index"],
            raw_label=block_context["raw_label"],
            bbox=block_context["bbox"],
            text=block_context["text"],
            order=order,
        ),
    }


__all__ = [
    "build_block_context",
    "build_block_spec",
]
