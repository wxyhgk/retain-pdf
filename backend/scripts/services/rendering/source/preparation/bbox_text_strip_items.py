from __future__ import annotations

from collections.abc import Iterator

import fitz

from services.rendering.source.preparation.bbox_text_strip_geometry import ocr_bbox_to_pdf_rect
from services.rendering.source.preparation.bbox_text_strip_rects import merge_rects
from services.rendering.source.preparation.bbox_text_strip_geometry import to_float
from services.rendering.source.preparation.bbox_text_strip_policy_adapter import formula_neighbor_item_ids
from services.rendering.source.preparation.bbox_text_strip_policy_adapter import has_formula_region
from services.rendering.source.preparation.bbox_text_strip_policy_adapter import should_strip_item_text


def iter_strip_item_rects_for_page(page: fitz.Page, translated_items: list[dict]) -> Iterator[tuple[dict, fitz.Rect]]:
    skip_item_ids = formula_neighbor_item_ids(translated_items)
    for item in translated_items:
        if not should_strip_item_text(item, skip_item_ids=skip_item_ids):
            continue
        rect = ocr_bbox_to_pdf_rect(page, item.get("bbox", []))
        if rect is not None:
            yield item, rect


def iter_formula_item_rects_for_page(page: fitz.Page, translated_items: list[dict]) -> Iterator[tuple[dict, fitz.Rect]]:
    for item in translated_items:
        if not has_formula_region(item):
            continue
        rect = ocr_bbox_to_pdf_rect(page, item.get("bbox", []))
        if rect is not None:
            yield item, rect


def build_source_item_rects(translated_items: list[dict]) -> list[fitz.Rect]:
    rects: list[fitz.Rect] = []
    for item in translated_items:
        if not should_strip_item_text(item, skip_item_ids=None):
            continue
        bbox = item.get("bbox", [])
        if len(bbox) != 4:
            continue
        rect = fitz.Rect(to_float(bbox[0]), to_float(bbox[1]), to_float(bbox[2]), to_float(bbox[3]))
        if not rect.is_empty:
            rects.append(rect)
    return merge_rects(rects)
