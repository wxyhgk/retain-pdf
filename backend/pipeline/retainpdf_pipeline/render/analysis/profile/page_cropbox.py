from __future__ import annotations

import fitz


def page_cropbox(page: fitz.Page) -> tuple[float, float, float, float]:
    cropbox = page.cropbox
    return (float(cropbox.x0), float(cropbox.y0), float(cropbox.x1), float(cropbox.y1))
