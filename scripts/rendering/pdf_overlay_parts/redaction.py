import fitz

from rendering.pdf_overlay_parts.shared import iter_valid_translated_items, normalize_words


HEAVY_VECTOR_PAGE_DRAWINGS_THRESHOLD = 5000
LOCAL_VECTOR_ITEM_DRAWINGS_THRESHOLD = 64
LOCAL_VECTOR_ITEM_AREA_RATIO_THRESHOLD = 0.15


def _clip_rect(rect: fitz.Rect) -> fitz.Rect:
    return fitz.Rect(rect.x0 - 1, rect.y0 - 1, rect.x1 + 1, rect.y1 + 1)


def _rect_area(rect: fitz.Rect) -> float:
    return max(0.0, float(rect.x1) - float(rect.x0)) * max(0.0, float(rect.y1) - float(rect.y0))


def _word_rect(entry: tuple) -> fitz.Rect | None:
    if len(entry) < 5:
        return None
    try:
        return fitz.Rect(entry[:4])
    except Exception:
        return None


def _extract_page_words(page: fitz.Page) -> list[tuple]:
    try:
        return page.get_text("words")
    except Exception:
        return []


def _collect_page_drawing_rects(page: fitz.Page) -> list[fitz.Rect]:
    try:
        drawings = page.get_cdrawings() if hasattr(page, "get_cdrawings") else page.get_drawings()
    except Exception:
        return []

    rects: list[fitz.Rect] = []
    for drawing in drawings:
        rect = drawing.get("rect")
        if not rect:
            continue
        try:
            draw_rect = fitz.Rect(rect)
        except Exception:
            continue
        if draw_rect.is_empty:
            continue
        rects.append(draw_rect)
    return rects


def _item_vector_overlap_stats(rect: fitz.Rect, drawing_rects: list[fitz.Rect]) -> tuple[int, float]:
    if not drawing_rects or rect.is_empty:
        return 0, 0.0

    clip = _clip_rect(rect)
    overlap_count = 0
    overlap_area = 0.0
    for draw_rect in drawing_rects:
        inter = clip & draw_rect
        if inter.is_empty:
            continue
        overlap_count += 1
        overlap_area += _rect_area(inter)
    rect_area = max(_rect_area(clip), 1.0)
    return overlap_count, overlap_area / rect_area


def _page_should_use_cover_only(drawing_rects: list[fitz.Rect]) -> bool:
    return len(drawing_rects) >= HEAVY_VECTOR_PAGE_DRAWINGS_THRESHOLD


def _item_should_use_cover_only(rect: fitz.Rect, drawing_rects: list[fitz.Rect]) -> bool:
    overlap_count, overlap_ratio = _item_vector_overlap_stats(rect, drawing_rects)
    return (
        overlap_count >= LOCAL_VECTOR_ITEM_DRAWINGS_THRESHOLD
        or overlap_ratio >= LOCAL_VECTOR_ITEM_AREA_RATIO_THRESHOLD
    )


def _draw_white_covers(page: fitz.Page, rects: list[fitz.Rect]) -> None:
    if not rects:
        return
    shape = page.new_shape()
    for rect in rects:
        shape.draw_rect(rect)
    shape.finish(color=None, fill=(1, 1, 1))
    shape.commit(overlay=True)


def item_has_removable_text(
    page: fitz.Page,
    item: dict,
    rect: fitz.Rect,
    page_words: list[tuple] | None = None,
) -> bool:
    source_text = (item.get("source_text") or item.get("protected_source_text") or "").strip()
    if not source_text:
        return False

    clip = _clip_rect(rect)
    words = []
    if page_words is None:
        words = page.get_text("words", clip=clip)
    else:
        for entry in page_words:
            word_rect = _word_rect(entry)
            if word_rect is None or (clip & word_rect).is_empty:
                continue
            words.append(entry)
    if not words:
        return False

    pdf_words = [str(entry[4]).strip().lower() for entry in words if len(entry) >= 5 and str(entry[4]).strip()]
    if not pdf_words:
        return False

    source_words = normalize_words(source_text)
    if not source_words:
        return len(pdf_words) >= 2

    pdf_word_set = set(pdf_words)
    source_word_set = set(source_words)
    overlap = len(pdf_word_set & source_word_set)
    source_len = len(source_words)

    if source_len <= 3:
        return overlap >= 1
    if source_len <= 8:
        return overlap >= 2
    return overlap >= max(2, int(source_len * 0.3))


def redact_translated_text_areas(
    page: fitz.Page,
    translated_items: list[dict],
    fill_background: bool | None = None,
    cover_only: bool = False,
) -> None:
    valid_items = iter_valid_translated_items(translated_items)
    if not valid_items:
        return

    if cover_only:
        _draw_white_covers(page, [rect for rect, _item, _translated_text in valid_items])
        return

    drawing_rects = _collect_page_drawing_rects(page)
    if fill_background is None and _page_should_use_cover_only(drawing_rects):
        _draw_white_covers(page, [rect for rect, _item, _translated_text in valid_items])
        return

    page_words = _extract_page_words(page) if fill_background is None else None
    redactions: list[tuple[fitz.Rect, tuple[float, float, float] | None]] = []
    cover_rects: list[fitz.Rect] = []
    for rect, item, _translated_text in valid_items:
        if fill_background is None:
            removable = item_has_removable_text(page, item, rect, page_words=page_words)
            if removable:
                fill = None
            elif _item_should_use_cover_only(rect, drawing_rects):
                cover_rects.append(rect)
                continue
            else:
                fill = (1, 1, 1)
        else:
            fill = (1, 1, 1) if fill_background else None
        redactions.append((rect, fill))

    _draw_white_covers(page, cover_rects)

    for rect, fill in redactions:
        page.add_redact_annot(rect, fill=fill)
    if redactions:
        page.apply_redactions(
            images=fitz.PDF_REDACT_IMAGE_NONE,
            graphics=fitz.PDF_REDACT_LINE_ART_NONE,
            text=fitz.PDF_REDACT_TEXT_REMOVE,
        )
