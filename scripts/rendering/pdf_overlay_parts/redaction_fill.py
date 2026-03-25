from __future__ import annotations

import fitz

from rendering.pdf_overlay_parts.redaction_config import (
    COVER_COMPLEXITY_BRIGHTNESS_SPREAD,
    COVER_MIN_SAMPLE_PIXELS,
    COVER_SAMPLE_MARGIN_PT,
    COVER_SAMPLE_SCALE,
)


def quantile(sorted_values: list[int], numerator: int, denominator: int) -> int:
    if not sorted_values:
        return 255
    index = int(round((len(sorted_values) - 1) * numerator / denominator))
    index = max(0, min(len(sorted_values) - 1, index))
    return sorted_values[index]


def sample_local_background_fill(page: fitz.Page, rect: fitz.Rect) -> tuple[float, float, float]:
    page_rect = fitz.Rect(page.rect)
    outer = fitz.Rect(
        rect.x0 - COVER_SAMPLE_MARGIN_PT,
        rect.y0 - COVER_SAMPLE_MARGIN_PT,
        rect.x1 + COVER_SAMPLE_MARGIN_PT,
        rect.y1 + COVER_SAMPLE_MARGIN_PT,
    ) & page_rect
    if outer.is_empty or outer.width <= 1 or outer.height <= 1:
        return (1, 1, 1)

    try:
        pix = page.get_pixmap(
            clip=outer,
            matrix=fitz.Matrix(COVER_SAMPLE_SCALE, COVER_SAMPLE_SCALE),
            colorspace=fitz.csRGB,
            alpha=False,
        )
    except Exception:
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

    if len(pixels) < COVER_MIN_SAMPLE_PIXELS:
        return (1, 1, 1)

    brightness = sorted(int((r + g + b) / 3) for r, g, b in pixels)
    spread = quantile(brightness, 9, 10) - quantile(brightness, 1, 10)
    if spread > COVER_COMPLEXITY_BRIGHTNESS_SPREAD:
        return (1, 1, 1)

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


def draw_white_covers(page: fitz.Page, rects: list[fitz.Rect]) -> None:
    if not rects:
        return
    for rect in rects:
        fill = sample_local_background_fill(page, rect)
        shape = page.new_shape()
        shape.draw_rect(rect)
        shape.finish(color=None, fill=fill)
        shape.commit(overlay=True)
