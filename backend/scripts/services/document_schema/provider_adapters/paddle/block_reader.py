from __future__ import annotations

from dataclasses import dataclass

from services.document_schema.provider_adapters.common import NormalizedBlockSpec
from services.document_schema.provider_adapters.common import normalize_bbox
from services.document_schema.provider_adapters.paddle.content_extract import build_lines
from services.document_schema.provider_adapters.paddle.content_extract import build_segments
from services.document_schema.provider_adapters.paddle.content_extract import tighten_text_bbox
from services.document_schema.provider_adapters.paddle.context import PaddleBlockContext
from services.document_schema.provider_adapters.paddle.context import PaddlePageContext
from services.document_schema.provider_adapters.paddle.page_trace import attach_layout_trace
from services.document_schema.provider_adapters.paddle.rich_content import enrich_rich_content_trace
from services.document_schema.provider_adapters.paddle.trace import build_derived
from services.document_schema.provider_adapters.paddle.trace import build_metadata
from services.document_schema.provider_adapters.paddle.trace import build_source


@dataclass(frozen=True)
class PaddleTextRoleRule:
    layout_role: str = "unknown"
    semantic_role: str = "unknown"
    structure_role: str = ""
    translate: bool = False
    translate_reason: str = ""


_TEXT_ROLE_BY_SUBTYPE = {
    "title": PaddleTextRoleRule(
        layout_role="title",
        structure_role="title",
        translate=True,
        translate_reason="provider_title_candidate",
    ),
    "heading": PaddleTextRoleRule(
        layout_role="heading",
        structure_role="heading",
        translate=True,
        translate_reason="provider_heading_candidate",
    ),
    "body": PaddleTextRoleRule(
        layout_role="paragraph",
        semantic_role="body",
        structure_role="body",
        translate=True,
        translate_reason="provider_body_whitelist:body",
    ),
    "header": PaddleTextRoleRule(layout_role="header", semantic_role="metadata"),
    "footer": PaddleTextRoleRule(layout_role="footer", semantic_role="metadata"),
    "page_number": PaddleTextRoleRule(layout_role="page_number", semantic_role="metadata"),
    "metadata": PaddleTextRoleRule(semantic_role="metadata"),
    "formula_number": PaddleTextRoleRule(semantic_role="metadata"),
    "reference_entry": PaddleTextRoleRule(semantic_role="reference", structure_role="reference_entry"),
    "figure_caption": PaddleTextRoleRule(
        layout_role="caption",
        structure_role="figure_caption",
        translate=True,
        translate_reason="provider_caption_whitelist:figure_caption",
    ),
    "caption": PaddleTextRoleRule(layout_role="caption", structure_role="caption"),
    "image_caption": PaddleTextRoleRule(layout_role="caption", structure_role="caption"),
    "table_caption": PaddleTextRoleRule(layout_role="caption", structure_role="caption"),
    "code_caption": PaddleTextRoleRule(structure_role="caption"),
    "footnote": PaddleTextRoleRule(layout_role="footnote", structure_role="footnote"),
    "image_footnote": PaddleTextRoleRule(
        layout_role="footnote",
        structure_role="footnote",
        translate=True,
        translate_reason="provider_footnote_whitelist:image_footnote",
    ),
    "table_footnote": PaddleTextRoleRule(
        layout_role="footnote",
        structure_role="footnote",
        translate=True,
        translate_reason="provider_footnote_whitelist:table_footnote",
    ),
}
_TEXT_ROLE_BY_RAW_LABEL = {
    "abstract": PaddleTextRoleRule(
        layout_role="paragraph",
        semantic_role="abstract",
        structure_role="body",
        translate=True,
        translate_reason="provider_body_whitelist:abstract",
    ),
    "footnote": PaddleTextRoleRule(
        layout_role="footnote",
        structure_role="footnote",
        translate=False,
        translate_reason="provider_non_body:footnote",
    ),
}
_VISION_FOOTNOTE_FALLBACK_RULE = PaddleTextRoleRule(
    layout_role="footnote",
    structure_role="footnote",
    translate=True,
    translate_reason="provider_footnote_whitelist:vision_footnote",
)


def _merge_role_rule(base: PaddleTextRoleRule, override: PaddleTextRoleRule | None) -> PaddleTextRoleRule:
    if override is None:
        return base
    return PaddleTextRoleRule(
        layout_role=override.layout_role if override.layout_role != "unknown" else base.layout_role,
        semantic_role=override.semantic_role if override.semantic_role != "unknown" else base.semantic_role,
        structure_role=override.structure_role or base.structure_role,
        translate=override.translate,
        translate_reason=override.translate_reason or base.translate_reason,
    )


def _paddle_text_role_rule(*, raw_label: str, block_type: str, sub_type: str) -> PaddleTextRoleRule:
    if block_type != "text":
        return PaddleTextRoleRule(
            translate=False,
            translate_reason=f"provider_non_text:{block_type or 'unknown'}",
        )
    label = raw_label.strip().lower()
    base = _TEXT_ROLE_BY_SUBTYPE.get(sub_type, PaddleTextRoleRule())
    override = _TEXT_ROLE_BY_RAW_LABEL.get(label)
    if label == "vision_footnote" and sub_type == "footnote":
        override = _VISION_FOOTNOTE_FALLBACK_RULE
    rule = _merge_role_rule(base, override)
    if not rule.translate_reason:
        rule = PaddleTextRoleRule(
            layout_role=rule.layout_role,
            semantic_role=rule.semantic_role,
            structure_role=rule.structure_role,
            translate=False,
            translate_reason=f"provider_non_body:{sub_type or label or 'unknown'}",
        )
    return rule


def _build_provenance(*, source: dict, raw_label: str) -> dict:
    return {
        "provider": str(source.get("provider", "") or ""),
        "raw_label": raw_label,
        "raw_sub_type": str(source.get("raw_sub_type", "") or ""),
        "raw_bbox": list(source.get("raw_bbox", [0, 0, 0, 0]) or [0, 0, 0, 0]),
        "raw_path": str(source.get("raw_path", "") or ""),
    }


def _apply_normalized_paddle_signals(metadata: dict) -> None:
    metadata["cross_column_merge_suspected"] = bool(metadata.get("provider_cross_column_merge_suspected"))
    metadata["reading_order_unreliable"] = bool(metadata.get("provider_reading_order_unreliable"))
    metadata["structure_unreliable"] = bool(metadata.get("provider_structure_unreliable"))
    metadata["text_missing_but_bbox_present"] = bool(metadata.get("provider_text_missing_but_bbox_present"))
    metadata["peer_block_absorbed_text"] = bool(metadata.get("provider_peer_block_absorbed_text"))
    metadata["body_repair_attempted"] = bool(metadata.get("provider_body_repair_attempted"))
    metadata["body_repair_applied"] = bool(metadata.get("provider_body_repair_applied"))
    metadata["body_repair_role"] = str(metadata.get("provider_body_repair_role", "") or "")
    metadata["body_repair_strategy"] = str(metadata.get("provider_body_repair_strategy", "") or "")
    metadata["body_repair_peer_block_id"] = str(metadata.get("provider_suspected_peer_block_id", "") or "")
    metadata["continuation_suppressed"] = bool(metadata.get("provider_continuation_suppressed"))
    metadata["continuation_suppressed_reason"] = str(metadata.get("provider_continuation_suppressed_reason", "") or "")
    metadata["column_layout_mode"] = str(metadata.get("provider_column_layout_mode", "") or "")
    metadata["column_index_guess"] = str(metadata.get("provider_column_index_guess", "") or "")


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
        "signal_metadata": {
            **dict((page_context["column_signals"].get("block_signals", {}) or {}).get(order, {}) or {}),
            **dict((page_context.get("repair_metadata", {}) or {}).get(order, {}) or {}),
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
    lines = build_lines(
        bbox=bbox,
        segments=segments,
        text=block_context["text"],
        raw_label=block_context["raw_label"],
        block_type=block_type,
        sub_type=sub_type,
    )
    metadata = build_block_metadata(
        block_context=block_context,
        kind_metadata=kind_metadata,
    )
    source = build_source(
        block=block_context["block"],
        page_index=page_context["page_index"],
        raw_label=block_context["raw_label"],
        bbox=bbox,
        text=block_context["text"],
        order=order,
    )
    role_rule = _paddle_text_role_rule(
        raw_label=block_context["raw_label"],
        block_type=block_type,
        sub_type=sub_type,
    )
    layout_role = role_rule.layout_role
    semantic_role = role_rule.semantic_role
    structure_role = role_rule.structure_role
    policy = {
        "translate": role_rule.translate,
        "translate_reason": role_rule.translate_reason,
    }
    metadata["structure_role"] = structure_role
    metadata["layout_role"] = layout_role
    metadata["semantic_role"] = semantic_role
    metadata["policy_translate"] = bool(policy.get("translate"))
    return {
        "block_id": f"p{page_context['page_index'] + 1:03d}-b{order:04d}",
        "page_index": page_context["page_index"],
        "order": order,
        "reading_order": order,
        "block_type": block_type,
        "sub_type": sub_type,
        "bbox": bbox,
        "geometry": {"bbox": list(bbox)},
        "content": {"kind": block_type, "text": block_context["text"]},
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
        "provenance": _build_provenance(source=source, raw_label=block_context["raw_label"]),
    }


__all__ = [
    "build_block_context",
    "build_block_spec",
]
