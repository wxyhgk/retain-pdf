from translation.formula_protection import restore_inline_formulas
from translation.body_text_filter import find_narrow_body_noise_item_ids
from translation.metadata_filter import find_metadata_fragment_item_ids


GROUP_ITEM_PREFIX = "__cg__:"
RESETTABLE_LABEL_PREFIXES = (
    "skip_",
    "code",
    "review",
    "translate",
)


def _has_group_translation(item: dict) -> bool:
    return bool((item.get("group_protected_translated_text") or "").strip())


def _has_item_translation(item: dict) -> bool:
    return bool((item.get("translated_text") or "").strip())


def _has_any_translation(item: dict) -> bool:
    if item.get("continuation_group"):
        return _has_group_translation(item)
    return _has_item_translation(item)


def reset_policy_state(payload: list[dict]) -> int:
    reset = 0
    for item in payload:
        label = str(item.get("classification_label", "") or "")
        if not label:
            continue
        if not label.startswith(RESETTABLE_LABEL_PREFIXES):
            continue
        item["classification_label"] = ""
        item["should_translate"] = True
        reset += 1
    return reset


def apply_classification_labels(payload: list[dict], labels: dict[str, str]) -> int:
    classified_items = 0
    for item in payload:
        item_id = item.get("item_id")
        label_value = labels.get(item_id, "translate")
        item["classification_label"] = label_value
        item["should_translate"] = label_value != "code"
        classified_items += 1
        if label_value == "code":
            item["protected_translated_text"] = ""
            item["translated_text"] = ""
            item["group_protected_translated_text"] = ""
            item["group_translated_text"] = ""
    return classified_items


def apply_title_skip(payload: list[dict]) -> int:
    skipped = 0
    for item in payload:
        if item.get("block_type") != "title":
            continue
        item["classification_label"] = item.get("classification_label") or "skip_title"
        item["should_translate"] = False
        item["protected_translated_text"] = ""
        item["translated_text"] = ""
        item["group_protected_translated_text"] = ""
        item["group_translated_text"] = ""
        skipped += 1
    return skipped


def _mark_item_skipped(item: dict, label: str) -> None:
    item["classification_label"] = label
    item["should_translate"] = False
    item["protected_translated_text"] = ""
    item["translated_text"] = ""
    item["group_protected_translated_text"] = ""
    item["group_translated_text"] = ""


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


def pending_translation_items(payload: list[dict]) -> list[dict]:
    units: list[dict] = []
    groups: dict[str, list[dict]] = {}
    grouped_item_ids: set[str] = set()

    for item in payload:
        if not item.get("should_translate", True):
            continue
        group_id = item.get("continuation_group", "")
        if group_id:
            groups.setdefault(group_id, []).append(item)
            grouped_item_ids.add(item.get("item_id", ""))
            continue
        if not _has_item_translation(item):
            units.append(item)

    for group_id, items in groups.items():
        items = [item for item in items if item.get("should_translate", True)]
        if not items:
            continue
        if any(_has_group_translation(item) for item in items):
            continue

        formula_map: list[dict] = []
        protected_chunks: list[str] = []
        next_formula_index = 1
        for item in items:
            source = item.get("protected_source_text", "")
            local_map = item.get("formula_map", [])
            remapped_source = source
            remapped_formulas = []
            for entry in local_map:
                new_placeholder = f"[[FORMULA_{next_formula_index}]]"
                next_formula_index += 1
                remapped_source = remapped_source.replace(entry["placeholder"], new_placeholder)
                remapped_formulas.append(
                    {
                        "placeholder": new_placeholder,
                        "formula_text": entry["formula_text"],
                    }
                )
            formula_map.extend(remapped_formulas)
            protected_chunks.append(remapped_source.strip())

        combined_source = " ".join(chunk for chunk in protected_chunks if chunk).strip()
        if not combined_source:
            continue

        for item in items:
            item["group_protected_source_text"] = combined_source
            item["group_formula_map"] = formula_map

        units.append(
            {
                "item_id": f"{GROUP_ITEM_PREFIX}{group_id}",
                "protected_source_text": combined_source,
            }
        )

    return units


def apply_translated_text_map(payload: list[dict], translated: dict[str, str]) -> None:
    group_items: dict[str, list[dict]] = {}
    for item in payload:
        group_id = item.get("continuation_group", "")
        if group_id:
            group_items.setdefault(group_id, []).append(item)

    for item_id, protected_translated_text in translated.items():
        if not item_id.startswith(GROUP_ITEM_PREFIX):
            continue
        group_id = item_id[len(GROUP_ITEM_PREFIX) :]
        items = group_items.get(group_id, [])
        if not items:
            continue
        formula_map = items[0].get("group_formula_map", [])
        restored = restore_inline_formulas(protected_translated_text, formula_map)
        for item in items:
            if not item.get("should_translate", True):
                item["group_protected_translated_text"] = ""
                item["group_translated_text"] = ""
                continue
            item["group_protected_translated_text"] = protected_translated_text
            item["group_translated_text"] = restored

    for item in payload:
        item_id = item.get("item_id")
        if item_id not in translated:
            continue
        protected_translated_text = translated[item_id]
        item["protected_translated_text"] = protected_translated_text
        item["translated_text"] = restore_inline_formulas(
            protected_translated_text,
            item.get("formula_map", []),
        )


def summarize_payload(payload: list[dict], translation_path: str, page_idx: int, classified_items: int) -> dict:
    translated_count = sum(1 for item in payload if _has_any_translation(item))
    skipped_count = sum(1 for item in payload if not item.get("should_translate", True))
    pending_count = sum(
        1
        for item in payload
        if item.get("should_translate", True) and not _has_any_translation(item)
    )
    return {
        "translation_path": translation_path,
        "page_idx": page_idx,
        "total_items": len(payload),
        "translated_items": translated_count,
        "pending_items": pending_count,
        "classified_items": classified_items,
        "skipped_items": skipped_count,
    }
