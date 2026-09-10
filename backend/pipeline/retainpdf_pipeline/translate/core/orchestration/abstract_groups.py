from __future__ import annotations

from retainpdf_pipeline.translate.core.item_reader import item_layout_role
from retainpdf_pipeline.translate.core.item_reader import item_semantic_role
from retainpdf_pipeline.translate.core.item_reader import item_structure_role


ABSTRACT_TRANSLATION_GROUP_KIND = "abstract"
AGGREGATE_GEOMETRY_GROUP_STRATEGY = "aggregate_geometry"
ABSTRACT_GROUP_ID_PREFIX = "abstract:"

_TRANSLATION_RESULT_FIELDS = (
    "translation_unit_protected_translated_text",
    "translation_unit_translated_text",
    "group_protected_translated_text",
    "group_translated_text",
    "protected_translated_text",
    "translated_text",
)


def _page_idx(item: dict) -> int:
    value = item.get("page_idx", -1)
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    try:
        return int(value)
    except (TypeError, ValueError):
        return -1


def _is_abstract_slot(item: dict) -> bool:
    return (
        item_semantic_role(item) == "abstract"
        and item_layout_role(item) in {"", "paragraph", "list_item"}
        and item_structure_role(item) in {"", "body", "abstract"}
        and bool(item.get("should_translate", True))
        and bool(str(item.get("protected_source_text") or item.get("source_text") or "").strip())
        and len(item.get("bbox", []) or []) == 4
    )


def _has_translation(item: dict) -> bool:
    return any(str(item.get(key, "") or "").strip() for key in _TRANSLATION_RESULT_FIELDS)


def _stable_abstract_group_id(items: list[dict]) -> str:
    first_item_id = str(items[0].get("item_id", "") or "").strip()
    return f"{ABSTRACT_GROUP_ID_PREFIX}{first_item_id}"


def _already_same_abstract_group(items: list[dict], group_id: str) -> bool:
    return all(
        str(item.get("translation_group_id", "") or "").strip() == group_id
        and str(item.get("translation_group_kind", "") or "").strip() == ABSTRACT_TRANSLATION_GROUP_KIND
        and str(item.get("translation_group_strategy", "") or "").strip()
        == AGGREGATE_GEOMETRY_GROUP_STRATEGY
        for item in items
    )


def _abstract_runs(payload: list[dict]) -> list[list[dict]]:
    runs: list[list[dict]] = []
    current: list[dict] = []
    current_page_idx = -1
    for item in payload:
        page_idx = _page_idx(item)
        if _is_abstract_slot(item) and (not current or page_idx == current_page_idx):
            current.append(item)
            current_page_idx = page_idx
            continue
        if len(current) >= 2:
            runs.append(current)
        current = [item] if _is_abstract_slot(item) else []
        current_page_idx = page_idx if current else -1
    if len(current) >= 2:
        runs.append(current)
    return runs


def annotate_abstract_translation_groups(payload: list[dict]) -> int:
    """Group same-page abstract slots without merging their geometry.

    Existing individually translated records stay untouched for compatibility.
    New or already-grouped records share one aggregate translation unit, while
    every member retains its own source text, item id, and bbox for rendering.
    """

    annotated = 0
    active_item_ids: set[str] = set()
    for items in _abstract_runs(payload):
        group_id = _stable_abstract_group_id(items)
        already_grouped = _already_same_abstract_group(items, group_id)
        if any(_has_translation(item) for item in items) and not already_grouped:
            continue
        for item in items:
            before = (
                item.get("translation_group_id"),
                item.get("translation_group_kind"),
                item.get("translation_group_strategy"),
            )
            item["translation_group_id"] = group_id
            item["translation_group_kind"] = ABSTRACT_TRANSLATION_GROUP_KIND
            item["translation_group_strategy"] = AGGREGATE_GEOMETRY_GROUP_STRATEGY
            after = (
                item.get("translation_group_id"),
                item.get("translation_group_kind"),
                item.get("translation_group_strategy"),
            )
            item_id = str(item.get("item_id", "") or "").strip()
            if item_id:
                active_item_ids.add(item_id)
            if before != after:
                annotated += 1

    for item in payload:
        item_id = str(item.get("item_id", "") or "").strip()
        if item_id in active_item_ids:
            continue
        if str(item.get("translation_group_kind", "") or "").strip() != ABSTRACT_TRANSLATION_GROUP_KIND:
            continue
        if _has_translation(item):
            continue
        item["translation_group_id"] = ""
        item["translation_group_kind"] = ""
        item["translation_group_strategy"] = ""
    return annotated


__all__ = [
    "ABSTRACT_GROUP_ID_PREFIX",
    "ABSTRACT_TRANSLATION_GROUP_KIND",
    "AGGREGATE_GEOMETRY_GROUP_STRATEGY",
    "annotate_abstract_translation_groups",
]
