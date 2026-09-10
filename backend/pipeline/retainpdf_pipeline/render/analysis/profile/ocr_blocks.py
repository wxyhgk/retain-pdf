from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class OcrBlockProfile:
    block_count: int
    valid_bbox_count: int
    total_bbox_area: float
    page_area_ratio: float


def _bbox_area(bbox: list[float]) -> float:
    if len(bbox) != 4:
        return 0.0
    return max(0.0, float(bbox[2]) - float(bbox[0])) * max(0.0, float(bbox[3]) - float(bbox[1]))


def build_ocr_block_profile(
    ocr_items: list[dict] | None,
    *,
    page_width: float,
    page_height: float,
) -> OcrBlockProfile:
    items = ocr_items or []
    areas = [_bbox_area(item.get("bbox", [])) for item in items]
    valid_areas = [area for area in areas if area > 0.0]
    page_area = max(1.0, page_width * page_height)
    total_area = sum(valid_areas)
    return OcrBlockProfile(
        block_count=len(items),
        valid_bbox_count=len(valid_areas),
        total_bbox_area=total_area,
        page_area_ratio=total_area / page_area,
    )
