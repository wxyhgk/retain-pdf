from __future__ import annotations

import re

from retainpdf_pipeline.render.semantics.item_view import block_kind
from retainpdf_pipeline.render.semantics.item_view import is_caption_like_block as schema_is_caption_like_block
from retainpdf_pipeline.render.semantics.item_view import is_footnote_like_block as schema_is_footnote_like_block
from retainpdf_pipeline.render.semantics.item_view import is_plain_bodylike_block
from retainpdf_pipeline.render.semantics.item_view import is_plain_text_block
from retainpdf_pipeline.render.semantics.item_view import is_textual_block
from retainpdf_pipeline.render.semantics.item_view import is_title_like_block as schema_is_title_like_block
from retainpdf_pipeline.render.semantics.item_view import layout_role
from retainpdf_pipeline.render.semantics.item_view import semantic_role
from retainpdf_pipeline.render.layout.typography.measurement import bbox_width
from retainpdf_pipeline.render.layout.typography.measurement import formula_ratio
from retainpdf_pipeline.render.layout.typography.measurement import source_visual_line_count


BODY_FORMULA_RATIO_MAX = 0.5


def is_caption_like_block(item: dict) -> bool:
    return schema_is_caption_like_block(item)


def is_footnote_like_block(item: dict) -> bool:
    return schema_is_footnote_like_block(item)


def item_layout_role_name(item: dict) -> str:
    return layout_role(item)


def item_semantic_role_name(item: dict) -> str:
    return semantic_role(item)


def is_local_textual_item(item: dict) -> bool:
    if is_caption_like_block(item) or is_footnote_like_block(item):
        return True
    if schema_is_title_like_block(item):
        return True
    if block_kind(item) == "text":
        return True
    return is_textual_block(item)


def is_body_text_candidate(item: dict, page_text_width_med: float) -> bool:
    if is_caption_like_block(item) or is_footnote_like_block(item):
        return False
    layout_role = item_layout_role_name(item)
    semantic_role = item_semantic_role_name(item)
    if not is_plain_text_block(item):
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
            is_plain_bodylike_block(item)
            and text_len >= 36
            and source_visual_line_count(item) >= 2
        ):
            return False
    return text_len >= 40


def is_default_text_block(item: dict) -> bool:
    if schema_is_title_like_block(item):
        return True
    if not is_plain_text_block(item):
        return False
    line_count = len(item.get("lines", []))
    text_len = len(re.sub(r"\s+", "", item.get("source_text", "")))
    return line_count <= 1 and text_len < 60


def is_title_like_block(item: dict) -> bool:
    return schema_is_title_like_block(item)


def resolve_font_weight(item: dict) -> str:
    return "bold" if is_title_like_block(item) else "regular"


__all__ = [
    "BODY_FORMULA_RATIO_MAX",
    "is_body_text_candidate",
    "is_caption_like_block",
    "is_default_text_block",
    "is_footnote_like_block",
    "is_local_textual_item",
    "is_title_like_block",
    "item_layout_role_name",
    "item_semantic_role_name",
    "resolve_font_weight",
]
