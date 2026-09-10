from __future__ import annotations

from retainpdf_pipeline.translate.core.item_reader import item_block_kind
from retainpdf_pipeline.translate.core.item_reader import item_is_plain_text_block
from retainpdf_pipeline.translate.services.policy.soft_hints import build_soft_rule_hints

def _normalized_text(item: dict) -> str:
    return " ".join((item.get("source_text") or "").split())


def should_route_to_mixed_literal_llm(item: dict) -> bool:
    if not item.get("should_translate", True):
        return False
    if item_block_kind(item) == "code":
        return False
    if not item_is_plain_text_block(item):
        return False
    hints = set(build_soft_rule_hints(item))
    return bool(
        {
            "command_prefix_then_prose_tail",
            "single_line_command_prefix_with_prose_tail",
        }
        & hints
    )

def shared_literal_block_label(item: dict) -> str | None:
    text = _normalized_text(item)
    if not text:
        return None

    if item_block_kind(item) == "code":
        return "code"
    if not item_is_plain_text_block(item):
        return None

    if should_route_to_mixed_literal_llm(item):
        return "translate_literal"

    return None


__all__ = ["shared_literal_block_label", "should_route_to_mixed_literal_llm"]
