from __future__ import annotations

from services.rendering.core.models import RenderLayoutBlock


TITLE_FIT_GAP_PT = 2.0
TITLE_FIT_HORIZONTAL_OVERLAP_RATIO = 0.35
TITLE_FIT_VERTICAL_OVERLAP_RATIO = 0.35
TITLE_FIT_WIDTH_EXPAND_RATIO = 0.42
TITLE_FIT_MAX_WIDTH_EXPAND_RATIO = 0.05
TITLE_FIT_DOWNWARD_EXPAND_RATIO = 0.05
TITLE_FIT_MAX_TOTAL_HEIGHT_EXPAND_RATIO = 0.05
TITLE_FIT_UPWARD_HEIGHT_RATIO_MIN = 0.02
TITLE_FIT_UPWARD_HEIGHT_RATIO_MAX = 0.05


def _overlap_ratio(start_a: float, end_a: float, start_b: float, end_b: float) -> float:
    overlap = max(0.0, min(end_a, end_b) - max(start_a, start_b))
    min_span = max(1.0, min(end_a - start_a, end_b - start_b))
    return overlap / min_span


def _resolve_fit_budget(
    rect: list[float],
    sibling_rects: list[list[float]],
    *,
    page_width: float | None,
    page_height: float | None,
) -> tuple[float, float, float]:
    if len(rect) != 4:
        return 0.0, 0.0, 0.0
    x0, y0, x1, y1 = rect
    width = max(8.0, x1 - x0)
    height = max(8.0, y1 - y0)
    top_bound = 0.0
    right_bound = max(x1, page_width or x1)
    bottom_bound = max(y1, page_height or y1)

    for sibling in sibling_rects:
        if len(sibling) != 4:
            continue
        sx0, sy0, sx1, sy1 = sibling
        if _overlap_ratio(x0, x1, sx0, sx1) >= TITLE_FIT_HORIZONTAL_OVERLAP_RATIO and sy1 <= y0:
            top_bound = max(top_bound, min(y0, sy1 + TITLE_FIT_GAP_PT))
        if _overlap_ratio(y0, y1, sy0, sy1) >= TITLE_FIT_VERTICAL_OVERLAP_RATIO and sx0 >= x1:
            right_bound = min(right_bound, max(x1, sx0 - TITLE_FIT_GAP_PT))
        if _overlap_ratio(x0, x1, sx0, sx1) >= TITLE_FIT_HORIZONTAL_OVERLAP_RATIO and sy0 >= y1:
            bottom_bound = min(bottom_bound, max(y1, sy0 - TITLE_FIT_GAP_PT))

    max_width = max(width, right_bound - x0)
    upward_room = max(0.0, y0 - top_bound)
    downward_room = max(0.0, bottom_bound - y1)
    upward_target = min(upward_room, height * TITLE_FIT_UPWARD_HEIGHT_RATIO_MAX)
    upward_floor = min(upward_room, height * TITLE_FIT_UPWARD_HEIGHT_RATIO_MIN)
    upward_shift = max(upward_floor, upward_target) if upward_room > 0 else 0.0
    downward_expand = downward_room * TITLE_FIT_DOWNWARD_EXPAND_RATIO
    max_width_expand = width * TITLE_FIT_MAX_WIDTH_EXPAND_RATIO
    width_expand = min(max_width_expand, (max_width - width) * TITLE_FIT_WIDTH_EXPAND_RATIO)
    max_total_height_expand = height * TITLE_FIT_MAX_TOTAL_HEIGHT_EXPAND_RATIO
    upward_shift = min(upward_shift, max_total_height_expand)
    downward_expand = min(max(0.0, max_total_height_expand - upward_shift), downward_expand)
    target_width = width + width_expand
    target_height = height + upward_shift + downward_expand
    return max(width, target_width), max(height, target_height), max(0.0, upward_shift)


def apply_title_fit_budget_to_render_blocks(
    blocks: list[RenderLayoutBlock],
    *,
    page_width: float | None,
    page_height: float | None,
) -> None:
    sibling_rects = [list(block.content_rect) for block in blocks]
    for index, block in enumerate(blocks):
        if not block.fit_single_line or block.content_kind != "markdown":
            continue
        width_pt, height_pt, shift_up_pt = _resolve_fit_budget(
            list(block.content_rect),
            sibling_rects[:index] + sibling_rects[index + 1 :],
            page_width=page_width,
            page_height=page_height,
        )
        block.fit_target_width_pt = round(width_pt, 2)
        block.fit_target_height_pt = round(height_pt, 2)
        block.fit_shift_up_pt = round(shift_up_pt, 2)
