from __future__ import annotations

from dataclasses import dataclass

import fitz


@dataclass(frozen=True)
class RedactionPlan:
    valid_items: list[tuple[fitz.Rect, dict, str]]
    image_page: bool
    drawing_rects: list[fitz.Rect]
    drawing_count: int
