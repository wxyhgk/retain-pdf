from __future__ import annotations
from services.document_schema.semantics import is_algorithm_semantic
from services.document_schema.semantics import is_reference_entry_semantic
from services.document_schema.semantics import is_reference_heading_semantic
from services.translation.policy.literal_block_rules import shared_literal_block_label
from services.translation.policy.mixed_literal_splitter import split_mixed_literal_items
from services.translation.policy.metadata_filter import find_metadata_fragment_item_ids

from .common import RESETTABLE_LABEL_PREFIXES
from .common import clear_translation_fields


_FOUNDATIONAL_SKIP_BY_BLOCK_TYPE = {
    "image_body": ("skip_image_body", "skip_image_body"),
    "code_body": ("code", "code"),
}


def _bbox_tuple(item: dict) -> tuple[float, float, float, float] | None:
    bbox = item.get("bbox", [])
    if len(bbox) != 4:
        return None
    x0, y0, x1, y1 = (float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))
    if x1 <= x0 or y1 <= y0:
        return None
    return x0, y0, x1, y1


def _axis_overlap(a0: float, a1: float, b0: float, b1: float) -> float:
    return max(0.0, min(a1, b1) - max(a0, b0))


def _region_contains_item(region_item: dict, item: dict) -> bool:
    region_bbox = _bbox_tuple(region_item)
    item_bbox = _bbox_tuple(item)
    if region_bbox is None or item_bbox is None:
        return False

    cx0, cy0, cx1, cy1 = region_bbox
    ix0, iy0, ix1, iy1 = item_bbox
    item_w = ix1 - ix0
    item_h = iy1 - iy0
    if item_w <= 0.0 or item_h <= 0.0:
        return False

    overlap_w = _axis_overlap(cx0, cx1, ix0, ix1)
    overlap_h = _axis_overlap(cy0, cy1, iy0, iy1)
    if overlap_w <= 0.0 or overlap_h <= 0.0:
        return False

    area_ratio = (overlap_w * overlap_h) / (item_w * item_h)
    width_ratio = overlap_w / item_w
    height_ratio = overlap_h / item_h
    center_x = (ix0 + ix1) / 2.0
    center_y = (iy0 + iy1) / 2.0
    center_inside = cx0 <= center_x <= cx1 and cy0 <= center_y <= cy1
    if not center_inside:
        return False

    if area_ratio >= 0.6:
        return True
    if width_ratio >= 0.8 and height_ratio >= 0.7:
        return True
    if width_ratio >= 0.7 and height_ratio >= 0.8:
        return True
    return False


def _foundational_skip_defaults(item: dict) -> tuple[str, str] | None:
    metadata = item.get("metadata") or {}
    if is_algorithm_semantic(metadata):
        return "skip_algorithm", "skip_algorithm"
    block_type = str(item.get("block_type", "") or "")
    return _FOUNDATIONAL_SKIP_BY_BLOCK_TYPE.get(block_type)


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


def apply_shared_literal_block_policy(payload: list[dict]) -> dict[str, int]:
    code_skipped = 0
    code_region_skipped = 0
    image_region_skipped = 0
    translate_forced = 0

    for item in payload:
        if not item.get("should_translate", True):
            continue
        label = shared_literal_block_label(item)
        if label == "code":
            _mark_item_skipped(item, "code")
            code_skipped += 1
            continue
        if label == "translate_literal":
            item["classification_label"] = "translate_literal"
            item["should_translate"] = True
            item["skip_reason"] = ""
            translate_forced += 1

    return {
        "shared_literal_code_skipped": code_skipped,
        "shared_literal_code_region_skipped": code_region_skipped,
        "shared_literal_image_region_skipped": image_region_skipped,
        "shared_literal_translate_forced": translate_forced,
    }


def apply_ref_text_skip(payload: list[dict]) -> int:
    def _is_ref_text_like(item: dict) -> bool:
        if str(item.get("block_type", "") or "") == "ref_text":
            return True
        metadata = item.get("metadata") or {}
        source = metadata.get("source") or {}
        raw_type = str(source.get("raw_type", metadata.get("raw_type", "")) or "").strip().lower()
        if raw_type == "ref_text":
            return True
        ocr_sub_type = str(metadata.get("ocr_sub_type", "") or "").strip().lower()
        normalized_sub_type = str(metadata.get("normalized_sub_type", "") or "").strip().lower()
        return ocr_sub_type == "ref_text" or normalized_sub_type == "ref_text"

    skipped = 0
    for item in payload:
        if not _is_ref_text_like(item):
            continue
        if not item.get("should_translate", True):
            continue
        _mark_item_skipped(item, "skip_ref_text")
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

        metadata = item.get("metadata", {}) or {}
        if not item.get("should_translate", True):
            continue

        if is_reference_heading_semantic(metadata):
            _mark_item_skipped(item, "skip_reference_heading")
            skipped += 1
            continue

        if is_reference_entry_semantic(metadata):
            _mark_item_skipped(item, "skip_reference_zone")
            skipped += 1
    return skipped


def _join_prefix_and_tail(prefix: str, tail: str) -> str:
    left = prefix.rstrip()
    right = tail.strip()
    if not left:
        return right
    if not right:
        return left
    if right[:1] in ",.;:!?)]}":
        return left + right
    return f"{left} {right}"


def apply_mixed_literal_split_policy(
    payload: list[dict],
    *,
    api_key: str,
    model: str,
    base_url: str,
    workers: int,
    rule_guidance: str = "",
) -> dict[str, int]:
    candidates = [
        item
        for item in payload
        if item.get("should_translate", True)
        and str(item.get("classification_label", "") or "") == "translate_literal"
    ]
    if not candidates:
        return {
            "mixed_keep_all": 0,
            "mixed_translate_all": 0,
            "mixed_translate_tail": 0,
        }

    print(
        f"book: mixed literal split candidates={len(candidates)} workers={max(1, min(workers, 4))}",
        flush=True,
    )

    decisions = split_mixed_literal_items(
        candidates,
        api_key=api_key,
        model=model,
        base_url=base_url,
        workers=workers,
        rule_guidance=rule_guidance,
    )
    keep_all = 0
    translate_all = 0
    translate_tail = 0
    for item in candidates:
        item_id = str(item.get("item_id", "") or "")
        action, prefix = decisions.get(item_id, ("translate_all", ""))
        item["mixed_literal_action"] = action
        item["mixed_literal_prefix"] = prefix
        original_protected = str(item.get("mixed_original_protected_source_text", "") or item.get("protected_source_text", "") or "")
        item["mixed_original_protected_source_text"] = original_protected
        if action == "keep_all":
            _mark_item_skipped(item, "skip_mixed_keep_all")
            keep_all += 1
            continue
        if action == "translate_tail":
            protected_text = str(item.get("protected_source_text", "") or "")
            if protected_text.startswith(prefix):
                tail_protected = protected_text[len(prefix) :].strip()
            else:
                tail_protected = original_protected[len(prefix) :].strip() if original_protected.startswith(prefix) else protected_text
            if not tail_protected:
                _mark_item_skipped(item, "skip_mixed_keep_all")
                keep_all += 1
                continue
            item["protected_source_text"] = tail_protected
            if item.get("translation_unit_kind") == "single":
                item["translation_unit_protected_source_text"] = tail_protected
            item["classification_label"] = "translate_mixed_tail"
            item["should_translate"] = True
            item["skip_reason"] = ""
            translate_tail += 1
            continue
        item["classification_label"] = "translate_mixed_all"
        item["should_translate"] = True
        item["skip_reason"] = ""
        translate_all += 1
    return {
        "mixed_keep_all": keep_all,
        "mixed_translate_all": translate_all,
        "mixed_translate_tail": translate_tail,
    }


def apply_classification_labels(payload: list[dict], labels: dict[str, str]) -> int:
    classified_items = 0
    for item in payload:
        existing_label = str(item.get("classification_label", "") or "")
        if existing_label.startswith(("translate_", "skip_", "code")):
            continue
        item_id = item.get("item_id")
        label_value = labels.get(item_id, "translate")
        item["classification_label"] = label_value
        item["should_translate"] = label_value != "code"
        classified_items += 1
        if label_value == "code":
            item["skip_reason"] = "code"
            clear_translation_fields(item)
    return classified_items


def apply_title_skip(payload: list[dict]) -> int:
    skipped = 0
    for item in payload:
        if item.get("block_type") != "title":
            continue
        item["classification_label"] = item.get("classification_label") or "skip_title"
        item["should_translate"] = False
        item["skip_reason"] = "skip_title"
        clear_translation_fields(item)
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


def apply_metadata_fragment_skip(payload: list[dict], *, page_idx: int, max_page_idx: int) -> int:
    if page_idx > max_page_idx:
        return 0
    skip_ids = find_metadata_fragment_item_ids(payload)
    if not skip_ids:
        return 0
    skipped = 0
    for item in payload:
        item_id = item.get("item_id", "")
        if item_id not in skip_ids:
            continue
        if not item.get("should_translate", True):
            continue
        _mark_item_skipped(item, "skip_metadata_fragment")
        skipped += 1
    return skipped
