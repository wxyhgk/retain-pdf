from __future__ import annotations

from retainpdf_pipeline.ocr.document_schema.provider_adapters.common import (
    NormalizedBlockSpec,
    normalize_bbox,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.content_extract import (
    assign_inline_formula_bboxes,
    build_lines,
    build_segments,
    inherit_missing_segment_bboxes,
    tighten_text_bbox,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.context import (
    PaddleBlockContext,
    PaddlePageContext,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.page_trace import (
    attach_layout_trace,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.rich_content import (
    enrich_rich_content_trace,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.roles import (
    derive_paddle_block_roles,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.trace import (
    build_derived,
    build_metadata,
    build_source,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.translation_policy import (
    derive_paddle_translation_policy,
)
from retainpdf_pipeline.ocr.document_schema.text_flow import (
    TEXT_FLOW_PRESERVE_LINES,
    classify_text_flow_for_role,
    line_texts_from_lines,
)
from retainpdf_pipeline.ocr.document_schema.toc import build_toc_entries


def _build_provenance(*, source: dict, raw_label: str) -> dict:
    return {
        "provider": str(source.get("provider", "") or ""),
        "raw_label": raw_label,
        "raw_sub_type": str(source.get("raw_sub_type", "") or ""),
        "raw_bbox": list(source.get("raw_bbox", [0, 0, 0, 0]) or [0, 0, 0, 0]),
        "raw_unit": str(source.get("raw_unit", "px") or "px"),
        "raw_origin": str(source.get("raw_origin", "top_left") or "top_left"),
        "raw_path": str(source.get("raw_path", "") or ""),
    }


def _apply_normalized_paddle_signals(metadata: dict) -> None:
    metadata["cross_column_merge_suspected"] = bool(
        metadata.get("provider_cross_column_merge_suspected")
    )
    metadata["reading_order_unreliable"] = bool(
        metadata.get("provider_reading_order_unreliable")
    )
    metadata["structure_unreliable"] = bool(
        metadata.get("provider_structure_unreliable")
    )
    metadata["text_missing_but_bbox_present"] = bool(
        metadata.get("provider_text_missing_but_bbox_present")
    )
    metadata["peer_block_absorbed_text"] = bool(
        metadata.get("provider_peer_block_absorbed_text")
    )
    metadata["body_repair_attempted"] = bool(
        metadata.get("provider_body_repair_attempted")
    )
    metadata["body_repair_applied"] = bool(metadata.get("provider_body_repair_applied"))
    metadata["body_repair_role"] = str(
        metadata.get("provider_body_repair_role", "") or ""
    )
    metadata["body_repair_strategy"] = str(
        metadata.get("provider_body_repair_strategy", "") or ""
    )
    metadata["body_repair_peer_block_id"] = str(
        metadata.get("provider_suspected_peer_block_id", "") or ""
    )
    metadata["continuation_suppressed"] = bool(
        metadata.get("provider_continuation_suppressed")
    )
    metadata["continuation_suppressed_reason"] = str(
        metadata.get("provider_continuation_suppressed_reason", "") or ""
    )
    metadata["column_layout_mode"] = str(
        metadata.get("provider_column_layout_mode", "") or ""
    )
    metadata["column_index_guess"] = str(
        metadata.get("provider_column_index_guess", "") or ""
    )


def build_block_context(
    *, page_context: PaddlePageContext, order: int
) -> PaddleBlockContext:
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
        "signal_metadata": {
            **dict(
                (page_context["column_signals"].get("block_signals", {}) or {}).get(
                    order, {}
                )
                or {}
            ),
            **dict(
                (page_context.get("repair_metadata", {}) or {}).get(order, {}) or {}
            ),
        },
    }


def build_block_metadata(
    *,
    block_context: PaddleBlockContext,
    kind_metadata: dict,
) -> dict:
    metadata = build_metadata(block_context["block"], kind_metadata)
    metadata.update(block_context["signal_metadata"])
    attach_layout_trace(
        metadata=metadata,
        bbox=block_context["bbox"],
        layout_box_lookup=block_context["page"]["layout_box_lookup"],
    )
    enrich_rich_content_trace(
        metadata=metadata,
        raw_label=block_context["raw_label"],
        text=block_context["text"],
        bbox=block_context["bbox"],
        markdown_images=block_context["page"]["markdown_images"],
        markdown_text=block_context["page"]["markdown_text"],
    )
    peer_order = metadata.get("provider_suspected_peer_order")
    if isinstance(peer_order, int) and peer_order >= 0:
        metadata["provider_suspected_peer_block_id"] = (
            f"p{block_context['page']['page_index'] + 1:03d}-b{peer_order:04d}"
        )
    else:
        metadata["provider_suspected_peer_block_id"] = ""
    _apply_normalized_paddle_signals(metadata)
    return metadata


def build_block_spec(
    *,
    page_context: PaddlePageContext,
    order: int,
) -> NormalizedBlockSpec:
    block_context = build_block_context(page_context=page_context, order=order)
    block_type, sub_type, tags, kind_metadata = block_context["resolved_kind"]
    bbox = tighten_text_bbox(
        bbox=block_context["bbox"],
        text=block_context["text"],
        block_type=block_type,
        sub_type=sub_type,
    )
    segments = build_segments(block_context["text"], block_context["raw_label"])
    formula_bbox_trace = assign_inline_formula_bboxes(
        segments=segments,
        # Match against the final canonical block rectangle.  The provider
        # rectangle may be larger than the text rectangle after conservative
        # tightening; accepting a formula outside the final block would make
        # the document geometry internally inconsistent.
        block_bbox=bbox,
        layout_box_lookup=page_context["layout_box_lookup"],
    )
    lines = build_lines(
        bbox=bbox,
        segments=segments,
        text=block_context["text"],
        raw_label=block_context["raw_label"],
        block_type=block_type,
        sub_type=sub_type,
    )
    inherit_missing_segment_bboxes(bbox=bbox, segments=segments, lines=lines)
    explicit_line_texts = [
        line.strip() for line in block_context["text"].splitlines() if line.strip()
    ]
    line_texts = (
        explicit_line_texts
        if len(explicit_line_texts) >= 2
        else line_texts_from_lines(lines)
    )
    metadata = build_block_metadata(
        block_context=block_context,
        kind_metadata=kind_metadata,
    )
    metadata.update(formula_bbox_trace)
    source = build_source(
        block=block_context["block"],
        page_index=page_context["page_index"],
        raw_label=block_context["raw_label"],
        # Provenance must preserve the provider rectangle, even when the
        # canonical text bbox is tightened for rendering/selection.
        bbox=block_context["bbox"],
        text=block_context["text"],
        order=order,
    )
    roles = derive_paddle_block_roles(
        raw_label=block_context["raw_label"],
        block_type=block_type,
        sub_type=sub_type,
    )
    translation_policy = derive_paddle_translation_policy(
        raw_label=block_context["raw_label"],
        block_type=block_type,
        sub_type=sub_type,
    )
    layout_role = roles.layout_role
    semantic_role = roles.semantic_role
    structure_role = roles.structure_role
    text_flow = classify_text_flow_for_role(
        text=block_context["text"],
        lines=lines,
        semantic_role=semantic_role,
        structure_role=structure_role,
    )
    policy = translation_policy.as_document_policy()
    toc_entries = (
        build_toc_entries(lines=lines, line_texts=line_texts)
        if sub_type == "table_of_contents"
        else []
    )
    if toc_entries:
        text_flow = TEXT_FLOW_PRESERVE_LINES
    metadata["structure_role"] = structure_role
    metadata["layout_role"] = layout_role
    metadata["semantic_role"] = semantic_role
    metadata["policy_translate"] = bool(policy.get("translate"))
    return {
        "block_id": f"p{page_context['page_index'] + 1:03d}-b{order:04d}",
        "page_index": page_context["page_index"],
        "order": order,
        "reading_order": order,
        "content_kind": block_type,
        "sub_type": sub_type,
        "bbox": bbox,
        "geometry": {"bbox": list(bbox)},
        "content": {
            "kind": block_type,
            "text": block_context["text"],
            **(
                {"line_texts": line_texts, "text_flow": text_flow} if line_texts else {}
            ),
            **({"toc_entries": toc_entries} if toc_entries else {}),
        },
        "text": block_context["text"],
        "lines": lines,
        "segments": segments,
        "tags": tags,
        "layout_role": layout_role,
        "semantic_role": semantic_role,
        "structure_role": structure_role,
        "policy": policy,
        "derived": build_derived(block_context["raw_label"], sub_type=sub_type),
        "metadata": metadata,
        "source": source,
        "provenance": _build_provenance(
            source=source, raw_label=block_context["raw_label"]
        ),
    }


__all__ = [
    "build_block_context",
    "build_block_spec",
]
