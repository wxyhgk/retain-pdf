from __future__ import annotations

import fitz


def rect_area(rect: fitz.Rect) -> float:
    return max(0.0, float(rect.x1) - float(rect.x0)) * max(0.0, float(rect.y1) - float(rect.y0))
