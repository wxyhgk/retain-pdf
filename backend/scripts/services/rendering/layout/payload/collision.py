from __future__ import annotations

from services.rendering.layout.payload.metrics import estimated_render_height_pt
from services.rendering.layout.payload.metrics import VERTICAL_COLLISION_GAP_PT


VERTICAL_COLLISION_MIN_WIDTH_OVERLAP_RATIO = 0.6
VERTICAL_COLLISION_SOURCE_GAP_TRIGGER_PT = 3.0
VERTICAL_COLLISION_TRIGGER_RATIO = 0.98


def mark_adjacent_collision_risk(ordered_payloads: list[dict]) -> None:
    for current, nxt in zip(ordered_payloads, ordered_payloads[1:]):
        current_left, current_top, current_right, current_bottom = current["inner_bbox"]
        next_left, next_top, next_right, _ = nxt["inner_bbox"]
        overlap_width = max(0.0, min(current_right, next_right) - max(current_left, next_left))
        min_width = max(1.0, min(current_right - current_left, next_right - next_left))
        if overlap_width / min_width < VERTICAL_COLLISION_MIN_WIDTH_OVERLAP_RATIO:
            continue

        source_gap = next_top - current_bottom
        if source_gap > VERTICAL_COLLISION_SOURCE_GAP_TRIGGER_PT:
            continue

        max_height_pt = next_top - current_top - VERTICAL_COLLISION_GAP_PT
        if max_height_pt <= 0:
            continue

        estimated_height = estimated_render_height_pt(
            current["inner_bbox"],
            current["translated_text"],
            current["formula_map"],
            current["font_size_pt"],
            current["leading_em"],
        )
        if estimated_height <= max_height_pt * VERTICAL_COLLISION_TRIGGER_RATIO:
            continue

        current["adjacent_collision_risk"] = True
        previous_limit = current.get("adjacent_available_height_pt")
        if previous_limit is None or max_height_pt < previous_limit:
            current["adjacent_available_height_pt"] = max_height_pt
