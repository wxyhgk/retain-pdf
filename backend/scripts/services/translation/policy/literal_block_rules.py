from __future__ import annotations

from services.document_schema.semantics import is_body_structure_role
from services.translation.policy.soft_hints import should_route_to_mixed_literal_llm

def _normalized_text(item: dict) -> str:
    return " ".join((item.get("source_text") or "").split())

def shared_literal_block_label(item: dict) -> str | None:
    text = _normalized_text(item)
    if not text:
        return None

    block_type = str(item.get("block_type", "") or "")
    if block_type == "code_body":
        return "code"
    if not is_body_structure_role(item.get("metadata", {}) or {}):
        return None

    if should_route_to_mixed_literal_llm(item):
        return "translate_literal"

    return None


__all__ = ["shared_literal_block_label"]
