from __future__ import annotations

from dataclasses import dataclass

from retainpdf_pipeline.render.layout.payload.metrics import VERTICAL_COLLISION_GAP_PT


VERTICAL_COLLISION_MIN_WIDTH_OVERLAP_RATIO = 0.6
VERTICAL_COLLISION_SOURCE_GAP_TRIGGER_PT = 3.0
VERTICAL_COLLISION_SAFETY_PAD_PT = 2.2
VERTICAL_COLLISION_TIGHT_SOURCE_GAP_PT = 0.8
VERTICAL_COLLISION_FORMULA_SAFETY_PAD_PT = 6.8


@dataclass(frozen=True)
class AdjacentCollisionContext:
    max_height_pt: float
    source_gap_pt: float


def collision_safety_pad_pt(payload: dict, source_gap: float) -> float:
    safety_pad = VERTICAL_COLLISION_SAFETY_PAD_PT
    if source_gap <= VERTICAL_COLLISION_TIGHT_SOURCE_GAP_PT:
        safety_pad = max(safety_pad, 3.4)
    if payload.get("formula_map") or "$" in str(payload.get("translated_text", "") or ""):
        safety_pad = max(safety_pad, VERTICAL_COLLISION_FORMULA_SAFETY_PAD_PT)
    return safety_pad


def adjacent_collision_context(current: dict, nxt: dict) -> AdjacentCollisionContext | None:
    current_left, current_top, current_right, current_bottom = current["inner_bbox"]
    next_left, next_top, next_right, _ = nxt["inner_bbox"]
    overlap_width = max(0.0, min(current_right, next_right) - max(current_left, next_left))
    min_width = max(1.0, min(current_right - current_left, next_right - next_left))
    if overlap_width / min_width < VERTICAL_COLLISION_MIN_WIDTH_OVERLAP_RATIO:
        return None

    source_gap = next_top - current_bottom
    if source_gap > VERTICAL_COLLISION_SOURCE_GAP_TRIGGER_PT:
        return None

    max_height_pt = next_top - current_top - VERTICAL_COLLISION_GAP_PT - collision_safety_pad_pt(current, source_gap)
    if max_height_pt <= 0:
        return None
    return AdjacentCollisionContext(max_height_pt=max_height_pt, source_gap_pt=source_gap)


def collision_fit_item(payload: dict) -> dict:
    return {
        **payload["item"],
        "_render_inner_bbox": payload["inner_bbox"],
        "_is_body_text_candidate": payload["is_body"],
        "_dense_small_box": payload["dense_small_box"],
        "_heavy_dense_small_box": payload["heavy_dense_small_box"],
        "_short_body_inherited_font_floor_pt": payload.get("_short_body_inherited_font_floor_pt", 0.0),
    }
