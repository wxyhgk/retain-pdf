from __future__ import annotations

import fitz

from retainpdf_pipeline.render.source_cleanup.planning.planner import build_page_formula_rects_for_page
from retainpdf_pipeline.render.source_cleanup.planning.planner import build_page_strip_rects_for_page
from retainpdf_pipeline.render.source_cleanup.planning.planner import build_page_strip_source_rects_for_page


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
