from __future__ import annotations

from pathlib import Path

import fitz


VECTOR_SKIP_PAGE_DRAWINGS_THRESHOLD = 100
VECTOR_SKIP_TOTAL_DRAWINGS_THRESHOLD = 300


def page_drawing_count(page: fitz.Page) -> int:
    if hasattr(page, "get_cdrawings"):
        try:
            return len(page.get_cdrawings())
        except Exception:
            pass
    return len(page.get_drawings())


def source_pdf_has_vector_graphics(
    source_pdf_path: Path,
    *,
    start_page: int = 0,
    end_page: int = -1,
) -> bool:
    if not source_pdf_path.exists():
        return False

    doc = fitz.open(source_pdf_path)
    try:
        if len(doc) == 0:
            return False
        start = max(0, start_page)
        stop = len(doc) - 1 if end_page < 0 else min(end_page, len(doc) - 1)
        if start > stop:
            return False

        total_drawings = 0
        for page_idx in range(start, stop + 1):
            drawings = page_drawing_count(doc[page_idx])
            total_drawings += drawings
            if drawings >= VECTOR_SKIP_PAGE_DRAWINGS_THRESHOLD:
                return True
            if total_drawings >= VECTOR_SKIP_TOTAL_DRAWINGS_THRESHOLD:
                return True
        return False
    finally:
        doc.close()


def max_display_rect_by_xref(doc: fitz.Document) -> dict[int, tuple[float, float]]:
    max_rects: dict[int, tuple[float, float]] = {}
    for page in doc:
        for image in page.get_images(full=True):
            xref = image[0]
            try:
                rects = page.get_image_rects(xref)
            except Exception:
                rects = []
            for rect in rects:
                width = max(0.0, float(rect.width))
                height = max(0.0, float(rect.height))
                if width <= 0.0 or height <= 0.0:
                    continue
                prev_width, prev_height = max_rects.get(xref, (0.0, 0.0))
                max_rects[xref] = (max(prev_width, width), max(prev_height, height))
    return max_rects


def target_pixel_size(display_size_pt: tuple[float, float], dpi: int) -> tuple[int, int]:
    width_pt, height_pt = display_size_pt
    width_px = max(1, round(width_pt / 72.0 * dpi))
    height_px = max(1, round(height_pt / 72.0 * dpi))
    return width_px, height_px
