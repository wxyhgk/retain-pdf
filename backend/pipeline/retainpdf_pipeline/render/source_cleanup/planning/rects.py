from __future__ import annotations

from typing import Iterable

import fitz

from retainpdf_pipeline.render.source.rects import rect_area
from retainpdf_pipeline.render.source.rects import rect_key


def merge_rects(rects: Iterable[fitz.Rect]) -> list[fitz.Rect]:
    deduped: dict[tuple[int, int, int, int], fitz.Rect] = {}
    for rect in rects:
        normalized = fitz.Rect(rect)
        if normalized.is_empty or rect_area(normalized) <= 0.5:
            continue
        deduped.setdefault(rect_key(normalized), normalized)
    return sorted(
        deduped.values(),
        key=lambda value: (round(value.y0, 2), round(value.x0, 2), round(value.y1, 2)),
    )
