from retainpdf_translation.core.item_reader import item_is_aggregate_geometry_member

GROUP_ITEM_PREFIX = "__cg__:"
RESETTABLE_LABEL_PREFIXES = (
    "skip_",
    "code",
    "review",
    "translate",
)

TRANSLATION_CLEAR_FIELDS = (
    "translation_unit_protected_translated_text",
    "translation_unit_translated_text",
    "protected_translated_text",
    "translated_text",
    "group_protected_translated_text",
    "group_translated_text",
)


def translation_unit_id(item: dict) -> str:
    return str(item.get("translation_unit_id") or item.get("item_id") or "")


def translation_unit_member_ids(item: dict) -> list[str]:
    members = item.get("translation_unit_member_ids") or []
    return [str(member or "").strip() for member in members if str(member or "").strip()]


def is_group_unit_id(unit_id: str) -> bool:
    return unit_id.startswith(GROUP_ITEM_PREFIX)


def group_unit_id(group_id: str) -> str:
    return f"{GROUP_ITEM_PREFIX}{str(group_id or '').strip()}"


def existing_group_unit_id(item: dict) -> str:
    unit_id = str(item.get("translation_unit_id", "") or "").strip()
    if is_group_unit_id(unit_id):
        return unit_id
    return ""


def effective_group_id(item: dict) -> tuple[str, str]:
    """这一块和谁一起翻：(来源, 组号)。摘要组（translation_group_id）优先，其次接续组（continuation_group）；都没有是 ("", "")。

    分桶（group_key）、起单元号（seed_orchestration_metadata、translation_units._effective_group_unit_id）都只认这一个先后：
    以前后者先看接续组、前两个先看摘要组，一块要是两个都有，会分进摘要组的桶、单元号却按接续组起（2026-11-02 整理时查出）。"""
    translation_group_id = str(item.get("translation_group_id", "") or "").strip()
    if translation_group_id:
        return "translation", translation_group_id
    continuation_group = str(item.get("continuation_group", "") or "").strip()
    if continuation_group:
        return "continuation", continuation_group
    return "", ""


def is_aggregate_geometry_group_unit(item: dict) -> bool:
    """摘要组里、而且这一组真有两块以上。"""
    return item_is_aggregate_geometry_member(item) and item_has_multi_member_group_unit(item)


def group_key(item: dict) -> str:
    source, group_id = effective_group_id(item)
    if group_id:
        return f"{source}:{group_id}"
    unit_id = existing_group_unit_id(item)
    if unit_id:
        return f"unit:{unit_id}"
    return ""


def clear_singleton_continuation_group(item: dict, *, group_counts: dict[str, int]) -> bool:
    continuation_group = str(item.get("continuation_group", "") or "").strip()
    if not continuation_group:
        return False
    if group_counts.get(continuation_group, 0) != 1:
        return False
    prev_id = str(item.get("continuation_candidate_prev_id", "") or "").strip()
    next_id = str(item.get("continuation_candidate_next_id", "") or "").strip()
    provider_group_id = str(item.get("ocr_continuation_group_id", "") or "").strip()
    if prev_id or next_id or provider_group_id:
        return False
    item["continuation_group"] = ""
    return True


def seed_orchestration_metadata(item: dict) -> None:
    label = str(item.get("classification_label", "") or "")
    should_translate = bool(item.get("should_translate", True))
    item_id = str(item.get("item_id", "") or "")
    _source, group_id = effective_group_id(item)
    unit_id = group_unit_id(group_id) if group_id else item_id
    # skip_reason 归 policy 阶段所有;编排阶段只补缺，不覆盖已有的详细原因。
    if not should_translate:
        if not str(item.get("skip_reason", "") or "").strip():
            item["skip_reason"] = label
    else:
        item["skip_reason"] = ""
    item["translation_unit_id"] = unit_id
    item["translation_unit_kind"] = "group" if is_group_unit_id(unit_id) else "single"
    if item["translation_unit_kind"] == "single":
        seed_single_translation_unit(item)
    item["candidate_pair_prev_id"] = str(item.get("continuation_candidate_prev_id", "") or "")
    item["candidate_pair_next_id"] = str(item.get("continuation_candidate_next_id", "") or "")


def item_has_multi_member_group_unit(item: dict) -> bool:
    unit_id = translation_unit_id(item)
    if not is_group_unit_id(unit_id):
        return False
    return len(translation_unit_member_ids(item)) >= 2


def effective_translation_unit_id(item: dict) -> str:
    unit_id = translation_unit_id(item)
    if item_has_multi_member_group_unit(item):
        return unit_id
    return str(item.get("item_id") or unit_id or "")


def seed_single_translation_unit(item: dict) -> None:
    item_id = str(item.get("item_id") or "")
    item["translation_unit_id"] = item_id
    item["translation_unit_kind"] = "single"
    item["translation_unit_member_ids"] = [item_id] if item_id else []
    item["translation_unit_protected_source_text"] = item.get("protected_source_text", "")
    item["translation_unit_formula_map"] = item.get("formula_map", [])
    item["translation_unit_protected_map"] = item.get("protected_map", item.get("formula_map", []))


def seed_group_translation_unit(
    item: dict,
    *,
    unit_id: str,
    member_ids: list[str],
    protected_source_text: str,
    formula_map: list[dict],
    protected_map: list[dict],
) -> None:
    item["translation_unit_id"] = unit_id
    item["translation_unit_kind"] = "group"
    item["translation_unit_member_ids"] = list(member_ids)
    item["translation_unit_protected_source_text"] = protected_source_text
    item["translation_unit_formula_map"] = formula_map
    item["translation_unit_protected_map"] = protected_map
    item["group_protected_source_text"] = protected_source_text
    item["group_formula_map"] = formula_map
    item["group_protected_map"] = protected_map


def translation_unit_state_snapshot(item: dict) -> tuple[object, ...]:
    return (
        item.get("translation_unit_id"),
        item.get("translation_unit_kind"),
        item.get("translation_unit_member_ids"),
        item.get("translation_unit_protected_source_text"),
        item.get("translation_unit_formula_map"),
        item.get("translation_unit_protected_map"),
        item.get("group_protected_source_text"),
        item.get("group_formula_map"),
        item.get("group_protected_map"),
    )


def has_group_translation(item: dict) -> bool:
    return bool(
        (item.get("translation_unit_protected_translated_text") or item.get("group_protected_translated_text") or "").strip()
    )


def has_item_translation(item: dict) -> bool:
    return bool(
        (
            item.get("translation_unit_protected_translated_text")
            or item.get("protected_translated_text")
            or item.get("translated_text")
            or ""
        ).strip()
    )


def has_any_translation(item: dict) -> bool:
    if item_has_multi_member_group_unit(item):
        return has_group_translation(item)
    return has_item_translation(item)


def clear_translation_fields(item: dict) -> None:
    for field in TRANSLATION_CLEAR_FIELDS:
        item[field] = ""
