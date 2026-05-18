from __future__ import annotations

from statistics import median

from services.document_schema.semantics import is_bodylike_block
from services.rendering.layout.font_roles import is_title_like_block
from services.rendering.layout.payload.render_item import get_render_inner_bbox
from services.rendering.layout.typography.geometry import inner_bbox
from services.translation.item_reader import item_block_kind


BODY_TIGHT_GAP_MAX_INSET_RATIO = 0.03
BODY_TIGHT_GAP_MIN_INSET_PT = 0.35
BODY_TIGHT_GAP_MIN_TARGET_PT = 1.2
BODY_TIGHT_GAP_MAX_TARGET_PT = 4.0
TITLE_BODY_LEFT_TOLERANCE_PT = 18.0
TITLE_BODY_WIDTH_MAX_SCALE = 1.18
SHORT_BODY_REGION_MIN_ANCHORS = 2
SHORT_BODY_REGION_X_TOLERANCE_PAGE_RATIO = 0.10
SHORT_BODY_REGION_MAX_HEIGHT_RATIO = 0.72
SHORT_BODY_REGION_MAX_WIDTH_RATIO = 0.78
SHORT_BODY_REGION_TOP_EXPAND_RATIO = 0.05
SHORT_BODY_REGION_RIGHT_EXPAND_RATIO = 0.30
SHORT_BODY_REGION_MIN_GAP_PT = 1.0


def build_effective_inner_bboxes(
    translated_items: list[dict],
    *,
    body_flags: dict[int, bool],
    page_width: float | None,
) -> dict[int, list[float]]:
    effective = {
        index: list(cached_inner if cached_inner is not None else inner)
        for index, item in enumerate(translated_items)
        if len(inner := inner_bbox(item)) == 4
        if (cached_inner := _cached_render_inner_bbox(item)) is None or len(cached_inner) == 4
    }
    if not effective:
        return effective

    locked_indices = {
        index
        for index, item in enumerate(translated_items)
        if _cached_render_inner_bbox(item) is not None
    }
    _apply_body_tight_gap_inset(effective, body_flags=body_flags, page_width=page_width, locked_indices=locked_indices)
    _apply_short_body_region_expansion(
        effective,
        translated_items,
        body_flags=body_flags,
        page_width=page_width,
        locked_indices=locked_indices,
    )
    _apply_title_body_width_alignment(
        effective,
        translated_items,
        body_flags=body_flags,
        page_width=page_width,
        locked_indices=locked_indices,
    )
    return effective


def _cached_render_inner_bbox(item: dict) -> list[float] | None:
    return get_render_inner_bbox(item)


def _apply_body_tight_gap_inset(
    effective: dict[int, list[float]],
    *,
    body_flags: dict[int, bool],
    page_width: float | None,
    locked_indices: set[int],
) -> None:
    body_indices = [index for index in effective if body_flags.get(index)]
    if len(body_indices) < 2:
        return

    heights = [max(0.0, effective[index][3] - effective[index][1]) for index in body_indices]
    median_height = median([height for height in heights if height > 0.0] or [0.0])
    if median_height <= 0:
        return
    target_gap = min(BODY_TIGHT_GAP_MAX_TARGET_PT, max(BODY_TIGHT_GAP_MIN_TARGET_PT, median_height * 0.08))

    ordered = sorted(body_indices, key=lambda index: (effective[index][1], effective[index][0]))
    for position, current_index in enumerate(ordered):
        if current_index in locked_indices:
            continue
        current = effective[current_index]
        nxt = _next_same_column_box(current, ordered[position + 1 :], effective, page_width=page_width)
        if nxt is None:
            continue
        gap = nxt[1] - current[3]
        if gap <= -target_gap or gap >= target_gap:
            continue

        tightness = min(1.0, (target_gap - gap) / max(target_gap, 0.01))
        current_height = max(0.0, current[3] - current[1])
        if current_height <= 0:
            continue
        total_inset = current_height * BODY_TIGHT_GAP_MAX_INSET_RATIO * tightness
        if total_inset < BODY_TIGHT_GAP_MIN_INSET_PT:
            continue
        inset_each_side = min(current_height * 0.08, total_inset / 2.0)
        if inset_each_side > 0.0 and current_height - inset_each_side * 2.0 >= 8.0:
            current[1] = round(current[1] + inset_each_side, 3)
            current[3] = round(current[3] - inset_each_side, 3)


def _apply_short_body_region_expansion(
    effective: dict[int, list[float]],
    translated_items: list[dict],
    *,
    body_flags: dict[int, bool],
    page_width: float | None,
    locked_indices: set[int],
) -> None:
    anchor_indices = [index for index in effective if body_flags.get(index)]
    candidate_indices = [
        index
        for index in effective
        if body_flags.get(index) or _is_body_region_text_item(translated_items[index])
    ]
    if len(anchor_indices) < SHORT_BODY_REGION_MIN_ANCHORS or len(candidate_indices) < SHORT_BODY_REGION_MIN_ANCHORS + 1:
        return

    body_boxes = [effective[index] for index in anchor_indices]
    heights = [max(0.0, box[3] - box[1]) for box in body_boxes]
    widths = [max(0.0, box[2] - box[0]) for box in body_boxes]
    median_height = median([height for height in heights if height > 0.0] or [0.0])
    median_width = median([width for width in widths if width > 0.0] or [0.0])
    if median_height <= 0.0 or median_width <= 0.0:
        return

    ordered = sorted(candidate_indices, key=lambda index: (effective[index][1], effective[index][0]))
    anchor_set = set(anchor_indices)
    for position, current_index in enumerate(ordered):
        if current_index in locked_indices:
            continue
        if current_index in anchor_set:
            continue
        current = effective[current_index]
        current_height = max(0.0, current[3] - current[1])
        current_width = max(0.0, current[2] - current[0])
        if current_height <= 0.0 or current_width <= 0.0:
            continue
        if current_height > median_height * SHORT_BODY_REGION_MAX_HEIGHT_RATIO:
            continue
        if current_width > median_width * SHORT_BODY_REGION_MAX_WIDTH_RATIO:
            continue

        anchors = _previous_region_anchors(
            current,
            [index for index in ordered[:position] if index in anchor_set],
            effective,
            page_width=page_width,
        )
        if len(anchors) < SHORT_BODY_REGION_MIN_ANCHORS:
            continue

        previous_bottom = max(anchor[3] for anchor in anchors if anchor[3] <= current[1])
        max_up = max(0.0, current[1] - previous_bottom - SHORT_BODY_REGION_MIN_GAP_PT)
        top_expand = min(current_height * SHORT_BODY_REGION_TOP_EXPAND_RATIO, max_up)
        if top_expand > 0.0:
            current[1] = round(current[1] - top_expand, 3)

        anchor_right = max(anchor[2] for anchor in anchors)
        page_right = (page_width - 4.0) if page_width and page_width > 0 else anchor_right
        target_right = min(anchor_right, page_right, current[2] + current_width * SHORT_BODY_REGION_RIGHT_EXPAND_RATIO)
        if target_right > current[2] + 0.5:
            current[2] = round(target_right, 3)


def _previous_region_anchors(
    current: list[float],
    previous_indices: list[int],
    effective: dict[int, list[float]],
    *,
    page_width: float | None,
) -> list[list[float]]:
    x_tolerance = max(18.0, (page_width or 0.0) * SHORT_BODY_REGION_X_TOLERANCE_PAGE_RATIO)
    anchors: list[list[float]] = []
    for index in reversed(previous_indices):
        candidate = effective[index]
        if candidate[3] > current[1]:
            continue
        if abs(candidate[0] - current[0]) > x_tolerance:
            continue
        if candidate[2] <= current[2]:
            continue
        if not _same_text_column(candidate, current, page_width=page_width):
            continue
        anchors.append(candidate)
        if len(anchors) >= SHORT_BODY_REGION_MIN_ANCHORS:
            break
    return anchors


def _is_body_region_text_item(item: dict) -> bool:
    if is_title_like_block(item):
        return False
    block_kind = item_block_kind(item)
    if block_kind != "text" and not is_bodylike_block(item):
        return False
    layout_role = str(item.get("layout_role", "") or "").strip().lower()
    semantic_role = str(item.get("semantic_role", "") or "").strip().lower()
    return layout_role in {"", "paragraph", "list_item"} and semantic_role in {"", "body", "abstract"}


def _next_same_column_box(
    current: list[float],
    later_indices: list[int],
    effective: dict[int, list[float]],
    *,
    page_width: float | None,
) -> list[float] | None:
    for index in later_indices:
        candidate = effective[index]
        if _same_text_column(current, candidate, page_width=page_width):
            return candidate
    return None


def _apply_title_body_width_alignment(
    effective: dict[int, list[float]],
    translated_items: list[dict],
    *,
    body_flags: dict[int, bool],
    page_width: float | None,
    locked_indices: set[int],
) -> None:
    body_boxes = [effective[index] for index in effective if body_flags.get(index)]
    if not body_boxes:
        return

    for index, item in enumerate(translated_items):
        if index not in effective or not is_title_like_block(item):
            continue
        if index in locked_indices:
            continue
        title = effective[index]
        title_width = max(0.0, title[2] - title[0])
        if title_width <= 0.0:
            continue
        candidates = [
            body
            for body in body_boxes
            if body[1] >= title[1]
            and abs(body[0] - title[0]) <= TITLE_BODY_LEFT_TOLERANCE_PT
            and body[2] > title[2]
        ]
        if not candidates:
            continue
        target_right = max(body[2] for body in candidates)
        if page_width and page_width > 0:
            target_right = min(target_right, page_width - 4.0)
        max_right = title[0] + title_width * TITLE_BODY_WIDTH_MAX_SCALE
        title[2] = round(max(title[2], min(target_right, max_right)), 3)


def _same_text_column(first: list[float], second: list[float], *, page_width: float | None) -> bool:
    first_width = max(1.0, first[2] - first[0])
    second_width = max(1.0, second[2] - second[0])
    overlap = max(0.0, min(first[2], second[2]) - max(first[0], second[0]))
    if overlap >= min(first_width, second_width) * 0.55:
        return True
    tolerance = max(18.0, (page_width or 0.0) * 0.035)
    return abs(first[0] - second[0]) <= tolerance


__all__ = ["build_effective_inner_bboxes"]
