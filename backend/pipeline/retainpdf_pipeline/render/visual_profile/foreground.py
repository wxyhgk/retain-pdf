from __future__ import annotations

from collections import deque

import fitz

from retainpdf_pipeline.render.visual_profile.contracts import VisualColor


FOREGROUND_SAMPLE_SCALE = 3.0
FOREGROUND_MIN_DISTANCE = 36.0
FOREGROUND_COLOR_QUANTUM = 16


def text_color_for_background(background: VisualColor) -> VisualColor:
    brightness = 0.299 * background[0] + 0.587 * background[1] + 0.114 * background[2]
    return (1.0, 1.0, 1.0) if brightness <= 0.42 else (0.0, 0.0, 0.0)


def sample_foreground_color_from_pixels(
    page: fitz.Page,
    rect: fitz.Rect,
    background: VisualColor,
) -> tuple[VisualColor | None, float]:
    clipped = fitz.Rect(rect) & page.rect
    if clipped.is_empty or clipped.is_infinite:
        return None, 0.0
    try:
        pix = page.get_pixmap(
            matrix=fitz.Matrix(FOREGROUND_SAMPLE_SCALE, FOREGROUND_SAMPLE_SCALE),
            clip=clipped,
            colorspace=fitz.csRGB,
            alpha=False,
        )
    except Exception:
        return None, 0.0
    return foreground_color_from_pixmap(pix, background)


def foreground_color_from_pixmap(
    pix: fitz.Pixmap,
    background: VisualColor,
) -> tuple[VisualColor | None, float]:
    if pix.width <= 0 or pix.height <= 0 or pix.n < 3:
        return None, 0.0

    bg = tuple(max(0, min(255, int(round(component * 255)))) for component in background)
    threshold_sq = int(FOREGROUND_MIN_DISTANCE * FOREGROUND_MIN_DISTANCE)
    samples = memoryview(pix.samples)
    stride = pix.n
    width = pix.width
    height = pix.height
    total_pixels = width * height

    foreground = bytearray(total_pixels)
    foreground_count = 0
    for idx in range(total_pixels):
        offset = idx * stride
        rgb = (samples[offset], samples[offset + 1], samples[offset + 2])
        if _color_distance_sq(rgb, bg) >= threshold_sq:
            foreground[idx] = 1
            foreground_count += 1
    if foreground_count == 0:
        return None, 0.0

    visited = bytearray(total_pixels)
    buckets: dict[tuple[int, int, int], list[int]] = {}
    min_component_pixels = max(2, int(total_pixels * 0.00025))
    max_component_pixels = max(32, int(total_pixels * 0.45))
    kept_pixels = 0

    for start in range(total_pixels):
        if not foreground[start] or visited[start]:
            continue
        component, bounds = _collect_component(start, foreground, visited, width, height)
        component_pixels = len(component)
        if not _component_looks_like_text(component_pixels, bounds, width, height, min_component_pixels, max_component_pixels):
            continue
        kept_pixels += component_pixels
        for idx in component:
            offset = idx * stride
            rgb = (samples[offset], samples[offset + 1], samples[offset + 2])
            key = _quantize_color(rgb)
            bucket = buckets.setdefault(key, [0, 0, 0, 0])
            bucket[0] += rgb[0]
            bucket[1] += rgb[1]
            bucket[2] += rgb[2]
            bucket[3] += 1

    if not buckets:
        return None, 0.0
    _key, bucket = max(buckets.items(), key=lambda entry: entry[1][3])
    count = bucket[3]
    if count <= 0:
        return None, 0.0
    confidence = min(0.9, max(0.35, kept_pixels / max(foreground_count, 1)))
    return (
        bucket[0] / count / 255.0,
        bucket[1] / count / 255.0,
        bucket[2] / count / 255.0,
    ), confidence


def _collect_component(
    start: int,
    foreground: bytearray,
    visited: bytearray,
    width: int,
    height: int,
) -> tuple[list[int], tuple[int, int, int, int]]:
    queue: deque[int] = deque([start])
    visited[start] = 1
    component: list[int] = []
    min_x = width
    min_y = height
    max_x = -1
    max_y = -1

    while queue:
        current = queue.popleft()
        component.append(current)
        y, x = divmod(current, width)
        min_x = min(min_x, x)
        min_y = min(min_y, y)
        max_x = max(max_x, x)
        max_y = max(max_y, y)

        for neighbor in _neighbors(current, x, y, width, height):
            if foreground[neighbor] and not visited[neighbor]:
                visited[neighbor] = 1
                queue.append(neighbor)

    return component, (min_x, min_y, max_x, max_y)


def _neighbors(current: int, x: int, y: int, width: int, height: int) -> tuple[int, ...]:
    result: list[int] = []
    if x > 0:
        result.append(current - 1)
    if x + 1 < width:
        result.append(current + 1)
    if y > 0:
        result.append(current - width)
    if y + 1 < height:
        result.append(current + width)
    return tuple(result)


def _component_looks_like_text(
    component_pixels: int,
    bounds: tuple[int, int, int, int],
    width: int,
    height: int,
    min_component_pixels: int,
    max_component_pixels: int,
) -> bool:
    if component_pixels < min_component_pixels or component_pixels > max_component_pixels:
        return False
    min_x, min_y, max_x, max_y = bounds
    component_width = max_x - min_x + 1
    component_height = max_y - min_y + 1
    if component_width >= width * 0.92 and component_height >= height * 0.55:
        return False
    if component_width >= width * 0.86 and component_height <= max(3, height * 0.07):
        return False
    return True


def _color_distance_sq(left: tuple[int, int, int], right: tuple[int, int, int]) -> int:
    return sum((a - b) * (a - b) for a, b in zip(left, right))


def _quantize_color(color: tuple[int, int, int]) -> tuple[int, int, int]:
    return tuple(int(component // FOREGROUND_COLOR_QUANTUM) for component in color)
