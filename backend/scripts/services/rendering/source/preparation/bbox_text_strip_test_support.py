from __future__ import annotations

import fitz

from services.rendering.source.preparation.bbox_text_strip_candidates import build_page_formula_rects_for_page
from services.rendering.source.preparation.bbox_text_strip_candidates import build_page_strip_rects_for_page
from services.rendering.source.preparation.bbox_text_strip_candidates import build_page_strip_source_rects_for_page


def build_page_strip_rects_for_items(
    *,
    page_height: float,
    translated_items: list[dict],
) -> list[fitz.Rect]:
    page = fitz.open().new_page(width=1, height=page_height)
    return build_page_strip_rects_for_page(page, translated_items=translated_items)


def build_page_formula_rects_for_items(
    *,
    page_height: float,
    translated_items: list[dict],
) -> list[fitz.Rect]:
    page = fitz.open().new_page(width=1, height=page_height)
    return build_page_formula_rects_for_page(page, translated_items=translated_items)


def build_page_strip_source_rects_for_items(*, page_height: float, translated_items: list[dict]) -> list[fitz.Rect]:
    page = fitz.open().new_page(width=1, height=page_height)
    return build_page_strip_source_rects_for_page(page, translated_items=translated_items)
