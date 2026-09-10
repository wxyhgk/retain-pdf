"""Deterministic, script-free SVG charts generated entirely in memory."""

from __future__ import annotations

import hashlib
from html import escape

from ._validation import (
    bounded_payload,
    require_number,
    require_sequence,
    require_text,
)
from .errors import fail
from .limits import (
    MAX_CHART_HEIGHT,
    MAX_CHART_POINTS,
    MAX_CHART_TEXT_CHARS,
    MAX_CHART_WIDTH,
    MAX_SVG_BYTES,
    MAX_TOTAL_CHART_TEXT_CHARS,
    MIN_CHART_HEIGHT,
    MIN_CHART_WIDTH,
)

CHART_TYPES = frozenset({"bar", "line"})


def _coordinate(value: float) -> str:
    if abs(value) < 0.0005:
        value = 0.0
    return f"{value:.2f}".rstrip("0").rstrip(".")


def _number_label(value: float) -> str:
    if value == 0:
        return "0"
    return format(value, ".8g")


def _dimension(value: object, *, name: str, minimum: int, maximum: int) -> int:
    if type(value) is not int or not minimum <= value <= maximum:
        fail(
            "invalid_chart",
            f"Chart {name} must be an integer between {minimum} and {maximum}.",
        )
    return value


def generate_svg_chart(
    labels: object,
    values: object,
    *,
    chart_type: str = "bar",
    title: str = "",
    series_name: str = "",
    width: int = 640,
    height: int = 360,
) -> dict[str, object]:
    """Return a bounded SVG artifact payload; no file or URL is created."""
    if type(chart_type) is not str or chart_type not in CHART_TYPES:
        fail("unsupported_chart", "The chart type is not supported.")
    checked_width = _dimension(
        width, name="width", minimum=MIN_CHART_WIDTH, maximum=MAX_CHART_WIDTH
    )
    checked_height = _dimension(
        height, name="height", minimum=MIN_CHART_HEIGHT, maximum=MAX_CHART_HEIGHT
    )
    checked_title = require_text(
        title, what="Chart title", max_chars=MAX_CHART_TEXT_CHARS
    )
    checked_series_name = require_text(
        series_name, what="Series name", max_chars=MAX_CHART_TEXT_CHARS
    )
    label_sequence = require_sequence(labels, what="Labels")
    value_sequence = require_sequence(values, what="Values")
    if not label_sequence or len(label_sequence) != len(value_sequence):
        fail(
            "invalid_chart",
            "Labels and values must be non-empty arrays of equal length.",
        )
    if len(label_sequence) > MAX_CHART_POINTS:
        fail("chart_limit_exceeded", "The chart has too many points.")
    checked_labels = [
        require_text(label, what="A chart label", max_chars=MAX_CHART_TEXT_CHARS)
        for label in label_sequence
    ]
    if (
        sum(len(label) for label in checked_labels)
        + len(checked_title)
        + len(checked_series_name)
        > MAX_TOTAL_CHART_TEXT_CHARS
    ):
        fail("chart_limit_exceeded", "The chart contains too much text.")
    checked_values = [require_number(value) for value in value_sequence]

    left, right = 64.0, 20.0
    top = 48.0 if checked_title else 24.0
    bottom = 60.0
    plot_width = checked_width - left - right
    plot_height = checked_height - top - bottom
    low = min(0.0, float(min(checked_values)))
    high = max(0.0, float(max(checked_values)))
    if low == high:
        high = 1.0
    span = high - low

    def x_at(index: int) -> float:
        return left + plot_width * (index + 0.5) / len(checked_values)

    def y_at(value: float) -> float:
        return top + (high - value) / span * plot_height

    baseline = y_at(0.0)
    parts = [
        (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{checked_width}" '
            f'height="{checked_height}" viewBox="0 0 {checked_width} {checked_height}" '
            'role="img">'
        ),
        "<title>" + escape(checked_title or "Data chart") + "</title>",
        '<rect width="100%" height="100%" fill="#ffffff"/>',
    ]
    if checked_title:
        parts.append(
            f'<text x="{_coordinate(checked_width / 2)}" y="26" '
            'text-anchor="middle" font-family="sans-serif" font-size="16" '
            f'fill="#172033">{escape(checked_title)}</text>'
        )

    for tick in range(5):
        tick_value = low + span * tick / 4
        tick_y = y_at(tick_value)
        parts.append(
            f'<line x1="{_coordinate(left)}" y1="{_coordinate(tick_y)}" '
            f'x2="{_coordinate(left + plot_width)}" y2="{_coordinate(tick_y)}" '
            'stroke="#dfe4ea" stroke-width="1"/>'
        )
        parts.append(
            f'<text x="{_coordinate(left - 8)}" y="{_coordinate(tick_y + 4)}" '
            'text-anchor="end" font-family="sans-serif" font-size="11" '
            f'fill="#596273">{escape(_number_label(tick_value))}</text>'
        )
    parts.append(
        f'<line x1="{_coordinate(left)}" y1="{_coordinate(baseline)}" '
        f'x2="{_coordinate(left + plot_width)}" y2="{_coordinate(baseline)}" '
        'stroke="#596273" stroke-width="1.5"/>'
    )

    if chart_type == "bar":
        slot = plot_width / len(checked_values)
        bar_width = max(1.0, slot * 0.68)
        for index, value in enumerate(checked_values):
            value_y = y_at(float(value))
            y = min(value_y, baseline)
            bar_height = max(0.75, abs(value_y - baseline))
            parts.append(
                f'<rect x="{_coordinate(x_at(index) - bar_width / 2)}" '
                f'y="{_coordinate(y)}" width="{_coordinate(bar_width)}" '
                f'height="{_coordinate(bar_height)}" fill="#4169e1"/>'
            )
    else:
        points = " ".join(
            f"{_coordinate(x_at(index))},{_coordinate(y_at(float(value)))}"
            for index, value in enumerate(checked_values)
        )
        parts.append(
            f'<polyline points="{points}" fill="none" stroke="#4169e1" '
            'stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'
        )
        for index, value in enumerate(checked_values):
            parts.append(
                f'<circle cx="{_coordinate(x_at(index))}" '
                f'cy="{_coordinate(y_at(float(value)))}" r="3" fill="#4169e1"/>'
            )

    label_stride = max(
        1,
        (len(checked_labels) * 72 + int(plot_width) - 1) // int(plot_width),
    )
    for index, label in enumerate(checked_labels):
        if index % label_stride and index != len(checked_labels) - 1:
            continue
        parts.append(
            f'<text x="{_coordinate(x_at(index))}" '
            f'y="{_coordinate(top + plot_height + 22)}" '
            'text-anchor="middle" font-family="sans-serif" font-size="11" '
            f'fill="#333b4a">{escape(label)}</text>'
        )
    if checked_series_name:
        parts.append(
            f'<text x="{_coordinate(left)}" y="{_coordinate(checked_height - 12)}" '
            'font-family="sans-serif" font-size="11" fill="#596273">'
            f'{escape(checked_series_name)}</text>'
        )
    parts.append("</svg>")
    svg = "".join(parts)
    encoded = svg.encode("utf-8")
    if len(encoded) > MAX_SVG_BYTES:
        fail("output_limit_exceeded", "The SVG output exceeds the safe limit.")

    return bounded_payload(
        {
            "schema": "retainpdf.calculation-artifact.v1",
            "artifact": {
                "kind": "svg_chart",
                "media_type": "image/svg+xml",
                "filename": "chart.svg",
                "size_bytes": len(encoded),
                "sha256": hashlib.sha256(encoded).hexdigest(),
                "content": svg,
            },
            "chart": {
                "type": chart_type,
                "point_count": len(checked_values),
                "width": checked_width,
                "height": checked_height,
            },
        }
    )
