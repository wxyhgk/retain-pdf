from __future__ import annotations

from collections.abc import Iterable
import re

from services.rendering.layout.payload.text_common import get_render_formula_map
from services.rendering.layout.payload.text_common import same_meaningful_render_text
from services.rendering.core.render_text import should_skip_display_math_render

MATH_SOURCE_RE = re.compile(r"\$[^$]+\$|\\(?:begin|end|frac|lim|sum|int|mathrm|left|right|cdot|epsilon|forall|in)\b")
MODEL_KEEP_ORIGIN_REASONS = {"skip_model_keep_origin"}


def render_unit_kind(item: dict) -> str:
    return str(item.get("translation_unit_kind", "") or "").strip().lower()


def render_translation_unit_id(item: dict) -> str:
    return str(item.get("translation_unit_id", "") or "")


def render_continuation_group_id(item: dict) -> str:
    return str(item.get("continuation_group") or item.get("continuation_group_id") or "")


def _render_should_use_unit_translation(item: dict) -> bool:
    return render_unit_kind(item) == "group" or bool(render_continuation_group_id(item))


def render_protected_translation_text(item: dict) -> str:
    if not _render_should_use_unit_translation(item):
        text = (
            item.get("protected_translated_text")
            or item.get("translated_text")
            or item.get("translation_unit_protected_translated_text")
            or item.get("translation_unit_translated_text")
            or ""
        )
    else:
        text = (
            item.get("translation_unit_protected_translated_text")
            or item.get("group_protected_translated_text")
            or item.get("protected_translated_text")
            or item.get("translation_unit_translated_text")
            or item.get("group_translated_text")
            or item.get("translated_text")
            or ""
        )
    return str(text or "").strip()


def should_render_source_when_untranslated(item: dict) -> bool:
    if item.get("should_translate", True):
        return False
    if _skip_reason(item) in MODEL_KEEP_ORIGIN_REASONS:
        return False
    return should_render_source_block(item)


def should_render_source_block(item: dict) -> bool:
    if should_skip_display_math_render(item):
        return False
    if not item.get("should_translate", True) and _skip_reason(item) in MODEL_KEEP_ORIGIN_REASONS:
        return False
    source_text = render_protected_source_text(item)
    if not source_text:
        return False
    block_kind = str(item.get("block_kind", item.get("block_type", "")) or "").strip().lower()
    sub_type = str(item.get("normalized_sub_type", "") or "").strip().lower()
    if block_kind == "formula" or sub_type in {"formula", "display_formula"}:
        return True
    return bool(MATH_SOURCE_RE.search(source_text))


def _skip_reason(item: dict) -> str:
    return str(item.get("skip_reason", "") or item.get("classification_label", "") or "").strip().lower()


def render_protected_source_text(item: dict) -> str:
    if render_unit_kind(item) != "group":
        text = (
            item.get("protected_source_text")
            or item.get("source_text")
            or item.get("translation_unit_protected_source_text")
            or item.get("translation_unit_source_text")
            or ""
        )
    else:
        text = (
            item.get("translation_unit_protected_source_text")
            or item.get("group_protected_source_text")
            or item.get("protected_source_text")
            or item.get("translation_unit_source_text")
            or item.get("group_source_text")
            or item.get("source_text")
            or ""
        )
    return str(text or "").strip()


def seed_render_fields(item: dict) -> None:
    if should_skip_display_math_render(item):
        clear_render_fields(item)
        item["render_source_text"] = render_protected_source_text(item)
        return
    render_text = render_protected_translation_text(item)
    source_text = render_protected_source_text(item)
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
    for item in items:
        unit_id = render_continuation_group_id(item) or render_translation_unit_id(item)
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
    return max((render_protected_translation_text(item) for item in items), key=len, default="")


def group_unit_source_text(items: list[dict]) -> str:
    if not items:
        return ""
    return max((render_protected_source_text(item) for item in items), key=len, default="")


def clear_render_fields(item: dict) -> None:
    item["render_protected_text"] = ""
    item["render_formula_map"] = []
