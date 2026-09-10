from __future__ import annotations

from retainpdf_pipeline.translate.services.classification.rule_engine import is_short_no_trans_candidate
from retainpdf_pipeline.translate.services.classification.rule_engine import looks_like_no_trans_code_candidate
from retainpdf_pipeline.translate.core.item_reader import item_is_caption_like
from retainpdf_pipeline.translate.core.item_reader import item_is_bodylike
from retainpdf_pipeline.translate.core.item_reader import item_is_reference_heading_like
from retainpdf_pipeline.translate.core.item_reader import item_is_reference_like
from retainpdf_pipeline.translate.core.item_reader import item_is_title_like
from retainpdf_pipeline.translate.core.item_reader import item_policy_translate
from retainpdf_pipeline.translate.core.item_reader import item_structure_role

from retainpdf_pipeline.translate.core.payload.parts.common import RESETTABLE_LABEL_PREFIXES
from retainpdf_pipeline.translate.core.payload.parts.policy_state import KEEP_ORIGIN_LABEL
from retainpdf_pipeline.translate.core.payload.parts.policy_state import KEPT_ORIGIN_STATUS
from retainpdf_pipeline.translate.core.payload.parts.policy_state import mark_policy_skip
from retainpdf_pipeline.translate.core.payload.parts.policy_state import mark_translation_required
from retainpdf_pipeline.translate.core.payload.parts.policy_state import preserve_source_as_translation
from .policy_defaults import foundational_skip_defaults


def reset_policy_state(payload: list[dict]) -> int:
    reset = 0
    for item in payload:
        original_protected_source = str(item.get("mixed_original_protected_source_text", "") or "")
        if original_protected_source:
            item["protected_source_text"] = original_protected_source
            if item.get("translation_unit_kind") == "single":
                item["translation_unit_protected_source_text"] = original_protected_source
        item["mixed_literal_action"] = ""
        item["mixed_literal_prefix"] = ""
        foundational_skip = foundational_skip_defaults(item)
        if foundational_skip is not None:
            label, skip_reason = foundational_skip
            mark_policy_skip(item, label, skip_reason=skip_reason)
            continue
        label = str(item.get("classification_label", "") or "")
        # A completed model/fast-path decision is a translation result, not
        # a temporary page-policy label. Resetting it on resume would reopen
        # committed work before the batch fast path can run again.
        if (
            label == KEEP_ORIGIN_LABEL
            and item.get("final_status") == KEPT_ORIGIN_STATUS
            and item.get("should_translate") is False
        ):
            continue
        if not label:
            continue
        if not label.startswith(RESETTABLE_LABEL_PREFIXES):
            continue
        mark_translation_required(item)
        reset += 1
    return reset


def _protect_caption_from_model_skip(item: dict, label_value: str) -> bool:
    if label_value not in {"code", "no_trans", "keep_origin", "skip_model_keep_origin"}:
        return False
    if not item_is_caption_like(item):
        return False
    return item_policy_translate(item) is True


def _allow_model_skip_label(item: dict, label_value: str) -> bool:
    if label_value not in {"code", "no_trans", "keep_origin", "skip_model_keep_origin"}:
        return True
    if str(item.get("continuation_group", "") or "").strip():
        return False
    if item_is_bodylike(item) and not looks_like_no_trans_code_candidate(item):
        return False
    if not is_short_no_trans_candidate(item):
        return False
    if _protect_caption_from_model_skip(item, label_value):
        return False
    return True


def apply_classification_labels(payload: list[dict], labels: dict[str, str]) -> int:
    classified_items = 0
    for item in payload:
        existing_label = str(item.get("classification_label", "") or "")
        if existing_label.startswith(("translate_", "skip_", "code")):
            continue
        item_id = item.get("item_id")
        label_value = labels.get(item_id, "translate")
        if label_value == "translate":
            continue
        if not _allow_model_skip_label(item, label_value):
            continue
        if label_value in {"code", "no_trans", "keep_origin"}:
            label_value = "skip_model_keep_origin"
        if label_value.startswith("skip_"):
            mark_policy_skip(item, label_value)
        else:
            mark_translation_required(item, label=label_value)
        classified_items += 1
    return classified_items


def apply_title_skip(payload: list[dict]) -> int:
    skipped = 0
    for item in payload:
        if not item_is_title_like(item):
            continue
        mark_policy_skip(item, item.get("classification_label") or "skip_title", skip_reason="skip_title")
        preserve_source_as_translation(item)
        skipped += 1
    return skipped


def apply_reference_zone_skip(
    payload: list[dict],
    *,
    page_idx: int,
    cutoff_page_idx: int | None,
    cutoff_block_idx: int | None,
) -> int:
    if cutoff_page_idx is None or cutoff_block_idx is None:
        return 0
    if page_idx < cutoff_page_idx:
        return 0

    skipped = 0
    for item in payload:
        item_page_idx = item.get("page_idx", page_idx)
        block_idx = item.get("block_idx", -1)
        if item_page_idx < cutoff_page_idx:
            continue
        if item_page_idx == cutoff_page_idx and block_idx < cutoff_block_idx:
            continue

        if not item.get("should_translate", True):
            continue

        if item_is_reference_heading_like(item):
            mark_policy_skip(item, "skip_reference_heading")
            skipped += 1
            continue

        if item_is_reference_like(item):
            mark_policy_skip(item, "skip_reference_zone")
            skipped += 1
    return skipped


def apply_reference_tail_skip(
    payload: list[dict],
    *,
    page_idx: int,
    cutoff_page_idx: int | None,
    cutoff_block_idx: int | None,
) -> int:
    if cutoff_page_idx is None or cutoff_block_idx is None:
        return 0
    if page_idx < cutoff_page_idx:
        return 0

    skipped = 0
    for item in payload:
        item_page_idx = item.get("page_idx", page_idx)
        block_idx = item.get("block_idx", -1)
        if item_page_idx < cutoff_page_idx:
            continue
        if item_page_idx == cutoff_page_idx and block_idx < cutoff_block_idx:
            continue
        if not item.get("should_translate", True):
            continue
        mark_policy_skip(item, "skip_reference_tail")
        skipped += 1
    return skipped


def apply_after_last_title_skip(
    payload: list[dict],
    *,
    page_idx: int,
    cutoff_page_idx: int | None,
    cutoff_block_idx: int | None,
) -> int:
    return apply_reference_tail_skip(
        payload,
        page_idx=page_idx,
        cutoff_page_idx=cutoff_page_idx,
        cutoff_block_idx=cutoff_block_idx,
    )


def apply_scientific_paper_skips(
    payload: list[dict],
    *,
    page_idx: int,
    cutoff_page_idx: int | None = None,
    cutoff_block_idx: int | None = None,
) -> dict[str, int]:
    title_skipped = apply_title_skip(payload)
    reference_tail_skipped = apply_reference_tail_skip(
        payload,
        page_idx=page_idx,
        cutoff_page_idx=cutoff_page_idx,
        cutoff_block_idx=cutoff_block_idx,
    )
    return {
        "title_skipped": title_skipped,
        "reference_tail_skipped": reference_tail_skipped,
        "tail_skipped": reference_tail_skipped,
    }


def apply_narrow_body_text_skip(payload: list[dict]) -> int:
    return 0


__all__ = [
    "apply_after_last_title_skip",
    "apply_classification_labels",
    "apply_narrow_body_text_skip",
    "apply_reference_tail_skip",
    "apply_reference_zone_skip",
    "apply_scientific_paper_skips",
    "apply_title_skip",
    "reset_policy_state",
]
