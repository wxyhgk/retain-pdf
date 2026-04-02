from __future__ import annotations

from services.document_schema.provider_adapters.common import build_block_record
from services.document_schema.provider_adapters.common.specs import NormalizedPageSpec
from services.document_schema.provider_adapters.paddle.block_reader import build_block_spec
from services.document_schema.provider_adapters.paddle.context import PaddlePageContext
from services.document_schema.provider_adapters.paddle.page_trace import build_layout_box_lookup
from services.document_schema.provider_adapters.paddle.page_trace import build_page_trace
from services.document_schema.provider_adapters.paddle.relations import classify_page_blocks


def build_page_context(
    *,
    page_payload: dict,
    page_index: int,
    page_meta: dict,
    preprocessed_image: str,
) -> PaddlePageContext:
    pruned = page_payload.get("prunedResult") or {}
    parsing_res_list = pruned.get("parsing_res_list") or []
    layout_box_lookup = build_layout_box_lookup(((pruned.get("layout_det_res") or {}).get("boxes") or []))
    markdown = page_payload.get("markdown") or {}
    markdown_text = str(markdown.get("text", "") or "")
    markdown_images = dict(markdown.get("images", {}) or {})
    classified_kinds = classify_page_blocks(parsing_res_list)
    return {
        "page_index": page_index,
        "page_payload": page_payload,
        "page_meta": page_meta,
        "preprocessed_image": preprocessed_image,
        "pruned": pruned,
        "parsing_res_list": parsing_res_list,
        "layout_box_lookup": layout_box_lookup,
        "markdown_text": markdown_text,
        "markdown_images": markdown_images,
        "classified_kinds": classified_kinds,
    }


def build_page_spec(
    *,
    page_payload: dict,
    page_index: int,
    page_meta: dict,
    preprocessed_image: str,
) -> NormalizedPageSpec:
    page_context = build_page_context(
        page_payload=page_payload,
        page_index=page_index,
        page_meta=page_meta,
        preprocessed_image=preprocessed_image,
    )
    blocks = [
        build_block_record(
            build_block_spec(
                page_context=page_context,
                order=order,
            )
        )
        for order, _block in enumerate(page_context["parsing_res_list"])
    ]
    metadata = build_page_trace(
        page_payload=page_context["page_payload"],
        pruned=page_context["pruned"],
        preprocessed_image=page_context["preprocessed_image"],
    )
    return {
        "page_index": page_context["page_index"],
        "width": float(page_context["page_meta"].get("width", page_context["pruned"].get("width", 0)) or 0),
        "height": float(page_context["page_meta"].get("height", page_context["pruned"].get("height", 0)) or 0),
        "unit": "pt",
        "blocks": blocks,
        "metadata": metadata,
    }


__all__ = [
    "build_page_context",
    "build_page_spec",
]
