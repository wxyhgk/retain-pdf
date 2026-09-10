from __future__ import annotations

from collections import deque
from dataclasses import dataclass

import fitz

from retainpdf_pipeline.render.layout.font_roles import is_title_like_block
from retainpdf_pipeline.render.layout.typography.geometry import cover_bbox
from retainpdf_pipeline.render.policy import item_overlay_fill
from retainpdf_pipeline.render.policy import item_uses_explicit_white_overlay_fill
from retainpdf_pipeline.render.source.background.fill import LocalBackgroundSampler
from retainpdf_pipeline.render.source.background.color_sampling import sample_local_background_fill


DARK_BACKGROUND_BRIGHTNESS_MAX = 0.42
LIGHT_BACKGROUND_VISUAL_TITLE_BRIGHTNESS_MIN = 0.94
PAGE_TEXT_COLOR_SAMPLER_MIN_TITLES = 2
TITLE_COLOR_SAMPLE_SCALE = 3.0
TITLE_COLOR_MIN_DISTANCE = 42.0
TITLE_COLOR_QUANTUM = 16
DEFAULT_COVER_FILL = (1, 1, 1)
DEFAULT_TEXT_COLOR = (0, 0, 0)
SPAN_COLOR_MIN_DISTANCE = 24.0


@dataclass(frozen=True)
class SpanColorSample:
    rect: fitz.Rect
    text: str
    rgb: tuple[int, int, int]


class PageTextColorSampler:
    def __init__(self, samples: list[SpanColorSample]) -> None:
        self.samples = samples

    @classmethod
    def build(cls, page: fitz.Page) -> "PageTextColorSampler | None":
        try:
            text = page.get_text("dict")
        except Exception:
            return None
        samples: list[SpanColorSample] = []
        for block in text.get("blocks", []):
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    span_text = str(span.get("text") or "")
                    if not span_text.strip():
                        continue
                    rgb = _rgb_from_span_color(span.get("color"))
                    if rgb is None:
                        continue
                    rect = _span_rect(span)
                    if rect is None:
                        continue
                    samples.append(SpanColorSample(rect=rect, text=span_text, rgb=rgb))
        return cls(samples) if samples else None

    def title_text_color(
        self,
        rect: fitz.Rect,
        background: tuple[float, float, float] | None = None,
    ) -> tuple[float, float, float] | None:
        if rect.is_empty or rect.is_infinite:
            return None
        bg = (
            tuple(max(0, min(255, int(round(component * 255)))) for component in background)
            if background is not None
            else None
        )
        threshold_sq = int(SPAN_COLOR_MIN_DISTANCE * SPAN_COLOR_MIN_DISTANCE)
        buckets: dict[tuple[int, int, int], list[int]] = {}
        for sample in self.samples:
            if not sample.rect.intersects(rect):
                continue
            if bg is not None and _color_distance_sq(sample.rgb, bg) < threshold_sq:
                continue
            key = _quantize_color(sample.rgb)
            bucket = buckets.setdefault(key, [0, 0, 0, 0])
            weight = max(1, len(sample.text.strip()))
            bucket[0] += sample.rgb[0] * weight
            bucket[1] += sample.rgb[1] * weight
            bucket[2] += sample.rgb[2] * weight
            bucket[3] += weight
        if not buckets:
            return None
        _key, bucket = max(buckets.items(), key=lambda entry: entry[1][3])
        count = bucket[3]
        if count <= 0:
            return None
        return _float_color_from_rgb(
            (
                int(round(bucket[0] / count)),
                int(round(bucket[1] / count)),
                int(round(bucket[2] / count)),
            )
        )


def relative_brightness(color: tuple[float, float, float]) -> float:
    r, g, b = color
    return 0.299 * r + 0.587 * g + 0.114 * b


def text_color_for_fill(fill: tuple[float, float, float]) -> tuple[float, float, float]:
    if relative_brightness(fill) <= DARK_BACKGROUND_BRIGHTNESS_MAX:
        return (1, 1, 1)
    return (0, 0, 0)


def should_probe_title_visual_color(fill: tuple[float, float, float]) -> bool:
    return relative_brightness(fill) < LIGHT_BACKGROUND_VISUAL_TITLE_BRIGHTNESS_MIN


def _color_distance_sq(
    left: tuple[int, int, int],
    right: tuple[int, int, int],
) -> int:
    return sum((a - b) * (a - b) for a, b in zip(left, right))


def _quantize_color(color: tuple[int, int, int]) -> tuple[int, int, int]:
    return tuple(int(component // TITLE_COLOR_QUANTUM) for component in color)


def _rgb_from_span_color(value: object) -> tuple[int, int, int] | None:
    if isinstance(value, int):
        return ((value >> 16) & 255, (value >> 8) & 255, value & 255)
    if isinstance(value, (list, tuple)) and len(value) >= 3:
        try:
            components = [float(value[idx]) for idx in range(3)]
        except (TypeError, ValueError):
            return None
        if all(0.0 <= component <= 1.0 for component in components):
            return tuple(max(0, min(255, int(round(component * 255)))) for component in components)
        return tuple(max(0, min(255, int(round(component)))) for component in components)
    return None


def _span_rect(span: dict) -> fitz.Rect | None:
    bbox = span.get("bbox")
    if not isinstance(bbox, (list, tuple)) or len(bbox) < 4:
        return None
    try:
        rect = fitz.Rect(float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))
    except Exception:
        return None
    if rect.is_empty or rect.is_infinite:
        return None
    return rect


def _float_color_from_rgb(color: tuple[int, int, int]) -> tuple[float, float, float]:
    return (color[0] / 255.0, color[1] / 255.0, color[2] / 255.0)


def _title_foreground_color_from_pixmap(
    pix: fitz.Pixmap,
    background: tuple[float, float, float],
) -> tuple[float, float, float] | None:
    if pix.width <= 0 or pix.height <= 0 or pix.n < 3:
        return None

    bg = tuple(max(0, min(255, int(round(component * 255)))) for component in background)
    threshold_sq = int(TITLE_COLOR_MIN_DISTANCE * TITLE_COLOR_MIN_DISTANCE)
    samples = pix.samples
    stride = pix.n
    width = pix.width
    height = pix.height
    total_pixels = width * height

    foreground = bytearray(total_pixels)
    for idx in range(total_pixels):
        offset = idx * stride
        rgb = (samples[offset], samples[offset + 1], samples[offset + 2])
        if _color_distance_sq(rgb, bg) >= threshold_sq:
            foreground[idx] = 1

    visited = bytearray(total_pixels)
    buckets: dict[tuple[int, int, int], list[int]] = {}
    min_component_pixels = max(3, int(total_pixels * 0.0004))
    max_component_pixels = max(24, int(total_pixels * 0.35))

    for start in range(total_pixels):
        if not foreground[start] or visited[start]:
            continue

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

            if x > 0:
                neighbor = current - 1
                if foreground[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if x + 1 < width:
                neighbor = current + 1
                if foreground[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if y > 0:
                neighbor = current - width
                if foreground[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if y + 1 < height:
                neighbor = current + width
                if foreground[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)

        component_pixels = len(component)
        component_width = max_x - min_x + 1
        component_height = max_y - min_y + 1
        if component_pixels < min_component_pixels or component_pixels > max_component_pixels:
            continue
        if component_width >= width * 0.82 and component_height <= max(3, height * 0.08):
            continue
        if component_width >= width * 0.92 and component_height >= height * 0.55:
            continue

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
        return None

    _key, bucket = max(buckets.items(), key=lambda entry: entry[1][3])
    count = bucket[3]
    if count <= 0:
        return None
    return (
        bucket[0] / count / 255.0,
        bucket[1] / count / 255.0,
        bucket[2] / count / 255.0,
    )


def title_text_color_from_text_spans(
    page: fitz.Page,
    rect: fitz.Rect,
    background: tuple[float, float, float] | None = None,
) -> tuple[float, float, float] | None:
    if rect.is_empty or rect.is_infinite:
        return None
    clipped = rect & page.rect
    if clipped.is_empty or clipped.is_infinite:
        return None

    bg = (
        tuple(max(0, min(255, int(round(component * 255)))) for component in background)
        if background is not None
        else None
    )
    threshold_sq = int(SPAN_COLOR_MIN_DISTANCE * SPAN_COLOR_MIN_DISTANCE)
    buckets: dict[tuple[int, int, int], list[int]] = {}
    try:
        text = page.get_text("dict", clip=clipped)
    except Exception:
        return None

    for block in text.get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                span_text = str(span.get("text") or "")
                if not span_text.strip():
                    continue
                rgb = _rgb_from_span_color(span.get("color"))
                if rgb is None:
                    continue
                if bg is not None and _color_distance_sq(rgb, bg) < threshold_sq:
                    continue
                key = _quantize_color(rgb)
                bucket = buckets.setdefault(key, [0, 0, 0, 0])
                weight = max(1, len(span_text.strip()))
                bucket[0] += rgb[0] * weight
                bucket[1] += rgb[1] * weight
                bucket[2] += rgb[2] * weight
                bucket[3] += weight

    if not buckets:
        return None
    _key, bucket = max(buckets.items(), key=lambda entry: entry[1][3])
    count = bucket[3]
    if count <= 0:
        return None
    return _float_color_from_rgb(
        (
            int(round(bucket[0] / count)),
            int(round(bucket[1] / count)),
            int(round(bucket[2] / count)),
        )
    )


def title_text_color_from_visual_components(
    page: fitz.Page,
    rect: fitz.Rect,
    background: tuple[float, float, float],
) -> tuple[float, float, float] | None:
    if rect.is_empty or rect.is_infinite:
        return None
    clipped = rect & page.rect
    if clipped.is_empty or clipped.is_infinite:
        return None

    try:
        pix = page.get_pixmap(
            matrix=fitz.Matrix(TITLE_COLOR_SAMPLE_SCALE, TITLE_COLOR_SAMPLE_SCALE),
            clip=clipped,
            alpha=False,
        )
    except Exception:
        return None
    return _title_foreground_color_from_pixmap(pix, background)


def _item_needs_local_color_sampling(item: dict) -> bool:
    return item_overlay_fill(item) == "sampled" or bool(item.get("_render_use_cover_fill"))


def _item_uses_explicit_white_fill(item: dict) -> bool:
    return item_uses_explicit_white_overlay_fill(item) and not _item_needs_local_color_sampling(item)


def _sample_item_cover_fill(
    page: fitz.Page,
    item: dict,
    *,
    sampler: LocalBackgroundSampler | None = None,
) -> tuple[tuple[float, float, float], fitz.Rect | None]:
    bbox = cover_bbox(item)
    if len(bbox) != 4:
        return DEFAULT_COVER_FILL, None
    rect = fitz.Rect(bbox)
    if rect.is_empty or rect.is_infinite:
        return DEFAULT_COVER_FILL, None
    return sample_local_background_fill(page, rect, sampler=sampler), rect


def apply_adaptive_overlay_colors(
    page: fitz.Page,
    items: list[dict],
    *,
    precomputed_colors_by_item_id: dict[str, dict[str, tuple[float, float, float]]] | None = None,
) -> list[dict]:
    adapted: list[dict] = []
    local_sampler = LocalBackgroundSampler.build(page, _local_sampling_rects(items))
    title_count = sum(1 for item in items if is_title_like_block(item))
    text_color_sampler = (
        PageTextColorSampler.build(page)
        if title_count >= PAGE_TEXT_COLOR_SAMPLER_MIN_TITLES
        else None
    )
    for item in items:
        next_item = dict(item)
        item_id = str(next_item.get("item_id") or "")
        precomputed = (precomputed_colors_by_item_id or {}).get(item_id) if item_id else None
        if precomputed is not None:
            next_item["_render_cover_fill"] = precomputed.get(
                "cover_fill",
                next_item.get("_render_cover_fill", DEFAULT_COVER_FILL),
            )
            next_item["_render_text_color"] = precomputed.get(
                "text_color",
                next_item.get("_render_text_color", DEFAULT_TEXT_COLOR),
            )
            adapted.append(next_item)
            continue

        title_like = is_title_like_block(next_item)
        rect: fitz.Rect | None = None
        if _item_needs_local_color_sampling(next_item):
            fill, rect = _sample_item_cover_fill(page, next_item, sampler=local_sampler)
        else:
            fill = DEFAULT_COVER_FILL
            bbox = cover_bbox(next_item)
            if title_like and len(bbox) == 4:
                rect = fitz.Rect(bbox)
                if rect.is_empty or rect.is_infinite:
                    rect = None

        next_item["_render_cover_fill"] = fill
        text_color = text_color_for_fill(fill)
        if rect is not None and title_like:
            title_color = (
                text_color_sampler.title_text_color(rect)
                if text_color_sampler is not None
                else title_text_color_from_text_spans(page, rect)
            )
            if title_color is None:
                if not _item_needs_local_color_sampling(next_item) and not _item_uses_explicit_white_fill(next_item):
                    fill, rect = _sample_item_cover_fill(page, next_item, sampler=local_sampler)
                    next_item["_render_cover_fill"] = fill
                    text_color = text_color_for_fill(fill)
                title_color = (
                    title_text_color_from_visual_components(page, rect, fill)
                    if should_probe_title_visual_color(fill)
                    else None
                )
            if title_color is not None:
                text_color = title_color
        next_item["_render_text_color"] = text_color
        adapted.append(next_item)
    return adapted


def _local_sampling_rects(items: list[dict]) -> list[fitz.Rect]:
    rects: list[fitz.Rect] = []
    for item in items:
        if not _item_needs_local_color_sampling(item):
            continue
        bbox = cover_bbox(item)
        if len(bbox) != 4:
            continue
        rect = fitz.Rect(bbox)
        if not rect.is_empty and not rect.is_infinite:
            rects.append(rect)
    return rects


__all__ = [
    "apply_adaptive_overlay_colors",
    "relative_brightness",
    "text_color_for_fill",
    "title_text_color_from_text_spans",
    "title_text_color_from_visual_components",
]
