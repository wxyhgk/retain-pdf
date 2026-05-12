from __future__ import annotations

import re

from services.rendering.layout.typography.measurement import bbox_width
from services.rendering.layout.typography.measurement import formula_ratio
from services.rendering.layout.typography.measurement import source_visual_line_count
from services.translation.item_reader import item_block_kind
from services.translation.item_reader import item_is_bodylike
from services.translation.item_reader import item_is_caption_like
from services.translation.item_reader import item_is_plain_text_block
from services.translation.item_reader import item_is_textual
from services.translation.item_reader import item_is_title_like
from services.translation.item_reader import item_layout_role
from services.translation.item_reader import item_semantic_role


BODY_FORMULA_RATIO_MAX = 0.5


def is_caption_like_block(item: dict) -> bool:
    return item_is_caption_like(item)


def item_layout_role_name(item: dict) -> str:
    return item_layout_role(item)


def item_semantic_role_name(item: dict) -> str:
    return item_semantic_role(item)


def is_local_textual_item(item: dict) -> bool:
    if is_caption_like_block(item):
        return True
    if item_is_title_like(item):
        return True
    if item_block_kind(item) == "text":
        return True
    return item_is_textual(item)


def is_body_text_candidate(item: dict, page_text_width_med: float) -> bool:
    if is_caption_like_block(item):
        return False
    layout_role = item_layout_role_name(item)
    semantic_role = item_semantic_role_name(item)
    if not item_is_plain_text_block(item):
        if layout_role not in {"paragraph", "list_item"}:
            return False
    if semantic_role not in {"", "body", "abstract"}:
        return False
    if formula_ratio(item) > BODY_FORMULA_RATIO_MAX:
        return False
    text_len = len(re.sub(r"\s+", "", item.get("source_text", "")))
    width = bbox_width(item)
    if page_text_width_med > 0 and width < page_text_width_med * 0.75:
        if not (
            item_is_bodylike(item)
            and text_len >= 36
            and source_visual_line_count(item) >= 2
        ):
            return False
    return text_len >= 40


def is_default_text_block(item: dict) -> bool:
    if item_is_title_like(item):
        return True
    if not item_is_plain_text_block(item):
        return False
    line_count = len(item.get("lines", []))
    text_len = len(re.sub(r"\s+", "", item.get("source_text", "")))
    return line_count <= 1 and text_len < 60


def is_title_like_block(item: dict) -> bool:
    return item_is_title_like(item)


def resolve_font_weight(item: dict) -> str:
    return "bold" if is_title_like_block(item) else "regular"


__all__ = [
    "BODY_FORMULA_RATIO_MAX",
    "is_body_text_candidate",
    "is_caption_like_block",
    "is_default_text_block",
    "is_local_textual_item",
    "is_title_like_block",
    "item_layout_role_name",
    "item_semantic_role_name",
    "resolve_font_weight",
]
