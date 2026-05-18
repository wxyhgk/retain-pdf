from __future__ import annotations

import fitz

from services.rendering.policy import build_cleanup_item_plan


def visual_cover_rects(valid_items: list[tuple[fitz.Rect, dict, str]]) -> list[fitz.Rect]:
    return [rect for rect, item, _translated_text in valid_items if build_cleanup_item_plan(item).visual_cover_only]


def bbox_text_strip_rects(valid_items: list[tuple[fitz.Rect, dict, str]]) -> list[fitz.Rect]:
    return [rect for rect, item, _translated_text in valid_items if build_cleanup_item_plan(item).bbox_text_strip_allowed]
