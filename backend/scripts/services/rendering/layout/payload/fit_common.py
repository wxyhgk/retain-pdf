from __future__ import annotations

from services.rendering.layout.typography.geometry import inner_bbox

VERTICAL_COLLISION_GAP_PT = 0.9
LAYOUT_DENSITY_SAFE_MAX = 0.89
LAYOUT_DENSITY_SAFE_MIN = 0.62
AGGRESSIVE_DEMAND_RATIO = 1.16
AGGRESSIVE_LAYOUT_DENSITY_MARGIN = 0.12
TYPST_BINARY_OVERFLOW_TRIGGER = 1.08
TYPST_BINARY_DEMAND_TRIGGER = 1.10
TYPST_BINARY_DENSE_LAYOUT_TRIGGER = 0.92
TYPST_BINARY_FORMULA_RATIO_TRIGGER = 0.08
TYPST_BINARY_FORMULA_OVERFLOW_TRIGGER = 1.04
TYPST_BINARY_COLLISION_OVERFLOW_TRIGGER = 1.02
TYPST_BINARY_SOURCE_HEIGHT_TRIGGER = 1.01


def fit_inner_bbox(item: dict) -> list[float]:
    bbox = item.get("_render_inner_bbox")
    if isinstance(bbox, list) and len(bbox) == 4:
        return bbox
    return inner_bbox(item)
