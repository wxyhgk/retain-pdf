from __future__ import annotations

from retainpdf_pipeline.render.semantics.item_view import block_kind
from retainpdf_pipeline.render.semantics.item_view import is_bodylike_block
from retainpdf_pipeline.render.semantics.item_view import is_caption_like_block
from retainpdf_pipeline.render.semantics.item_view import is_footnote_like_block
from retainpdf_pipeline.render.semantics.item_view import is_title_like_block


COVER_EXPAND_BODY_RATIO = 0.01
COVER_EXPAND_OTHER_RATIO = 0.006
COVER_EXPAND_TITLE_RATIO = 0.004
COVER_EXPAND_MIN_PT = 1.0
COVER_EXPAND_BODY_MAX_PT = 3.0
COVER_EXPAND_OTHER_MAX_PT = 2.0
COVER_EXPAND_TITLE_MAX_PT = 1.5
COVER_FORMULA_NEARBY_Y_SCALE = 0.35
COVER_FORMULA_NEARBY_X_SCALE = 0.75


def expanded_cover_bbox(item: dict, bbox: list[float]) -> list[float]:
    if len(bbox) != 4:
        return bbox
    x0, y0, x1, y1 = (float(value) for value in bbox)
    width = max(0.0, x1 - x0)
    height = max(0.0, y1 - y0)
    if width <= 0 or height <= 0:
        return bbox

    ratio, max_expand = _expand_policy(item)
    expand_x = min(max_expand, max(COVER_EXPAND_MIN_PT, width * ratio))
    expand_y = min(max_expand, max(COVER_EXPAND_MIN_PT, height * ratio))
    if _has_formula_pressure(item):
        expand_x *= COVER_FORMULA_NEARBY_X_SCALE
        expand_y *= COVER_FORMULA_NEARBY_Y_SCALE
    return [
        round(x0 - expand_x, 3),
        round(y0 - expand_y, 3),
        round(x1 + expand_x, 3),
        round(y1 + expand_y, 3),
    ]


def _expand_policy(item: dict) -> tuple[float, float]:
    if is_title_like_block(item):
        return COVER_EXPAND_TITLE_RATIO, COVER_EXPAND_TITLE_MAX_PT
    if is_caption_like_block(item) or is_footnote_like_block(item):
        return COVER_EXPAND_OTHER_RATIO, COVER_EXPAND_OTHER_MAX_PT
    if block_kind(item) == "text" and (
        bool(item.get("_is_body_text_candidate"))
        or is_bodylike_block(item)
        or str(item.get("layout_role") or "").lower() == "paragraph"
    ):
        return COVER_EXPAND_BODY_RATIO, COVER_EXPAND_BODY_MAX_PT
    return COVER_EXPAND_OTHER_RATIO, COVER_EXPAND_OTHER_MAX_PT


def _has_formula_pressure(item: dict) -> bool:
    if block_kind(item) == "formula":
        return True
    formula_maps = (
        item.get("formula_map"),
        item.get("render_formula_map"),
        item.get("translation_unit_formula_map"),
        item.get("group_formula_map"),
    )
    if any(bool(value) for value in formula_maps):
        return True
    text = " ".join(
        str(item.get(key) or "")
        for key in (
            "source_text",
            "protected_source_text",
            "protected_translated_text",
            "translated_text",
        )
    )
    return "$" in text or "\\frac" in text or "\\sqrt" in text


__all__ = ["expanded_cover_bbox"]
