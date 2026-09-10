from __future__ import annotations

from dataclasses import dataclass


VisualColor = tuple[float, float, float]

VISUAL_PROFILE_ALGORITHM_VERSION = "visual_profile_v6_document_title_pixels_only"
SUPPORTED_VISUAL_PROFILE_ALGORITHMS = frozenset(
    {
        "visual_profile_v1",
        VISUAL_PROFILE_ALGORITHM_VERSION,
    }
)


@dataclass(frozen=True)
class ItemVisualProfile:
    item_id: str
    page_index: int
    bbox: tuple[float, float, float, float]
    bbox_space: str
    bbox_source: str
    source_item_kind: str
    background_rgb: VisualColor
    text_rgb: VisualColor
    confidence: float
    method: str
    warnings: tuple[str, ...] = ()


@dataclass(frozen=True)
class PageVisualProfile:
    page_index: int
    background_rgb: VisualColor
    items: dict[str, ItemVisualProfile]
    warnings: tuple[str, ...] = ()


@dataclass(frozen=True)
class DocumentVisualProfile:
    algorithm: str
    pages: dict[int, PageVisualProfile]


def clamp_color(value: object, *, default: VisualColor = (1.0, 1.0, 1.0)) -> VisualColor:
    if not isinstance(value, (list, tuple)) or len(value) < 3:
        return default
    try:
        components = tuple(float(value[idx]) for idx in range(3))
    except (TypeError, ValueError):
        return default
    return tuple(max(0.0, min(1.0, component)) for component in components)  # type: ignore[return-value]


def clamp_confidence(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def clamp_bbox(value: object) -> tuple[float, float, float, float]:
    if not isinstance(value, (list, tuple)) or len(value) < 4:
        return (0.0, 0.0, 0.0, 0.0)
    try:
        return tuple(float(value[idx]) for idx in range(4))  # type: ignore[return-value]
    except (TypeError, ValueError):
        return (0.0, 0.0, 0.0, 0.0)
