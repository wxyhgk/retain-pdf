from __future__ import annotations

from dataclasses import dataclass

from retainpdf_translation.core.item_reader import item_policy_translate
from retainpdf_translation.llm.result_payload import result_entry
from retainpdf_translation.llm.validation.placeholder_tokens import strip_placeholders
from retainpdf_translation_classic.services.fast_path.fixed_translations import FIXED_TRANSLATION_REASON
from retainpdf_translation_classic.services.fast_path.fixed_translations import fixed_translation_for
from retainpdf_translation.services.policy import should_fast_path_keep_origin


@dataclass(frozen=True)
class _PlanItemView:
    item: dict
    source: str
    compact: str
    policy_translate: bool | None
    layout_zone: str


def _source_text(item: dict) -> str:
    return str(
        item.get("translation_unit_protected_source_text")
        or item.get("group_protected_source_text")
        or item.get("protected_source_text")
        or item.get("source_text")
        or ""
    )


def _normalized_text_without_placeholders(item: dict) -> str:
    return " ".join(strip_placeholders(_source_text(item)).split())


def _plan_item_view(item: dict) -> _PlanItemView:
    return _PlanItemView(
        item=item,
        source=_source_text(item),
        compact=_normalized_text_without_placeholders(item),
        policy_translate=item_policy_translate(item),
        layout_zone=str(item.get("layout_zone", "") or "").strip().lower(),
    )


def _fast_path_keep_origin_result(item: dict, reason: str) -> dict[str, dict[str, str]]:
    """不发模型请求的即时结果。名字沿用历史：除了保留原文，也承载字典直译（见 fixed_translations）。"""
    if reason == FIXED_TRANSLATION_REASON:
        fixed = fixed_translation_for(item)
        if fixed:
            payload = result_entry("translate", fixed)
            payload["translation_diagnostics"] = {
                "item_id": item.get("item_id", ""),
                "page_idx": item.get("page_idx"),
                "route_path": ["block_level", "fast_path_fixed_translation"],
                "output_mode_path": [],
                "fallback_to": "",
                "degradation_reason": "",
                "final_status": "translated",
            }
            return {str(item.get("item_id", "") or ""): payload}
    payload = result_entry("keep_origin", "")
    payload["translation_diagnostics"] = {
        "item_id": item.get("item_id", ""),
        "page_idx": item.get("page_idx"),
        "route_path": ["block_level", "fast_path_keep_origin"],
        "output_mode_path": [],
        "fallback_to": "keep_origin",
        "degradation_reason": reason,
        "final_status": "kept_origin",
    }
    return {str(item.get("item_id", "") or ""): payload}


def _is_fast_path_keep_origin_item(item: dict) -> tuple[bool, str]:
    from retainpdf_translation.core.execution_policy import is_standalone_number
    if is_standalone_number(item):
        return True, "skip_standalone_number"
    should_keep, reason = should_fast_path_keep_origin(item)
    if should_keep:
        return True, reason
    if fixed_translation_for(item):
        return True, FIXED_TRANSLATION_REASON
    return False, ""


__all__ = [
    "_PlanItemView",
    "_fast_path_keep_origin_result",
    "_is_fast_path_keep_origin_item",
    "_normalized_text_without_placeholders",
    "_plan_item_view",
    "_source_text",
]
