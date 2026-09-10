from __future__ import annotations

from dataclasses import dataclass

import fitz

from retainpdf_pipeline.render.visual_profile.contracts import VisualColor


SPAN_COLOR_MIN_DISTANCE = 24.0
SPAN_COLOR_QUANTUM = 16


@dataclass(frozen=True)
class SpanColorSample:
    rect: fitz.Rect
    text: str
    rgb: tuple[int, int, int]


class PageSpanColorSampler:
    def __init__(self, samples: list[SpanColorSample]) -> None:
        self.samples = samples

    @classmethod
    def build(cls, page: fitz.Page) -> "PageSpanColorSampler | None":
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
                    rect = _span_rect(span)
                    if rgb is not None and rect is not None:
                        samples.append(SpanColorSample(rect=rect, text=span_text, rgb=rgb))
        return cls(samples) if samples else None

    def sample_text_color(self, rect: fitz.Rect, background: VisualColor | None = None) -> VisualColor | None:
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
        return (
            int(round(bucket[0] / count)) / 255.0,
            int(round(bucket[1] / count)) / 255.0,
            int(round(bucket[2] / count)) / 255.0,
        )


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


def _color_distance_sq(left: tuple[int, int, int], right: tuple[int, int, int]) -> int:
    return sum((a - b) * (a - b) for a, b in zip(left, right))


def _quantize_color(color: tuple[int, int, int]) -> tuple[int, int, int]:
    return tuple(int(component // SPAN_COLOR_QUANTUM) for component in color)
