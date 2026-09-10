from __future__ import annotations

import fitz


DISPLAY_INTRUSIVE_HEIGHT_RATIO = 3.0
DISPLAY_INTRUSIVE_MAX_TEXT_LEN = 2


def collect_page_intrusive_display_text_rects(page: fitz.Page) -> list[fitz.Rect]:
    try:
        text_dict = page.get_text("dict")
    except Exception:
        return []

    span_heights: list[float] = []
    candidates: list[tuple[fitz.Rect, str, float]] = []
    for block in text_dict.get("blocks", []) or []:
        for line in block.get("lines", []) or []:
            for span in line.get("spans", []) or []:
                text = str(span.get("text", "") or "").strip()
                bbox = span.get("bbox", [])
                if len(bbox) != 4:
                    continue
                rect = fitz.Rect(bbox)
                if rect.is_empty:
                    continue
                height = max(0.0, rect.y1 - rect.y0)
                if height <= 0.5:
                    continue
                if text:
                    span_heights.append(height)
                candidates.append((rect, text, height))

    if not span_heights:
        return []
    span_heights.sort()
    baseline_height = span_heights[len(span_heights) // 2]
    if baseline_height <= 0.5:
        return []

    intrusive: list[fitz.Rect] = []
    for rect, text, height in candidates:
        compact_text = "".join(text.split())
        if len(compact_text) > DISPLAY_INTRUSIVE_MAX_TEXT_LEN:
            continue
        if height < baseline_height * DISPLAY_INTRUSIVE_HEIGHT_RATIO:
            continue
        intrusive.append(rect)
    return intrusive
