from __future__ import annotations

import fitz

from services.rendering.policy import build_cleanup_item_plan
from services.rendering.source.rects import merge_rects


def cover_rects_from_valid_items(valid_items: list[tuple[fitz.Rect, dict, str]]) -> list[fitz.Rect]:
    mergeable_rects: list[fitz.Rect] = []
    protected_fragments: list[fitz.Rect] = []
    for rect, item, _translated_text in valid_items:
        if item.get("_formula_guard_fragment"):
            protected_fragments.append(rect)
        else:
            mergeable_rects.append(rect)
    return merge_rects(mergeable_rects) + protected_fragments


def text_removal_rects_from_valid_items(valid_items: list[tuple[fitz.Rect, dict, str]]) -> list[fitz.Rect]:
    return [
        rect
        for rect, item, _translated_text in valid_items
        if build_cleanup_item_plan(item).bbox_text_strip_allowed
    ]
