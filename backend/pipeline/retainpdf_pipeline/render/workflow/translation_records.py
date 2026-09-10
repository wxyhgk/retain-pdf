from __future__ import annotations

"""Render-local translation-record builder (file-contract duplicate).

Duplicated from retainpdf_pipeline.translate.core.payload.template_records
(stage-decouple: render must not import translate; duplicate wins over cross-package).
"""

from retainpdf_pipeline.render.semantics.continuation_hints import normalize_block_continuation_hint
from retainpdf_pipeline.render.semantics.provider_signals import body_repair_applied
from retainpdf_pipeline.render.semantics.provider_signals import body_repair_peer_block_id
from retainpdf_pipeline.render.semantics.provider_signals import body_repair_role
from retainpdf_pipeline.render.workflow.item_reader import item_block_class
from retainpdf_pipeline.render.workflow.item_reader import item_block_kind
from retainpdf_pipeline.render.workflow.item_reader import item_is_algorithm_like
from retainpdf_pipeline.render.workflow.item_reader import item_is_bodylike
from retainpdf_pipeline.render.workflow.item_reader import item_policy_translate
from retainpdf_pipeline.render.workflow.source_models import TextItem

from retainpdf_pipeline.render.layout.text_analysis.protected_formula_tokens import protect_inline_formulas_in_segments


def item_policy_payload(block_type: str, metadata: dict | None = None, *, contract_fields: dict | None = None) -> dict:
    payload = {
        "block_type": block_type,
        "metadata": metadata or {},
    }
    if contract_fields:
        payload.update(contract_fields)
    return payload


def is_algorithm_item(block_type: str, metadata: dict | None = None, *, contract_fields: dict | None = None) -> bool:
    payload = item_policy_payload(block_type, metadata, contract_fields=contract_fields)
    if item_is_algorithm_like(payload):
        return True
    legacy_payload = {"block_type": block_type, **(metadata or {})}
    return item_is_algorithm_like(legacy_payload)


def is_default_translatable_text_block(
    block_type: str,
    metadata: dict | None = None,
    *,
    contract_fields: dict | None = None,
) -> bool:
    payload = item_policy_payload(block_type, metadata, contract_fields=contract_fields)
    explicit_policy = item_policy_translate(payload)
    if explicit_policy is not None:
        return explicit_policy
    if item_block_kind(payload) != "text":
        return False
    return item_is_bodylike(payload)


def default_translation_flags(
    block_type: str,
    metadata: dict | None = None,
    *,
    contract_fields: dict | None = None,
) -> tuple[str, bool, str]:
    payload = item_policy_payload(block_type, metadata, contract_fields=contract_fields)
    normalized_block_type = item_block_kind(payload)
    if is_algorithm_item(block_type, metadata, contract_fields=contract_fields):
        return "skip_algorithm", False, "skip_algorithm"
    semantic_role = str(payload.get("semantic_role", (metadata or {}).get("semantic_role", "")) or "").strip().lower()
    if semantic_role == "reference":
        return "skip_reference_zone", False, "skip_reference_zone"
    if normalized_block_type == "image":
        return "skip_image_body", False, "skip_image_body"
    if normalized_block_type == "table":
        return "skip_table_body", False, "skip_table_body"
    if normalized_block_type == "code":
        return "code", False, "code"
    if is_default_translatable_text_block(normalized_block_type, metadata, contract_fields=contract_fields):
        return "", True, ""
    if normalized_block_type:
        return f"skip_{normalized_block_type}", False, f"skip_{normalized_block_type}"
    return "skip_non_body_text", False, "skip_non_body_text"


def ocr_continuation_fields(metadata: dict | None) -> dict:
    hint = normalize_block_continuation_hint((metadata or {}).get("continuation_hint"))
    return {
        "ocr_continuation_source": hint["source"],
        "ocr_continuation_group_id": hint["group_id"],
        "ocr_continuation_role": hint["role"],
        "ocr_continuation_scope": hint["scope"],
        "ocr_continuation_reading_order": hint["reading_order"],
        "ocr_continuation_confidence": hint["confidence"],
    }


def provider_layout_warning_fields(metadata: dict | None) -> dict:
    metadata = metadata or {}
    return {
        "provider_cross_column_merge_suspected": bool(
            metadata.get("cross_column_merge_suspected", metadata.get("provider_cross_column_merge_suspected"))
        ),
        "provider_reading_order_unreliable": bool(
            metadata.get("reading_order_unreliable", metadata.get("provider_reading_order_unreliable"))
        ),
        "provider_structure_unreliable": bool(
            metadata.get("structure_unreliable", metadata.get("provider_structure_unreliable"))
        ),
        "provider_text_missing_but_bbox_present": bool(
            metadata.get("text_missing_but_bbox_present", metadata.get("provider_text_missing_but_bbox_present"))
        ),
        "provider_peer_block_absorbed_text": bool(
            metadata.get("peer_block_absorbed_text", metadata.get("provider_peer_block_absorbed_text"))
        ),
        "provider_body_repair_applied": body_repair_applied(metadata),
        "provider_body_repair_role": body_repair_role(metadata),
        "provider_body_repair_strategy": str(
            metadata.get("body_repair_strategy", metadata.get("provider_body_repair_strategy", "")) or ""
        ),
        "provider_suspected_peer_block_id": body_repair_peer_block_id(metadata),
        "provider_continuation_suppressed": bool(
            metadata.get("continuation_suppressed", metadata.get("provider_continuation_suppressed"))
        ),
        "provider_continuation_suppressed_reason": str(
            metadata.get("continuation_suppressed_reason", metadata.get("provider_continuation_suppressed_reason", "")) or ""
        ),
        "provider_column_layout_mode": str(
            metadata.get("column_layout_mode", metadata.get("provider_column_layout_mode", "")) or ""
        ),
        "provider_column_index_guess": str(
            metadata.get("column_index_guess", metadata.get("provider_column_index_guess", "")) or ""
        ),
    }


def contract_fields_from_item(item: TextItem) -> dict:
    block_class = getattr(item, "block_class", "") or item_block_class(
        {
            "block_kind": getattr(item, "block_kind", "") or item.block_type,
            "layout_role": getattr(item, "layout_role", ""),
            "semantic_role": getattr(item, "semantic_role", ""),
            "structure_role": getattr(item, "structure_role", ""),
            "normalized_sub_type": getattr(item, "normalized_sub_type", ""),
        }
    )
    return {
        "block_kind": str(getattr(item, "block_kind", "") or item.block_type or "").strip().lower(),
        "block_class": str(block_class).strip().lower(),
        "layout_role": str(getattr(item, "layout_role", "") or "").strip().lower(),
        "semantic_role": str(getattr(item, "semantic_role", "") or "").strip().lower(),
        "structure_role": str(getattr(item, "structure_role", "") or "").strip().lower(),
        "policy_translate": getattr(item, "policy_translate", None),
        "asset_id": str(getattr(item, "asset_id", "") or "").strip(),
        "reading_order": int(getattr(item, "reading_order", item.block_idx) or 0),
        "raw_block_type": str(getattr(item, "raw_block_type", "") or item.block_type or "").strip().lower(),
        "normalized_sub_type": str(getattr(item, "normalized_sub_type", "") or "").strip().lower(),
    }


def resolve_translation_item_payload(item: TextItem, *, math_mode: str) -> tuple[str, list[dict], list[dict]]:
    if math_mode == "direct_typst":
        return item.text, [], []
    return protect_inline_formulas_in_segments(item.segments)


def build_translation_record(item: TextItem, *, math_mode: str) -> dict:
    contract_fields = contract_fields_from_item(item)
    protected_source_text, formula_map, protected_map = resolve_translation_item_payload(item, math_mode=math_mode)
    classification_label, should_translate, skip_reason = default_translation_flags(
        item.block_type,
        item.metadata,
        contract_fields=contract_fields,
    )
    return {
        "item_id": item.item_id,
        "page_idx": item.page_idx,
        "block_idx": item.block_idx,
        "block_type": item.block_type,
        **contract_fields,
        "bbox": item.bbox,
        "source_text": item.text,
        "source_line_texts": list(getattr(item, "line_texts", []) or []),
        "text_flow": str(getattr(item, "text_flow", "") or "flow"),
        "toc_entries": list(getattr(item, "toc_entries", []) or []),
        "lines": item.lines,
        "metadata": item.metadata,
        **ocr_continuation_fields(item.metadata),
        **provider_layout_warning_fields(item.metadata),
        "layout_mode": "",
        "layout_split_x": 0.0,
        "layout_zone": "",
        "layout_zone_rank": -1,
        "layout_zone_size": 0,
        "layout_boundary_role": "",
        "math_mode": math_mode,
        "protected_source_text": protected_source_text,
        "mixed_original_protected_source_text": protected_source_text,
        "formula_map": formula_map,
        "protected_map": protected_map,
        "classification_label": classification_label,
        "should_translate": should_translate,
        "skip_reason": skip_reason,
        "mixed_literal_action": "",
        "mixed_literal_prefix": "",
        "translation_unit_id": item.item_id,
        "translation_unit_kind": "single",
        "translation_unit_member_ids": [item.item_id],
        "translation_unit_protected_source_text": protected_source_text,
        "translation_unit_formula_map": formula_map,
        "translation_unit_protected_map": protected_map,
        "translation_unit_protected_translated_text": "",
        "translation_unit_translated_text": "",
        "translation_group_id": "",
        "translation_group_kind": "",
        "translation_group_strategy": "",
        "protected_translated_text": "",
        "translated_text": "",
        "continuation_group": "",
        "continuation_prev_text": "",
        "continuation_next_text": "",
        "continuation_decision": "",
        "continuation_candidate_prev_id": "",
        "continuation_candidate_next_id": "",
        "group_protected_source_text": "",
        "group_formula_map": [],
        "group_protected_map": [],
        "group_protected_translated_text": "",
        "group_translated_text": "",
        "final_status": "",
        "translation_diagnostics": {},
    }
