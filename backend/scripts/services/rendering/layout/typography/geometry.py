from __future__ import annotations

from foundation.config import layout

from services.rendering.layout.typography.measurement import occupied_ratio
from services.rendering.layout.typography.measurement import occupied_ratio_x


def inner_bbox(item: dict) -> list[float]:
    bbox = item.get("bbox", [])
    if len(bbox) != 4:
        return bbox

    x0, y0, x1, y1 = bbox
    width = x1 - x0
    height = y1 - y0
    shrink_x = width * layout.INNER_BBOX_SHRINK_X
    shrink_y = height * layout.INNER_BBOX_SHRINK_Y

    rho_x = occupied_ratio_x(item)
    rho_y = occupied_ratio(item)
    if rho_x > 0.82:
        shrink_x = width * layout.INNER_BBOX_DENSE_SHRINK_X
    if rho_y > 0.82:
        shrink_y = height * layout.INNER_BBOX_DENSE_SHRINK_Y

    nx0 = x0 + shrink_x
    nx1 = x1 - shrink_x
    ny0 = y0 + shrink_y
    ny1 = y1 - shrink_y
    if nx1 - nx0 < width * 0.7:
        nx0, nx1 = x0 + width * 0.015, x1 - width * 0.015
    if ny1 - ny0 < height * 0.7:
        ny0, ny1 = y0 + height * 0.015, y1 - height * 0.015
    return [nx0, ny0, nx1, ny1]


def cover_bbox(item: dict) -> list[float]:
    bbox = item.get("bbox", [])
    if len(bbox) != 4:
        return bbox

    # Cover rects must erase the full OCR block area. Reusing the shrunken
    # inner bbox here causes English bleed-through in Typst background-book
    # mode because the original page image is still visible under the cover.
    if item.get("_cover_with_inner_bbox"):
        inner = inner_bbox(item)
        if len(inner) == 4:
            return inner
    return bbox
