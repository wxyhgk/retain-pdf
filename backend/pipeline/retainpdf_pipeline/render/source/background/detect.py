from __future__ import annotations

import fitz

from retainpdf_pipeline.render.source.rects import rect_area


TILED_BACKGROUND_IMAGE_MIN_COUNT = 8
TILED_BACKGROUND_IMAGE_COVERAGE_RATIO = 0.65
TILED_BACKGROUND_IMAGE_MIN_WIDTH_RATIO = 0.60


def _page_image_infos(page: fitz.Page, *, xrefs: bool = False) -> list[dict]:
    try:
        return list(page.get_image_info(hashes=False, xrefs=xrefs))
    except Exception:
        return []


def page_has_large_background_image(
    page: fitz.Page,
    *,
    coverage_ratio_threshold: float = 0.75,
) -> bool:
    if _page_has_primary_background_image(page, coverage_ratio_threshold=coverage_ratio_threshold):
        return True
    return page_has_tiled_background_images(page)


def _page_has_primary_background_image(
    page: fitz.Page,
    *,
    coverage_ratio_threshold: float,
) -> bool:
    return pick_primary_background_image(page, coverage_ratio_threshold=coverage_ratio_threshold) is not None


def pick_primary_background_image(
    page: fitz.Page,
    *,
    coverage_ratio_threshold: float = 0.75,
) -> tuple[int, fitz.Rect] | None:
    page_area = max(rect_area(page.rect), 1.0)
    best: tuple[float, int, fitz.Rect] | None = None

    for info in _page_image_infos(page, xrefs=True):
        try:
            xref = int(info.get("xref") or 0)
            rect = fitz.Rect(info.get("bbox"))
        except Exception:
            continue
        if xref <= 0 or rect.is_empty:
            continue
        coverage_ratio = rect_area(rect & page.rect) / page_area
        if coverage_ratio < coverage_ratio_threshold:
            continue
        candidate = (coverage_ratio, xref, rect)
        if best is None or candidate[0] > best[0]:
            best = candidate
    if best is None:
        best = _pick_primary_background_image_from_xref_rects(
            page,
            coverage_ratio_threshold=coverage_ratio_threshold,
        )
    if best is None:
        return None
    return best[1], best[2]


def _pick_primary_background_image_from_xref_rects(
    page: fitz.Page,
    *,
    coverage_ratio_threshold: float,
) -> tuple[float, int, fitz.Rect] | None:
    page_area = max(rect_area(page.rect), 1.0)
    best: tuple[float, int, fitz.Rect] | None = None
    try:
        image_entries = list(page.get_images(full=True))
    except Exception:
        return None

    for entry in image_entries:
        try:
            xref = int(entry[0])
        except Exception:
            continue
        if xref <= 0:
            continue
        try:
            rects = list(page.get_image_rects(xref))
        except Exception:
            rects = []
        for rect in rects:
            rect = fitz.Rect(rect)
            if rect.is_empty:
                continue
            coverage_ratio = rect_area(rect & page.rect) / page_area
            if coverage_ratio < coverage_ratio_threshold:
                continue
            candidate = (coverage_ratio, xref, rect)
            if best is None or candidate[0] > best[0]:
                best = candidate
    return best


def page_has_tiled_background_images(
    page: fitz.Page,
    *,
    coverage_ratio_threshold: float = TILED_BACKGROUND_IMAGE_COVERAGE_RATIO,
    min_image_count: int = TILED_BACKGROUND_IMAGE_MIN_COUNT,
    min_width_ratio: float = TILED_BACKGROUND_IMAGE_MIN_WIDTH_RATIO,
) -> bool:
    page_area = max(rect_area(page.rect), 1.0)
    page_width = max(float(page.rect.width), 1.0)
    image_rects = _image_rects(page)
    if len(image_rects) < min_image_count:
        return False

    page_wide_rects = [
        rect
        for rect in image_rects
        if (rect & page.rect).width / page_width >= min_width_ratio
    ]
    if len(page_wide_rects) < min_image_count:
        return False

    merged = _merge_vertical_image_bands(page_wide_rects)
    covered_area = sum(rect_area(rect & page.rect) for rect in merged)
    return covered_area / page_area >= coverage_ratio_threshold


def _image_rects(page: fitz.Page) -> list[fitz.Rect]:
    rects: list[fitz.Rect] = []
    for info in _page_image_infos(page):
        try:
            rect = fitz.Rect(info.get("bbox"))
        except Exception:
            continue
        inter = rect & page.rect
        if not inter.is_empty:
            rects.append(inter)
    return rects


def _merge_vertical_image_bands(rects: list[fitz.Rect], *, y_tolerance: float = 1.0) -> list[fitz.Rect]:
    merged: list[fitz.Rect] = []
    for rect in sorted(rects, key=lambda r: (round(r.y0, 3), round(r.x0, 3))):
        if not merged:
            merged.append(fitz.Rect(rect))
            continue
        previous = merged[-1]
        if rect.y0 <= previous.y1 + y_tolerance:
            previous.include_rect(rect)
        else:
            merged.append(fitz.Rect(rect))
    return merged


__all__ = [
    "page_has_large_background_image",
    "page_has_tiled_background_images",
    "pick_primary_background_image",
]
