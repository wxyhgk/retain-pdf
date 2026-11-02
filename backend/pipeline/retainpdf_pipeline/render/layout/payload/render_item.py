from __future__ import annotations

import re
from collections.abc import Iterable

from retainpdf_pipeline.render.layout.payload.text_common import get_render_formula_map
from retainpdf_pipeline.render.layout.payload.line_structure import maybe_preserve_structured_line_breaks
from retainpdf_pipeline.render.layout.payload.text_common import same_meaningful_render_text
from retainpdf_pipeline.render.layout.model.render_text import member_translation_text as _member_translation_text
from retainpdf_pipeline.render.layout.model.render_text import render_protected_source_text
from retainpdf_pipeline.render.layout.model.render_text import render_protected_translation_text
from retainpdf_pipeline.render.layout.model.render_text import should_render_source_block
from retainpdf_pipeline.render.layout.model.render_text import should_skip_display_math_render

RENDER_FIRST_LINE_INDENT_KEY = "_render_first_line_indent_pt"
RENDER_INNER_BBOX_KEY = "_render_inner_bbox"


def render_unit_kind(item: dict) -> str:
    return str(item.get("translation_unit_kind", "") or "").strip().lower()


def render_translation_unit_id(item: dict) -> str:
    return str(item.get("translation_unit_id", "") or "")


def render_continuation_group_id(item: dict) -> str:
    return str(item.get("continuation_group") or item.get("continuation_group_id") or "")


def _render_should_use_unit_translation(item: dict) -> bool:
    return render_unit_kind(item) == "group" or bool(render_continuation_group_id(item))


def _unit_protected_translation_text(item: dict) -> str:
    return str(
        item.get("translation_unit_protected_translated_text")
        or item.get("group_protected_translated_text")
        or item.get("translation_unit_translated_text")
        or item.get("group_translated_text")
        or ""
    ).strip()


def _compact_boundary_text(text: str) -> str:
    return re.sub(r"[\s，,、]+", "", str(text or ""))


def _has_repeated_aggregate_member_text(items: list[dict]) -> bool:
    if len(items) < 2:
        return False
    aggregate = max((_unit_protected_translation_text(item) for item in items), key=len, default="")
    compact_aggregate = _compact_boundary_text(aggregate)
    if not compact_aggregate:
        return False
    member_texts = [_compact_boundary_text(_member_translation_text(item)) for item in items]
    return all(member_text == compact_aggregate for member_text in member_texts)


def seed_render_fields(item: dict) -> None:
    if should_skip_display_math_render(item):
        clear_render_fields(item)
        item["render_source_text"] = render_protected_source_text(item)
        return
    render_text = render_protected_translation_text(item)
    source_text = render_protected_source_text(item)
    render_text = maybe_preserve_structured_line_breaks(item, render_text)
    if not render_text and should_render_source_block(item):
        render_text = source_text
    item["render_protected_text"] = (
        render_text
        if should_render_source_block(item)
        else "" if same_meaningful_render_text(source_text, render_text) else render_text
    )
    item["render_source_text"] = source_text
    item["render_formula_map"] = get_render_formula_map(item)


def group_render_unit_items(items: Iterable[dict]) -> dict[str, list[dict]]:
    units: dict[str, list[dict]] = {}
    continuation_units_with_member_text: set[str] = set()
    materialized_items = list(items)
    continuation_members: dict[str, list[dict]] = {}
    for item in materialized_items:
        unit_id = render_continuation_group_id(item)
        if unit_id:
            continuation_members.setdefault(unit_id, []).append(item)
    for unit_id, members in continuation_members.items():
        if any(_member_translation_text(item) for item in members) and not _has_repeated_aggregate_member_text(
            members
        ):
            continuation_units_with_member_text.add(unit_id)
    for item in materialized_items:
        unit_id = render_continuation_group_id(item) or render_translation_unit_id(item)
        if render_continuation_group_id(item) in continuation_units_with_member_text:
            continue
        if _render_should_use_unit_translation(item) and unit_id:
            units.setdefault(unit_id, []).append(item)
    return units


def item_has_group_render_text(item: dict) -> bool:
    return bool(render_protected_translation_text(item))


def group_unit_formula_map(items: list[dict]) -> list[dict]:
    if not items:
        return []
    return get_render_formula_map(items[0])


def group_unit_protected_text(items: list[dict]) -> str:
    if not items:
        return ""
    unit_text = max((_unit_protected_translation_text(item) for item in items), key=len, default="")
    if unit_text:
        return unit_text
    return max((render_protected_translation_text(item) for item in items), key=len, default="")


def group_unit_source_text(items: list[dict]) -> str:
    if not items:
        return ""
    return max((render_protected_source_text(item) for item in items), key=len, default="")


def clear_render_fields(item: dict) -> None:
    item["render_protected_text"] = ""
    item["render_formula_map"] = []


def set_render_first_line_indent_pt(item: dict, value: float) -> None:
    indent = max(0.0, float(value or 0.0))
    if indent > 0:
        item[RENDER_FIRST_LINE_INDENT_KEY] = indent


def get_render_first_line_indent_pt(item: dict) -> float:
    try:
        return max(0.0, float(item.get(RENDER_FIRST_LINE_INDENT_KEY) or 0.0))
    except Exception:
        return 0.0


def set_render_inner_bbox(item: dict, bbox: list[float]) -> None:
    if isinstance(bbox, list) and len(bbox) == 4:
        item[RENDER_INNER_BBOX_KEY] = [float(value) for value in bbox]


def get_render_inner_bbox(item: dict) -> list[float] | None:
    bbox = item.get(RENDER_INNER_BBOX_KEY)
    if isinstance(bbox, list) and len(bbox) == 4:
        try:
            return [float(value) for value in bbox]
        except Exception:
            return None
    return None
