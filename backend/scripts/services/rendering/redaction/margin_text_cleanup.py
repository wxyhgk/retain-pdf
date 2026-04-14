from __future__ import annotations

import fitz


TOP_BAND_RATIO = 0.14
BOTTOM_BAND_RATIO = 0.08
MIN_TOP_BAND_PT = 72.0
MIN_BOTTOM_BAND_PT = 48.0


def _band_limits(page: fitz.Page) -> tuple[float, float]:
    page_height = max(float(page.rect.height), 1.0)
    top_limit = min(page_height * 0.3, max(MIN_TOP_BAND_PT, page_height * TOP_BAND_RATIO))
    bottom_limit = max(
        page_height * 0.7,
        page_height - max(MIN_BOTTOM_BAND_PT, page_height * BOTTOM_BAND_RATIO),
    )
    return top_limit, bottom_limit


def _candidate_margin_block_rects(page: fitz.Page) -> list[fitz.Rect]:
    top_limit, bottom_limit = _band_limits(page)
    rects: list[fitz.Rect] = []
    try:
        blocks = page.get_text("blocks")
    except Exception:
        return rects

    for entry in blocks:
        if len(entry) < 7:
            continue
        try:
            rect = fitz.Rect(entry[:4])
        except Exception:
            continue
        block_type = entry[6]
        text = str(entry[4] or "").strip()
        if block_type != 0 or rect.is_empty or not text:
            continue
        center_y = (rect.y0 + rect.y1) / 2.0
        if center_y <= top_limit or center_y >= bottom_limit:
            rects.append(rect)
    return rects


def cleanup_margin_text_blocks(page: fitz.Page) -> int:
    rects = _candidate_margin_block_rects(page)
    if not rects:
        return 0
    for rect in rects:
        page.add_redact_annot(rect, fill=False)
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_NONE,
        graphics=fitz.PDF_REDACT_LINE_ART_NONE,
        text=fitz.PDF_REDACT_TEXT_REMOVE,
    )
    return len(rects)

