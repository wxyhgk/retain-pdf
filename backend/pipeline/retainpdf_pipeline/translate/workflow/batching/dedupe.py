from __future__ import annotations

import json

from retainpdf_pipeline.translate.core.item_reader import item_block_kind
from retainpdf_pipeline.translate.core.item_reader import item_layout_role
from retainpdf_pipeline.translate.core.item_reader import item_semantic_role
from retainpdf_pipeline.translate.core.payload.parts.common import GROUP_ITEM_PREFIX


def _source_text(item: dict) -> str:
    return str(
        item.get("translation_unit_protected_source_text")
        or item.get("group_protected_source_text")
        or item.get("protected_source_text")
        or item.get("source_text")
        or ""
    )


def _dedupe_signature(item: dict) -> str | None:
    item_id = str(item.get("item_id", "") or "")
    if item_id.startswith(GROUP_ITEM_PREFIX):
        return None
    if item.get("continuation_group"):
        return None
    if item.get("formula_map") or item.get("translation_unit_formula_map"):
        return None
    if item.get("protected_map") or item.get("translation_unit_protected_map"):
        return None
    source = _source_text(item).strip()
    if not source:
        return None
    payload = {
        "block_kind": item_block_kind(item),
        "layout_role": item_layout_role(item),
        "semantic_role": item_semantic_role(item),
        "source": source,
        "mixed_literal_action": str(item.get("mixed_literal_action", "") or ""),
        "mixed_literal_prefix": str(item.get("mixed_literal_prefix", "") or ""),
    }
    return json.dumps(payload, ensure_ascii=False, sort_keys=True)


def _dedupe_pending_items(pending: list[dict]) -> tuple[list[dict], dict[str, list[dict]]]:
    unique: list[dict] = []
    duplicates_by_rep_id: dict[str, list[dict]] = {}
    representative_by_signature: dict[str, dict] = {}
    for item in pending:
        signature = _dedupe_signature(item)
        if signature is None:
            unique.append(item)
            continue
        representative = representative_by_signature.get(signature)
        if representative is None:
            representative_by_signature[signature] = item
            unique.append(item)
            continue
        rep_id = str(representative.get("item_id", "") or "")
        duplicates_by_rep_id.setdefault(rep_id, []).append(item)
    return unique, duplicates_by_rep_id


__all__ = [
    "_dedupe_pending_items",
    "_dedupe_signature",
    "_source_text",
]
