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


def is_group_unit_id(unit_id: str) -> bool:
    return unit_id.startswith(GROUP_ITEM_PREFIX)


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
    if is_group_unit_id(translation_unit_id(item)):
        return has_group_translation(item)
    return has_item_translation(item)


def clear_translation_fields(item: dict) -> None:
    for field in TRANSLATION_CLEAR_FIELDS:
        item[field] = ""
