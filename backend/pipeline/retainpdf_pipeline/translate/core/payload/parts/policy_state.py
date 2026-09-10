from __future__ import annotations

from .common import clear_translation_fields
from .final_status import FAILED_STATUS
from .final_status import KEPT_ORIGIN_STATUS
from .final_status import set_final_status


KEEP_ORIGIN_LABEL = "skip_model_keep_origin"


def preserve_source_as_translation(item: dict) -> None:
    source_text = str(item.get("source_text", "") or "").strip()
    protected_source_text = str(item.get("protected_source_text", "") or source_text).strip()
    item["translation_unit_protected_translated_text"] = protected_source_text
    item["translation_unit_translated_text"] = source_text
    item["protected_translated_text"] = protected_source_text
    item["translated_text"] = source_text


def mark_policy_skip(
    item: dict,
    label: str,
    *,
    skip_reason: str | None = None,
    preserve_source: bool = False,
) -> None:
    normalized_label = str(label or "").strip()
    item["classification_label"] = normalized_label
    item["should_translate"] = False
    item["skip_reason"] = str(skip_reason if skip_reason is not None else normalized_label)
    clear_translation_fields(item)
    if preserve_source:
        preserve_source_as_translation(item)
    set_final_status(item, KEPT_ORIGIN_STATUS)


def mark_keep_origin(item: dict, *, reason: str = KEEP_ORIGIN_LABEL) -> None:
    mark_policy_skip(item, KEEP_ORIGIN_LABEL, skip_reason=reason)


def mark_translation_required(item: dict, *, label: str = "") -> None:
    item["classification_label"] = str(label or "")
    item["should_translate"] = True
    item["skip_reason"] = ""


def mark_translation_failed_policy_state(item: dict) -> None:
    mark_translation_required(item)
    set_final_status(item, FAILED_STATUS)
    clear_translation_fields(item)


__all__ = [
    "FAILED_STATUS",
    "KEEP_ORIGIN_LABEL",
    "KEPT_ORIGIN_STATUS",
    "mark_keep_origin",
    "mark_policy_skip",
    "mark_translation_failed_policy_state",
    "mark_translation_required",
    "preserve_source_as_translation",
]
