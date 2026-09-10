from __future__ import annotations

from .policy_state import KEEP_ORIGIN_LABEL
from .policy_state import mark_keep_origin as mark_policy_keep_origin
from .policy_state import mark_translation_failed_policy_state
from .result_entries import result_diagnostics_for_item


def mark_keep_origin(item: dict) -> None:
    mark_policy_keep_origin(item)


def mark_translation_failed(item: dict, metadata: dict) -> None:
    mark_translation_failed_policy_state(item)
    diagnostics = result_diagnostics_for_item(metadata, item)
    if diagnostics:
        diagnostics["final_status"] = "failed"
        item["translation_diagnostics"] = diagnostics


__all__ = ["KEEP_ORIGIN_LABEL", "mark_keep_origin", "mark_translation_failed"]
