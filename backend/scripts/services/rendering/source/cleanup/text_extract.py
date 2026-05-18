from __future__ import annotations

import fitz


def word_rect(entry: tuple) -> fitz.Rect | None:
    if len(entry) < 5:
        return None
    try:
        return fitz.Rect(entry[:4])
    except Exception:
        return None


def extract_page_words(page: fitz.Page) -> list[tuple]:
    try:
        return page.get_text("words")
    except Exception:
        return []


def extract_page_text_blocks(page: fitz.Page) -> list[tuple[fitz.Rect, str]]:
    try:
        raw_blocks = page.get_text("blocks")
    except Exception:
        return []
    blocks: list[tuple[fitz.Rect, str]] = []
    for entry in raw_blocks:
        if len(entry) < 7:
            continue
        try:
            rect = fitz.Rect(entry[:4])
        except Exception:
            continue
        block_type = entry[6]
        if block_type != 0 or rect.is_empty:
            continue
        text = str(entry[4] or "").strip()
        if not text:
            continue
        blocks.append((rect, text))
    return blocks


def extract_page_text_spans(page: fitz.Page) -> list[tuple[fitz.Rect, str]]:
    try:
        text_dict = page.get_text("dict")
    except Exception:
        return []

    spans: list[tuple[fitz.Rect, str]] = []
    for block in text_dict.get("blocks", []) or []:
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []) or []:
            for span in line.get("spans", []) or []:
                bbox = span.get("bbox", [])
                if len(bbox) != 4:
                    continue
                rect = fitz.Rect(bbox)
                if rect.is_empty:
                    continue
                text = str(span.get("text", "") or "").strip()
                if not text:
                    continue
                spans.append((rect, text))
    return spans


def extract_item_word_entries(
    page: fitz.Page,
    rect: fitz.Rect,
    page_words: list[tuple] | None = None,
) -> list[tuple[fitz.Rect, str]]:
    from services.rendering.source.rects import clip_rect

    clip = clip_rect(rect)
    raw_words = page.get_text("words", clip=clip) if page_words is None else page_words
    entries: list[tuple[fitz.Rect, str]] = []
    for entry in raw_words:
        candidate_rect = word_rect(entry)
        if candidate_rect is None or (clip & candidate_rect).is_empty:
            continue
        token = str(entry[4]).strip().lower() if len(entry) >= 5 else ""
        if not token:
            continue
        entries.append((candidate_rect, token))
    return entries


def rect_contains_point(rect: fitz.Rect, x: float, y: float) -> bool:
    return rect.x0 <= x <= rect.x1 and rect.y0 <= y <= rect.y1


def rect_center(rect: fitz.Rect) -> tuple[float, float]:
    return ((rect.x0 + rect.x1) / 2.0, (rect.y0 + rect.y1) / 2.0)
