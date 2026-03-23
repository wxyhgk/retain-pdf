import fitz

from rendering.pdf_overlay_parts.shared import iter_valid_translated_items, normalize_words


def _item_has_removable_text(page: fitz.Page, item: dict, rect: fitz.Rect) -> bool:
    source_text = (item.get("source_text") or item.get("protected_source_text") or "").strip()
    if not source_text:
        return False

    clip = fitz.Rect(rect.x0 - 1, rect.y0 - 1, rect.x1 + 1, rect.y1 + 1)
    words = page.get_text("words", clip=clip)
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
) -> None:
    redactions: list[tuple[fitz.Rect, tuple[float, float, float] | None]] = []
    for rect, item, _translated_text in iter_valid_translated_items(translated_items):
        if fill_background is None:
            fill = None if _item_has_removable_text(page, item, rect) else (1, 1, 1)
        else:
            fill = (1, 1, 1) if fill_background else None
        redactions.append((rect, fill))

    for rect, fill in redactions:
        page.add_redact_annot(rect, fill=fill)
    if redactions:
        page.apply_redactions(
            images=fitz.PDF_REDACT_IMAGE_NONE,
            graphics=fitz.PDF_REDACT_LINE_ART_NONE,
            text=fitz.PDF_REDACT_TEXT_REMOVE,
        )
