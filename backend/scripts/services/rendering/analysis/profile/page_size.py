from __future__ import annotations

import fitz


def page_size_pt(page: fitz.Page) -> tuple[float, float]:
    return float(page.rect.width), float(page.rect.height)
