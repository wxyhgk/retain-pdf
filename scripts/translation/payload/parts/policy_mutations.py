from translation.policy.body_text_filter import find_narrow_body_noise_item_ids
from translation.policy.literal_block_rules import shared_literal_block_label
from translation.policy.mixed_literal_splitter import split_mixed_literal_items
from translation.policy.metadata_filter import find_metadata_fragment_item_ids
from translation.policy.reference_section import looks_like_reference_continuation_text
from translation.policy.reference_section import looks_like_reference_entry_text
from translation.policy.reference_section import looks_like_reference_heading

from .common import RESETTABLE_LABEL_PREFIXES
from .common import clear_translation_fields


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
        "shared_literal_translate_forced": translate_forced,
    }


def apply_ref_text_skip(payload: list[dict]) -> int:
    skipped = 0
    for item in payload:
        if str(item.get("block_type", "") or "") != "ref_text":
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
    previous_reference_item = page_idx > cutoff_page_idx
    for item in payload:
        item_page_idx = item.get("page_idx", page_idx)
        block_idx = item.get("block_idx", -1)
        if item_page_idx < cutoff_page_idx:
            continue
        if item_page_idx == cutoff_page_idx and block_idx < cutoff_block_idx:
            continue

        text = " ".join((item.get("source_text") or "").split())
        block_type = str(item.get("block_type", "") or "")
        if not item.get("should_translate", True):
            if block_type == "ref_text" or str(item.get("skip_reason", "") or "").startswith("skip_ref"):
                previous_reference_item = True
            continue

        if block_type == "title" and looks_like_reference_heading(text):
            _mark_item_skipped(item, "skip_reference_heading")
            skipped += 1
            previous_reference_item = True
            continue

        if looks_like_reference_entry_text(text):
            _mark_item_skipped(item, "skip_reference_zone")
            skipped += 1
            previous_reference_item = True
            continue

        if previous_reference_item and looks_like_reference_continuation_text(text):
            _mark_item_skipped(item, "skip_reference_zone")
            skipped += 1
            previous_reference_item = True
            continue

        previous_reference_item = False
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
        clear_translation_fields(item)
        skipped += 1
    return skipped


def apply_after_last_title_skip(
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
        _mark_item_skipped(item, "skip_after_last_title")
        skipped += 1
    return skipped


def apply_scientific_paper_skips(
    payload: list[dict],
    *,
    page_idx: int,
    cutoff_page_idx: int | None = None,
    cutoff_block_idx: int | None = None,
) -> dict[str, int]:
    title_skipped = apply_title_skip(payload)
    tail_skipped = apply_after_last_title_skip(
        payload,
        page_idx=page_idx,
        cutoff_page_idx=cutoff_page_idx,
        cutoff_block_idx=cutoff_block_idx,
    )
    return {
        "title_skipped": title_skipped,
        "tail_skipped": tail_skipped,
    }


def apply_narrow_body_text_skip(payload: list[dict]) -> int:
    skip_ids = find_narrow_body_noise_item_ids(payload)
    if not skip_ids:
        return 0
    skipped = 0
    for item in payload:
        item_id = item.get("item_id", "")
        if item_id not in skip_ids:
            continue
        if not item.get("should_translate", True):
            continue
        _mark_item_skipped(item, "skip_narrow_body_noise")
        skipped += 1
    return skipped


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
