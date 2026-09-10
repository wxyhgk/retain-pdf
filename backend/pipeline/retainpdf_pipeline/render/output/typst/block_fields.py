from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TypstBlockFields:
    var_prefix: str
    x0: float
    y0: float
    width: float
    height: float
    font_size: float
    leading: float
    font_weight: str


def _rect_fields(rect: list[float]) -> tuple[float, float, float, float]:
    x0, y0, x1, y1 = rect
    return x0, y0, max(8.0, x1 - x0), max(8.0, y1 - y0)


def typst_block_fields(
    block_id: str,
    rect: list[float],
    *,
    font_size_pt: float,
    leading_em: float,
    font_weight: str | None,
) -> TypstBlockFields:
    x0, y0, width, height = _rect_fields(rect)
    return TypstBlockFields(
        var_prefix=block_id.replace("-", "_"),
        x0=x0,
        y0=y0,
        width=width,
        height=height,
        font_size=max(1.0, font_size_pt),
        leading=max(0.1, leading_em),
        font_weight=font_weight if str(font_weight or "").strip() else "regular",
    )


def typst_rgb(color: tuple[float, float, float]) -> str:
    r, g, b = color
    return f"rgb({int(max(0, min(1, r)) * 255)}, {int(max(0, min(1, g)) * 255)}, {int(max(0, min(1, b)) * 255)})"
