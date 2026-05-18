from __future__ import annotations

import fitz

from services.rendering.policy import formula_neighbor_text_item_ids
from services.rendering.policy import item_has_formula_region
from services.rendering.policy import item_should_bbox_text_strip
from services.rendering.policy import page_should_skip_bbox_text_strip
from services.rendering.policy.formula_guard import expanded_formula_guard
from services.rendering.policy.formula_guard import expanded_formula_guards
from services.rendering.policy.formula_guard import split_rect_away_from_formula_guards


def should_skip_page_for_bbox_text_strip(items: list[dict], *, skip_formula_pages: bool) -> bool:
    return skip_formula_pages and page_should_skip_bbox_text_strip(items)


def formula_neighbor_item_ids(items: list[dict]) -> set[str]:
    return formula_neighbor_text_item_ids(items)


def has_formula_region(item: dict) -> bool:
    return item_has_formula_region(item)


def should_strip_item_text(item: dict, *, skip_item_ids: set[str] | None = None) -> bool:
    return item_should_bbox_text_strip(item, skip_item_ids=skip_item_ids)


def expanded_formula_guard_rect(formula_rect: fitz.Rect, strip_rects: list[fitz.Rect]) -> fitz.Rect:
    return expanded_formula_guard(formula_rect, strip_rects)


def expanded_formula_guard_rects(formula_rects: list[fitz.Rect], strip_rects: list[fitz.Rect]) -> list[fitz.Rect]:
    return expanded_formula_guards(formula_rects, strip_rects)


def split_rect_away_from_formula_guard_rects(rect: fitz.Rect, guards: list[fitz.Rect]) -> list[fitz.Rect]:
    return split_rect_away_from_formula_guards(rect, guards)
