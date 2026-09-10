from __future__ import annotations

from retainpdf_pipeline.ocr.document_schema.provider_adapters.common import build_block_record
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.column_signals import analyze_page_column_signals
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.body_repair import repair_body_cross_column_blocks
from retainpdf_pipeline.ocr.document_schema.provider_adapters.common.specs import NormalizedPageSpec
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.block_reader import build_block_spec
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.context import PaddlePageContext
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.page_trace import build_layout_box_lookup
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.page_trace import build_page_trace
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.relations import classify_page_blocks


def _provider_allows_body_repair(pruned: dict) -> bool:
    model_settings = dict((pruned.get("model_settings") or {}))
    return bool(model_settings.get("enable_body_repair"))


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
    page_width = float(page_meta.get("width", pruned.get("width", 0)) or 0)
    original_column_signals = analyze_page_column_signals(
        parsing_res_list=parsing_res_list,
        page_width=page_width,
    )
    if _provider_allows_body_repair(pruned):
        repaired_parsing_res_list, repair_metadata, repair_summary = repair_body_cross_column_blocks(
            parsing_res_list=parsing_res_list,
            column_signals=original_column_signals,
        )
    else:
        repaired_parsing_res_list = list(parsing_res_list)
        repair_metadata = {}
        repair_summary = {
            "body_repair_pair_count": 0,
            "body_repair_pairs": [],
            "body_repair_block_count": 0,
        }
    repaired_classified_kinds = classify_page_blocks(repaired_parsing_res_list)
    column_signals = analyze_page_column_signals(
        parsing_res_list=repaired_parsing_res_list,
        page_width=page_width,
    )
    return {
        "page_index": page_index,
        "page_payload": page_payload,
        "page_meta": page_meta,
        "preprocessed_image": preprocessed_image,
        "pruned": pruned,
        "parsing_res_list": repaired_parsing_res_list,
        "layout_box_lookup": layout_box_lookup,
        "markdown_text": markdown_text,
        "markdown_images": markdown_images,
        "classified_kinds": repaired_classified_kinds,
        "column_signals": column_signals,
        "repair_metadata": repair_metadata,
        "repair_summary": repair_summary,
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
        page_index=page_context["page_index"],
        page_payload=page_context["page_payload"],
        page_meta=page_context["page_meta"],
        pruned=page_context["pruned"],
        preprocessed_image=page_context["preprocessed_image"],
        column_signals=page_context["column_signals"],
        block_ids=[block["block_id"] for block in blocks],
    )
    metadata["text_missing_but_bbox_present_count"] = sum(
        1
        for block in blocks
        if bool((block.get("metadata", {}) or {}).get("provider_text_missing_but_bbox_present"))
    )
    metadata["text_missing_but_bbox_present_block_ids"] = [
        block["block_id"]
        for block in blocks
        if bool((block.get("metadata", {}) or {}).get("provider_text_missing_but_bbox_present"))
    ]
    metadata["peer_block_absorbed_text_count"] = sum(
        1
        for block in blocks
        if bool((block.get("metadata", {}) or {}).get("provider_peer_block_absorbed_text"))
    )
    metadata["peer_block_absorbed_text_block_ids"] = [
        block["block_id"]
        for block in blocks
        if bool((block.get("metadata", {}) or {}).get("provider_peer_block_absorbed_text"))
    ]
    metadata["body_repair_pair_count"] = int(page_context["repair_summary"].get("body_repair_pair_count", 0) or 0)
    metadata["body_repair_block_count"] = int(page_context["repair_summary"].get("body_repair_block_count", 0) or 0)
    metadata["body_repair_pairs"] = list(page_context["repair_summary"].get("body_repair_pairs", []) or [])
    metadata["body_repair_block_ids"] = [
        block["block_id"]
        for block in blocks
        if bool((block.get("metadata", {}) or {}).get("provider_body_repair_applied"))
    ]
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
