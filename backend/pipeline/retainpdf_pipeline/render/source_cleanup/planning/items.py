from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass

import fitz

from retainpdf_pipeline.render.source_cleanup.planning.geometry import ocr_bbox_to_pdf_rect
from retainpdf_pipeline.render.source_cleanup.planning.coordinate_resolver import PageBBoxResolver
from retainpdf_pipeline.render.source_cleanup.planning.intent_classifier import classify_source_cleanup_intent
from retainpdf_pipeline.render.source_cleanup.planning.rects import merge_rects


@dataclass(frozen=True)
class SourceCleanupItemRects:
    item: dict
    pdf_rect: fitz.Rect
    view_rect: fitz.Rect
    probe_rects: tuple[fitz.Rect, ...] = ()


def iter_strip_item_rect_pairs_for_page(
    page: fitz.Page,
    translated_items: list[dict],
    *,
    resolver: PageBBoxResolver | None = None,
    prefiltered: bool = False,
) -> Iterator[SourceCleanupItemRects]:
    active_resolver = resolver or PageBBoxResolver.build(page)
    for item in translated_items:
        if not prefiltered and not item_should_emit_strip_rect(item):
            continue
        pdf_rect = active_resolver.ocr_bbox_to_pdf_rect(item.get("bbox", []))
        view_rect = active_resolver.resolve_bbox_rect(item.get("bbox", []))
        probe_rects = active_resolver.resolve_bbox_probe_rects(item.get("bbox", []))
        if pdf_rect is not None and view_rect is not None:
            yield SourceCleanupItemRects(
                item=item,
                pdf_rect=pdf_rect,
                view_rect=view_rect,
                probe_rects=probe_rects or (view_rect,),
            )


def iter_strip_item_rects_for_page(page: fitz.Page, translated_items: list[dict]) -> Iterator[tuple[dict, fitz.Rect]]:
    for pair in iter_strip_item_rect_pairs_for_page(page, translated_items):
        yield pair.item, pair.pdf_rect


def iter_formula_item_rects_for_page(page: fitz.Page, translated_items: list[dict]) -> Iterator[tuple[dict, fitz.Rect]]:
    for item in translated_items:
        if not classify_source_cleanup_intent(item).should_protect_source:
            continue
        rect = ocr_bbox_to_pdf_rect(page, item.get("bbox", []))
        if rect is not None:
            yield item, rect


def build_source_item_rects(page: fitz.Page, translated_items: list[dict]) -> list[fitz.Rect]:
    rects: list[fitz.Rect] = []
    for pair in iter_strip_item_rect_pairs_for_page(page, translated_items):
        if not pair.view_rect.is_empty:
            rects.append(pair.view_rect)
    return merge_rects(rects)


def item_should_emit_strip_rect(item: dict) -> bool:
    return classify_source_cleanup_intent(item).should_strip_text
