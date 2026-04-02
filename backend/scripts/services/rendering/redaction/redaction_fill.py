from __future__ import annotations

from dataclasses import dataclass

import fitz

from services.rendering.redaction.redaction_config import (
    COVER_COMPLEXITY_BRIGHTNESS_SPREAD,
    COVER_LIGHT_BG_MEDIAN_MIN,
    COVER_LIGHT_BG_P90_MIN,
    COVER_MIN_SAMPLE_PIXELS,
    COVER_SAMPLE_MARGIN_PT,
    COVER_SAMPLE_SCALE,
    COVER_TEXT_CONTAMINATION_DARK_RATIO,
    COVER_TEXT_CONTAMINATION_DARK_VALUE,
)
from services.rendering.redaction.redaction_geometry import rect_area


@dataclass
class PreparedBackgroundCover:
    rect: fitz.Rect
    pixmap: fitz.Pixmap | None = None
    fill: tuple[float, float, float] | None = None


def quantile(sorted_values: list[int], numerator: int, denominator: int) -> int:
    if not sorted_values:
        return 255
    index = int(round((len(sorted_values) - 1) * numerator / denominator))
    index = max(0, min(len(sorted_values) - 1, index))
    return sorted_values[index]


def _background_sample_outer_rect(page: fitz.Page, rect: fitz.Rect) -> fitz.Rect | None:
    page_rect = fitz.Rect(page.rect)
    outer = (
        fitz.Rect(
            rect.x0 - COVER_SAMPLE_MARGIN_PT,
            rect.y0 - COVER_SAMPLE_MARGIN_PT,
            rect.x1 + COVER_SAMPLE_MARGIN_PT,
            rect.y1 + COVER_SAMPLE_MARGIN_PT,
        )
        & page_rect
    )
    if outer.is_empty or outer.width <= 1 or outer.height <= 1:
        return None
    return outer


def _clip_pixmap(page: fitz.Page, clip: fitz.Rect) -> fitz.Pixmap | None:
    try:
        return page.get_pixmap(
            clip=clip,
            matrix=fitz.Matrix(COVER_SAMPLE_SCALE, COVER_SAMPLE_SCALE),
            colorspace=fitz.csRGB,
            alpha=False,
        )
    except Exception:
        return None


def _pixmap_rgb_pixels(pix: fitz.Pixmap) -> list[tuple[int, int, int]]:
    if pix.width <= 0 or pix.height <= 0 or pix.n < 3:
        return []
    samples = memoryview(pix.samples)
    stride = pix.n
    pixels: list[tuple[int, int, int]] = []
    for y in range(pix.height):
        row_offset = y * pix.width * stride
        for x in range(pix.width):
            offset = row_offset + x * stride
            pixels.append((samples[offset], samples[offset + 1], samples[offset + 2]))
    return pixels


def _brightness_spread(pixels: list[tuple[int, int, int]]) -> int:
    if not pixels:
        return 255
    brightness = sorted(int((r + g + b) / 3) for r, g, b in pixels)
    return quantile(brightness, 9, 10) - quantile(brightness, 1, 10)


def _looks_like_text_contaminated_light_patch(pixels: list[tuple[int, int, int]]) -> bool:
    if not pixels:
        return False
    brightness = sorted(int((r + g + b) / 3) for r, g, b in pixels)
    median = quantile(brightness, 1, 2)
    p90 = quantile(brightness, 9, 10)
    if median < COVER_LIGHT_BG_MEDIAN_MIN or p90 < COVER_LIGHT_BG_P90_MIN:
        return False
    dark_pixels = sum(1 for value in brightness if value < COVER_TEXT_CONTAMINATION_DARK_VALUE)
    dark_ratio = dark_pixels / max(len(brightness), 1)
    return dark_ratio >= COVER_TEXT_CONTAMINATION_DARK_RATIO


def _robust_fill_from_pixels(pixels: list[tuple[int, int, int]]) -> tuple[float, float, float] | None:
    if len(pixels) < COVER_MIN_SAMPLE_PIXELS:
        return None
    brightness_pixels = sorted(
        ((int((r + g + b) / 3), r, g, b) for r, g, b in pixels),
        key=lambda item: item[0],
    )
    keep_from = min(len(brightness_pixels) - 1, max(0, len(brightness_pixels) // 5))
    trimmed = brightness_pixels[keep_from:]
    if not trimmed:
        return None
    rs = sorted(item[1] for item in trimmed)
    gs = sorted(item[2] for item in trimmed)
    bs = sorted(item[3] for item in trimmed)
    return (
        quantile(rs, 1, 2) / 255.0,
        quantile(gs, 1, 2) / 255.0,
        quantile(bs, 1, 2) / 255.0,
    )


def sample_local_background_fill(page: fitz.Page, rect: fitz.Rect) -> tuple[float, float, float]:
    outer = _background_sample_outer_rect(page, rect)
    if outer is None:
        return (1, 1, 1)

    pix = _clip_pixmap(page, outer)
    if pix is None:
        return (1, 1, 1)

    if pix.width <= 0 or pix.height <= 0 or pix.n < 3:
        return (1, 1, 1)

    inner_x0 = (rect.x0 - outer.x0) / max(outer.width, 1e-6) * pix.width
    inner_y0 = (rect.y0 - outer.y0) / max(outer.height, 1e-6) * pix.height
    inner_x1 = (rect.x1 - outer.x0) / max(outer.width, 1e-6) * pix.width
    inner_y1 = (rect.y1 - outer.y0) / max(outer.height, 1e-6) * pix.height

    samples = memoryview(pix.samples)
    stride = pix.n
    pixels: list[tuple[int, int, int]] = []
    for y in range(pix.height):
        inside_y = inner_y0 <= y < inner_y1
        row_offset = y * pix.width * stride
        for x in range(pix.width):
            if inside_y and inner_x0 <= x < inner_x1:
                continue
            offset = row_offset + x * stride
            pixels.append((samples[offset], samples[offset + 1], samples[offset + 2]))

    robust_fill = _robust_fill_from_pixels(pixels)
    if len(pixels) < COVER_MIN_SAMPLE_PIXELS:
        return robust_fill or (1, 1, 1)

    spread = _brightness_spread(pixels)
    if spread > COVER_COMPLEXITY_BRIGHTNESS_SPREAD:
        return robust_fill or (1, 1, 1)

    rs = sorted(r for r, _g, _b in pixels)
    gs = sorted(g for _r, g, _b in pixels)
    bs = sorted(b for _r, _g, b in pixels)
    median_r = quantile(rs, 1, 2)
    median_g = quantile(gs, 1, 2)
    median_b = quantile(bs, 1, 2)
    return (median_r / 255.0, median_g / 255.0, median_b / 255.0)


def resolved_fill_color(
    page: fitz.Page,
    rect: fitz.Rect,
    fill: tuple[float, float, float] | None,
) -> tuple[float, float, float] | None:
    if fill is None:
        return None
    if fill != (1, 1, 1):
        return fill
    return sample_local_background_fill(page, rect)


def _patch_candidate_rects(page_rect: fitz.Rect, rect: fitz.Rect) -> list[fitz.Rect]:
    margin = max(COVER_SAMPLE_MARGIN_PT, min(18.0, max(4.0, min(rect.width, rect.height) * 0.35)))
    candidates = [
        fitz.Rect(rect.x0 - margin, rect.y0, rect.x0, rect.y1),
        fitz.Rect(rect.x1, rect.y0, rect.x1 + margin, rect.y1),
        fitz.Rect(rect.x0, rect.y0 - margin, rect.x1, rect.y0),
        fitz.Rect(rect.x0, rect.y1, rect.x1, rect.y1 + margin),
    ]
    valid: list[fitz.Rect] = []
    for candidate in candidates:
        clipped = candidate & page_rect
        if clipped.is_empty or clipped.width <= 1 or clipped.height <= 1:
            continue
        valid.append(clipped)
    return valid


def cover_rect_with_background_patch(page: fitz.Page, rect: fitz.Rect) -> bool:
    prepared = prepare_background_cover(page, rect)
    if prepared is None:
        return False
    apply_prepared_background_cover(page, prepared)
    return True


def prepare_background_cover(page: fitz.Page, rect: fitz.Rect) -> PreparedBackgroundCover | None:
    page_rect = fitz.Rect(page.rect)
    best_pixmap: fitz.Pixmap | None = None
    best_score: tuple[int, int, float] | None = None
    for candidate in _patch_candidate_rects(page_rect, rect):
        pix = _clip_pixmap(page, candidate)
        if pix is None:
            continue
        pixels = _pixmap_rgb_pixels(pix)
        if len(pixels) < COVER_MIN_SAMPLE_PIXELS:
            continue
        if _looks_like_text_contaminated_light_patch(pixels):
            continue
        spread = _brightness_spread(pixels)
        # Prefer low-complexity neighboring strips; large spreads usually mean
        # nearby text or figures and make stretched patches look worse.
        complexity_bucket = 0 if spread <= COVER_COMPLEXITY_BRIGHTNESS_SPREAD else 1
        score = (complexity_bucket, spread, -rect_area(candidate))
        if best_score is None or score < best_score:
            best_score = score
            best_pixmap = pix

    if best_pixmap is not None and best_score is not None and best_score[0] <= 0:
        return PreparedBackgroundCover(rect=fitz.Rect(rect), pixmap=best_pixmap)

    return PreparedBackgroundCover(
        rect=fitz.Rect(rect),
        fill=sample_local_background_fill(page, rect),
    )


def apply_prepared_background_cover(page: fitz.Page, cover: PreparedBackgroundCover) -> None:
    if cover.pixmap is not None:
        try:
            page.insert_image(cover.rect, pixmap=cover.pixmap, keep_proportion=False, overlay=True)
            return
        except Exception:
            pass

    fill = cover.fill or sample_local_background_fill(page, cover.rect)
    shape = page.new_shape()
    shape.draw_rect(cover.rect)
    shape.finish(color=None, fill=fill)
    shape.commit(overlay=True)


def prepare_background_covers(
    page: fitz.Page,
    rects: list[fitz.Rect],
) -> list[PreparedBackgroundCover]:
    covers: list[PreparedBackgroundCover] = []
    for rect in rects:
        prepared = prepare_background_cover(page, rect)
        if prepared is None:
            prepared = PreparedBackgroundCover(
                rect=fitz.Rect(rect),
                fill=sample_local_background_fill(page, rect),
            )
        covers.append(prepared)
    return covers


def apply_prepared_background_covers(
    page: fitz.Page,
    covers: list[PreparedBackgroundCover],
) -> None:
    for cover in covers:
        apply_prepared_background_cover(page, cover)


def draw_white_covers(page: fitz.Page, rects: list[fitz.Rect]) -> None:
    if not rects:
        return
    for rect in rects:
        fill = sample_local_background_fill(page, rect)
        shape = page.new_shape()
        shape.draw_rect(rect)
        shape.finish(color=None, fill=fill)
        shape.commit(overlay=True)


def draw_flat_white_covers(page: fitz.Page, rects: list[fitz.Rect]) -> None:
    if not rects:
        return
    for rect in rects:
        fill = sample_local_background_fill(page, rect)
        shape = page.new_shape()
        shape.draw_rect(rect)
        shape.finish(color=None, fill=fill)
        shape.commit(overlay=True)


def draw_background_covers(page: fitz.Page, rects: list[fitz.Rect]) -> None:
    if not rects:
        return
    for rect in rects:
        apply_prepared_background_cover(
            page,
            prepare_background_cover(page, rect)
            or PreparedBackgroundCover(rect=fitz.Rect(rect), fill=sample_local_background_fill(page, rect)),
        )
