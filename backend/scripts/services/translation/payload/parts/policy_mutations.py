from __future__ import annotations

from services.document_schema.semantics import build_role_profile
from services.translation.item_reader import item_is_algorithm_like
from services.translation.item_reader import item_block_kind
from services.translation.item_reader import item_is_bodylike
from services.translation.item_reader import item_is_reference_heading_like
from services.translation.item_reader import item_is_reference_like
from services.translation.item_reader import item_is_title_like
from services.translation.item_reader import item_normalized_sub_type
from services.translation.item_reader import item_policy_translate
from services.translation.item_reader import item_raw_block_type
from services.translation.item_reader import item_structure_role

from .common import RESETTABLE_LABEL_PREFIXES
from .common import clear_translation_fields


_FOUNDATIONAL_SKIP_BY_BLOCK_TYPE = {
    "image_body": ("skip_image_body", "skip_image_body"),
    "table_body": ("skip_table_body", "skip_table_body"),
    "code_body": ("code", "code"),
}
_DEFAULT_TRANSLATABLE_TEXT_STRUCTURE_ROLES = {"", "body", "abstract", "heading"}


def _is_ref_text_like(item: dict) -> bool:
    if item_is_reference_like(item) or item_raw_block_type(item) == "ref_text":
        return True
    return item_normalized_sub_type(item) == "ref_text"


def _is_default_translatable_text_item(item: dict) -> bool:
    explicit_policy = item_policy_translate(item)
    if explicit_policy is not None:
        return explicit_policy
    if item_block_kind(item) != "text":
        return False
    role = str(build_role_profile(item).get("structure_role") or "")
    if item_is_bodylike(item):
        return True
    return role in _DEFAULT_TRANSLATABLE_TEXT_STRUCTURE_ROLES


def _foundational_skip_defaults(item: dict) -> tuple[str, str] | None:
    if item_is_algorithm_like(item):
        return "skip_algorithm", "skip_algorithm"
    block_type = item_raw_block_type(item)
    normalized_block_type = block_type.strip().lower()
    if normalized_block_type in _FOUNDATIONAL_SKIP_BY_BLOCK_TYPE:
        return _FOUNDATIONAL_SKIP_BY_BLOCK_TYPE[normalized_block_type]
    if _is_ref_text_like(item):
        return None
    if _is_default_translatable_text_item(item):
        return None
    if item_is_title_like(item) or normalized_block_type == "title":
        return "skip_title", "skip_title"
    if normalized_block_type:
        return f"skip_{normalized_block_type}", f"skip_{normalized_block_type}"
    return "skip_non_body_text", "skip_non_body_text"


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
        foundational_skip = _foundational_skip_defaults(item)
        if foundational_skip is not None:
            label, skip_reason = foundational_skip
            item["classification_label"] = label
            item["should_translate"] = False
            item["skip_reason"] = skip_reason
            clear_translation_fields(item)
            item["final_status"] = "kept_origin"
            continue
        label = str(item.get("classification_label", "") or "")
        if not label:
            continue
        if not label.startswith(RESETTABLE_LABEL_PREFIXES):
            continue
        item["classification_label"] = ""
        item["should_translate"] = True
        item["skip_reason"] = ""
        reset += 1
    return reset


def _mark_item_skipped(item: dict, label: str) -> None:
    item["classification_label"] = label
    item["should_translate"] = False
    item["skip_reason"] = label
    clear_translation_fields(item)
    item["final_status"] = "kept_origin"


def _preserve_source_as_translation(item: dict) -> None:
    source_text = str(item.get("source_text", "") or "").strip()
    protected_source_text = str(item.get("protected_source_text", "") or source_text).strip()
    item["translation_unit_protected_translated_text"] = protected_source_text
    item["translation_unit_translated_text"] = source_text
    item["protected_translated_text"] = protected_source_text
    item["translated_text"] = source_text


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
        if label_value in {"code", "no_trans", "keep_origin"}:
            label_value = "skip_model_keep_origin"
        item["classification_label"] = label_value
        item["should_translate"] = not label_value.startswith("skip_")
        classified_items += 1
        if not item["should_translate"]:
            item["skip_reason"] = label_value
            clear_translation_fields(item)
            item["final_status"] = "kept_origin"
    return classified_items


def apply_title_skip(payload: list[dict]) -> int:
    skipped = 0
    for item in payload:
        if not item_is_title_like(item):
            continue
        item["classification_label"] = item.get("classification_label") or "skip_title"
        item["should_translate"] = False
        item["skip_reason"] = "skip_title"
        clear_translation_fields(item)
        _preserve_source_as_translation(item)
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
            _mark_item_skipped(item, "skip_reference_heading")
            skipped += 1
            continue

        if item_is_reference_like(item):
            _mark_item_skipped(item, "skip_reference_zone")
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
        _mark_item_skipped(item, "skip_reference_tail")
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
