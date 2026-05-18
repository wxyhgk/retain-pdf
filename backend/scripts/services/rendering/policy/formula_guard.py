from __future__ import annotations

import fitz

from services.rendering.policy.cleanup_policy import build_render_page_policy
from services.rendering.policy.cleanup_policy import apply_render_item_policy_fields
from services.rendering.policy.cleanup_policy import item_has_formula_region
from services.rendering.policy.geometry import item_rect
from services.rendering.policy.geometry import merge_rects
from services.rendering.policy.geometry import rect_list
from services.rendering.policy.geometry import x_overlap_ratio
from services.translation.item_reader import item_block_kind


FORMULA_GUARD_VERTICAL_PAD_PT = 12.0
FORMULA_GUARD_HORIZONTAL_PAD_PT = 8.0
FORMULA_GUARD_X_OVERLAP_RATIO = 0.18
FORMULA_GUARD_NEIGHBOR_MAX_GAP_PT = 72.0
MIN_REDACTION_FRAGMENT_HEIGHT_PT = 2.0


def protect_formula_regions_in_redaction_items(
    redaction_items: list[dict],
    translated_items: list[dict],
) -> list[dict]:
    formula_rects = page_formula_rects(translated_items)
    if not formula_rects or not redaction_items:
        return redaction_items

    text_rects = page_text_source_rects(translated_items)
    page_policy = build_render_page_policy(translated_items)
    formula_guards = expanded_formula_guards(formula_rects, text_rects)
    if not formula_guards:
        return redaction_items

    protected_items: list[dict] = []
    for item in redaction_items:
        item_policy = page_policy.item_policy(redaction_source_item_id(item))
        source_item = _apply_policy_fields_to_redaction_item(item, item_policy)
        bbox = item.get("bbox", [])
        if len(bbox) != 4:
            protected_items.append(source_item)
            continue
        rect = fitz.Rect(bbox)
        if rect.is_empty:
            continue
        fragments = split_rect_away_from_formula_guards(rect, formula_guards)
        if len(fragments) == 1 and fragments[0] == rect:
            protected_items.append(source_item)
            continue
        for fragment_index, fragment in enumerate(fragments):
            fragment_item = dict(source_item)
            fragment_item["bbox"] = rect_list(fragment)
            fragment_item["_formula_guard_fragment"] = True
            fragment_item["_formula_guard_fragment_index"] = fragment_index
            protected_items.append(fragment_item)
    return protected_items


def redaction_source_item_id(item: dict) -> str:
    value = item.get("source_item_id") or item.get("item_id") or ""
    return str(value).removeprefix("item-").strip()


def page_formula_rects(items: list[dict]) -> list[fitz.Rect]:
    rects: list[fitz.Rect] = []
    for item in items:
        if not item_has_formula_region(item):
            continue
        rect = item_rect(item)
        if rect is not None:
            rects.append(rect)
    return rects


def page_text_source_rects(items: list[dict]) -> list[fitz.Rect]:
    rects: list[fitz.Rect] = []
    for item in items:
        if item_block_kind(item) != "text":
            continue
        rect = item_rect(item)
        if rect is not None:
            rects.append(rect)
    return merge_rects(rects)


def expanded_formula_guards(formula_rects: list[fitz.Rect], text_rects: list[fitz.Rect]) -> list[fitz.Rect]:
    return merge_rects([expanded_formula_guard(rect, text_rects) for rect in formula_rects if not rect.is_empty])


def expanded_formula_guard(formula: fitz.Rect, text_rects: list[fitz.Rect]) -> fitz.Rect:
    guard = fitz.Rect(
        formula.x0 - FORMULA_GUARD_HORIZONTAL_PAD_PT,
        formula.y0 - FORMULA_GUARD_VERTICAL_PAD_PT,
        formula.x1 + FORMULA_GUARD_HORIZONTAL_PAD_PT,
        formula.y1 + FORMULA_GUARD_VERTICAL_PAD_PT,
    )
    same_column = [
        rect
        for rect in text_rects
        if not rect.is_empty and x_overlap_ratio(rect, formula) >= FORMULA_GUARD_X_OVERLAP_RATIO
    ]
    if not same_column:
        return guard

    above = [
        rect
        for rect in same_column
        if rect.y1 <= formula.y0 and formula.y0 - rect.y1 <= FORMULA_GUARD_NEIGHBOR_MAX_GAP_PT
    ]
    below = [
        rect
        for rect in same_column
        if rect.y0 >= formula.y1 and rect.y0 - formula.y1 <= FORMULA_GUARD_NEIGHBOR_MAX_GAP_PT
    ]
    overlapping = [rect for rect in same_column if not (rect & guard).is_empty]
    column_refs = overlapping or above[-1:] + below[:1] or same_column

    guard.x0 = min([guard.x0, *(rect.x0 - FORMULA_GUARD_HORIZONTAL_PAD_PT for rect in column_refs)])
    guard.x1 = max([guard.x1, *(rect.x1 + FORMULA_GUARD_HORIZONTAL_PAD_PT for rect in column_refs)])
    if above:
        guard.y0 = min(guard.y0, max(rect.y1 for rect in above))
    if below:
        guard.y1 = max(guard.y1, min(rect.y0 for rect in below))
    return guard


def split_rect_away_from_formula_guards(rect: fitz.Rect, formula_guards: list[fitz.Rect]) -> list[fitz.Rect]:
    fragments = [fitz.Rect(rect)]
    for guard in formula_guards:
        next_fragments: list[fitz.Rect] = []
        for fragment in fragments:
            if x_overlap_ratio(fragment, guard) < FORMULA_GUARD_X_OVERLAP_RATIO:
                next_fragments.append(fragment)
                continue
            if (fragment & guard).is_empty:
                next_fragments.append(fragment)
                continue
            upper = fitz.Rect(fragment.x0, fragment.y0, fragment.x1, min(fragment.y1, guard.y0))
            lower = fitz.Rect(fragment.x0, max(fragment.y0, guard.y1), fragment.x1, fragment.y1)
            if upper.width > 0 and upper.height >= MIN_REDACTION_FRAGMENT_HEIGHT_PT:
                next_fragments.append(upper)
            if lower.width > 0 and lower.height >= MIN_REDACTION_FRAGMENT_HEIGHT_PT:
                next_fragments.append(lower)
        fragments = next_fragments
        if not fragments:
            break
    return [fragment for fragment in fragments if not fragment.is_empty]


def _apply_policy_fields_to_redaction_item(item: dict, item_policy) -> dict:
    if item_policy.cleanup_mode != "visual_cover":
        return dict(item)
    return apply_render_item_policy_fields(item, item_policy)
