from __future__ import annotations

from dataclasses import dataclass

from retainpdf_pipeline.translate.core.item_reader import item_policy_translate
from retainpdf_pipeline.translate.llm.result_payload import result_entry
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import strip_placeholders
from retainpdf_pipeline.translate.services.policy import should_fast_path_keep_origin


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
    from retainpdf_pipeline.translate.core.execution_policy import is_standalone_number
    if is_standalone_number(item):
        return True, "skip_standalone_number"
    return should_fast_path_keep_origin(item)


__all__ = [
    "_PlanItemView",
    "_fast_path_keep_origin_result",
    "_is_fast_path_keep_origin_item",
    "_normalized_text_without_placeholders",
    "_plan_item_view",
    "_source_text",
]
