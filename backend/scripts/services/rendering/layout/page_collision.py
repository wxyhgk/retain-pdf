from __future__ import annotations

from services.rendering.layout.chinese_body_fit import estimate_chinese_body_height_pt
from services.rendering.layout.model.models import RenderLayoutBlock


VERTICAL_COLLISION_GAP_PT = 0.9
VERTICAL_COLLISION_MIN_WIDTH_OVERLAP_RATIO = 0.6
VERTICAL_COLLISION_SOURCE_GAP_TRIGGER_PT = 3.0
VERTICAL_COLLISION_TRIGGER_RATIO = 0.98
VERTICAL_COLLISION_TIGHT_SOURCE_GAP_PT = 0.5
VERTICAL_COLLISION_SAFETY_PAD_PT = 2.0
VERTICAL_COLLISION_HEIGHT_USAGE_TRIGGER_RATIO = 0.94
VERTICAL_COLLISION_TIGHT_FIT_PAD_PT = 3.4
VERTICAL_COLLISION_FORMULA_FIT_PAD_PT = 7.4


def _estimated_markdown_height(markdown_text: str, content_rect: list[float], *, font_size_pt: float, leading_em: float) -> float:
    if len(content_rect) != 4 or font_size_pt <= 0:
        return 0.0
    return estimate_chinese_body_height_pt(
        max(1.0, content_rect[2] - content_rect[0]),
        markdown_text,
        [],
        font_size_pt,
        leading_em,
    ).estimated_height_pt


def _horizontal_overlap_ratio(current: RenderLayoutBlock, nxt: RenderLayoutBlock) -> float:
    current_left, _current_top, current_right, _current_bottom = current.content_rect
    next_left, _next_top, next_right, _next_bottom = nxt.content_rect
    overlap_width = max(0.0, min(current_right, next_right) - max(current_left, next_left))
    min_width = max(1.0, min(current_right - current_left, next_right - next_left))
    current_cover_left, _current_cover_top, current_cover_right, _current_cover_bottom = current.background_rect
    next_cover_left, _next_cover_top, next_cover_right, _next_cover_bottom = nxt.background_rect
    cover_overlap_width = max(0.0, min(current_cover_right, next_cover_right) - max(current_cover_left, next_cover_left))
    cover_min_width = max(1.0, min(current_cover_right - current_cover_left, next_cover_right - next_cover_left))
    return max(overlap_width / min_width, cover_overlap_width / cover_min_width)


def _collision_safety_pad_pt(block: RenderLayoutBlock, *, tight_source_gap: bool) -> float:
    safety_pad_pt = max(VERTICAL_COLLISION_SAFETY_PAD_PT, min(block.font_size_pt * 0.6, 6.0))
    if not tight_source_gap:
        return safety_pad_pt
    safety_pad_pt = max(safety_pad_pt, VERTICAL_COLLISION_TIGHT_FIT_PAD_PT)
    if block.math_map or "$" in block.content_text:
        safety_pad_pt = max(safety_pad_pt, VERTICAL_COLLISION_FORMULA_FIT_PAD_PT)
    return safety_pad_pt


def mark_adjacent_collision_risk(blocks: list[RenderLayoutBlock]) -> None:
    ordered = sorted(blocks, key=lambda block: (block.content_rect[1], block.content_rect[0]))
    for current, nxt in zip(ordered, ordered[1:]):
        current_top = current.content_rect[1]
        current_bottom = current.content_rect[3]
        next_top = nxt.content_rect[1]
        current_cover_bottom = current.background_rect[3]
        next_cover_top = nxt.background_rect[1]
        if _horizontal_overlap_ratio(current, nxt) < VERTICAL_COLLISION_MIN_WIDTH_OVERLAP_RATIO:
            continue

        source_gap = next_cover_top - current_cover_bottom
        if source_gap > VERTICAL_COLLISION_SOURCE_GAP_TRIGGER_PT:
            continue

        max_height_pt = next_top - current_top - VERTICAL_COLLISION_GAP_PT
        if max_height_pt <= 0:
            continue

        estimated_height = _estimated_markdown_height(
            current.content_text,
            current.content_rect,
            font_size_pt=current.font_size_pt,
            leading_em=current.leading_em,
        )
        current_height_pt = max(1.0, current_bottom - current_top)
        tight_source_gap = source_gap <= VERTICAL_COLLISION_TIGHT_SOURCE_GAP_PT
        height_usage_ratio = current_height_pt / max(1.0, max_height_pt)
        if (
            not tight_source_gap
            and estimated_height <= max_height_pt * VERTICAL_COLLISION_TRIGGER_RATIO
            and not (current.fit_to_box and height_usage_ratio >= VERTICAL_COLLISION_HEIGHT_USAGE_TRIGGER_RATIO)
        ):
            continue

        tightened_height_pt = min(
            max_height_pt,
            max(8.0, current_height_pt - _collision_safety_pad_pt(current, tight_source_gap=tight_source_gap)),
        )

        current.fit_to_box = True
        current.fit_min_font_size_pt = min(current.fit_min_font_size_pt or current.font_size_pt, max(7.8, current.font_size_pt - 1.1))
        current.fit_min_leading_em = min(current.fit_min_leading_em or current.leading_em, max(0.44, current.leading_em - 0.12))
        current.fit_max_height_pt = min(
            max(8.0, current.fit_max_height_pt or tightened_height_pt),
            tightened_height_pt,
        )
        current.skip_reason = "adjacent_collision_risk"


__all__ = [
    "mark_adjacent_collision_risk",
]
