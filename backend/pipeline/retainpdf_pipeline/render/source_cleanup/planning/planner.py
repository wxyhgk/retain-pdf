from __future__ import annotations

from pathlib import Path

import fitz

from retainpdf_pipeline.render.contracts import RenderDocumentAnalysis
from retainpdf_pipeline.render.source_cleanup.planning.accumulator import BBoxTextStripCandidateAccumulator
from retainpdf_pipeline.render.source_cleanup.planning.geometry import formula_guard_rects
from retainpdf_pipeline.render.source_cleanup.planning.geometry import ocr_bbox_to_pdf_rect
from retainpdf_pipeline.render.source_cleanup.planning.item_classifier import item_allows_item_cover_fallback
from retainpdf_pipeline.render.source_cleanup.planning.items import build_source_item_rects
from retainpdf_pipeline.render.source_cleanup.planning.items import iter_formula_item_rects_for_page
from retainpdf_pipeline.render.source_cleanup.planning.items import iter_strip_item_rect_pairs_for_page
from retainpdf_pipeline.render.source_cleanup.planning.items import iter_strip_item_rects_for_page
from retainpdf_pipeline.render.source_cleanup.planning.items import item_should_emit_strip_rect
from retainpdf_pipeline.render.source_cleanup.planning.page_gate import bbox_text_strip_items_skip_reason
from retainpdf_pipeline.render.source_cleanup.planning.rect_filter import rect_overlaps_any_unsafe_vector
from retainpdf_pipeline.render.source_cleanup.planning.rects import merge_rects
from retainpdf_pipeline.render.source_cleanup.planning.coordinate_resolver import PageBBoxResolver
from retainpdf_pipeline.render.source_cleanup.planning.page_probe import page_has_form_xobjects
from retainpdf_pipeline.render.source_cleanup.planning.page_probe import page_content_stream_too_large
from retainpdf_pipeline.render.source_cleanup.planning.page_features import PageCleanupFeatures
from retainpdf_pipeline.render.source_cleanup.planning.page_features import build_page_cleanup_features
from retainpdf_pipeline.render.source_cleanup.pdf.constants import BBOX_TEXT_STRIP_CONTENT_STREAM_SIZE_THRESHOLD
from retainpdf_pipeline.render.source_cleanup.types import BBOX_TEXT_STRIP_PAGE_SKIP_NONE
from retainpdf_pipeline.render.source_cleanup.types import BBOX_TEXT_STRIP_PAGE_SKIP_COMPLEX
from retainpdf_pipeline.render.source_cleanup.types import BBOX_TEXT_STRIP_PAGE_SKIP_NO_TEXT_OVERLAP
from retainpdf_pipeline.render.source_cleanup.types import BBOX_TEXT_STRIP_PAGE_SKIP_VISUAL_BACKGROUND
from retainpdf_pipeline.render.source_cleanup.types import BBoxTextStripCandidates
from retainpdf_pipeline.render.source_cleanup.types import BBoxTextStripPagePlan
from retainpdf_pipeline.render.source_cleanup.planning.segments import strip_segments_for_text_rect


def plan_source_cleanup(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    protected_pages: dict[int, list[dict]] | None = None,
    skip_formula_pages: bool = False,
    skip_form_xobject_pages: bool = True,
    document_analysis: RenderDocumentAnalysis | None = None,
    pdf_structure_profile=None,
) -> BBoxTextStripCandidates:
    accumulator = BBoxTextStripCandidateAccumulator()
    doc = fitz.open(source_pdf_path)
    try:
        protected_pages = protected_pages or {}
        for page_idx, items in translated_pages.items():
            if page_idx < 0 or page_idx >= len(doc):
                continue
            page = doc[page_idx]
            features = build_page_cleanup_features(doc, page)
            accumulator.add_page_features(page_idx, features)
            page_plan = plan_source_cleanup_page(
                doc,
                page,
                translated_items=items,
                protected_items=protected_pages.get(page_idx, []),
                skip_formula_pages=skip_formula_pages,
                skip_form_xobject_pages=skip_form_xobject_pages,
                features=features,
                document_analysis=document_analysis,
            )
            accumulator.add_page_plan(page_idx, page_plan)
    finally:
        doc.close()
    return accumulator.build()


def plan_source_cleanup_page(
    doc: fitz.Document,
    page: fitz.Page,
    *,
    translated_items: list[dict],
    protected_items: list[dict] | None = None,
    skip_formula_pages: bool = False,
    skip_form_xobject_pages: bool = True,
    features: PageCleanupFeatures | None = None,
    document_analysis: RenderDocumentAnalysis | None = None,
) -> BBoxTextStripPagePlan:
    if document_analysis is not None:
        route = document_analysis.page(page.number)
        if route is not None and not route.allows_pikepdf_text_strip:
            return BBoxTextStripPagePlan(skip_reason=BBOX_TEXT_STRIP_PAGE_SKIP_VISUAL_BACKGROUND)
    items_skip_reason = bbox_text_strip_items_skip_reason(
        translated_items,
        skip_formula_pages=skip_formula_pages,
    )
    if items_skip_reason != BBOX_TEXT_STRIP_PAGE_SKIP_NONE:
        return BBoxTextStripPagePlan(skip_reason=items_skip_reason)
    strip_items = [item for item in translated_items if item_should_emit_strip_rect(item)]
    if not strip_items:
        return BBoxTextStripPagePlan()
    page_features = features or build_page_cleanup_features(doc, page)
    if page_features.content_stream_size >= BBOX_TEXT_STRIP_CONTENT_STREAM_SIZE_THRESHOLD:
        return BBoxTextStripPagePlan(skip_reason=BBOX_TEXT_STRIP_PAGE_SKIP_COMPLEX)
    if skip_form_xobject_pages and page_features.has_form_xobjects:
        return _plan_form_xobject_page(
            page,
            translated_items=translated_items,
            strip_items=strip_items,
            protected_items=protected_items or [],
        )

    resolver = PageBBoxResolver.build(page, bboxes=[item.get("bbox", []) for item in strip_items])
    strip_pairs = list(iter_strip_item_rect_pairs_for_page(page, strip_items, resolver=resolver, prefiltered=True))
    item_view_rects = merge_rects([pair.view_rect for pair in strip_pairs if not pair.view_rect.is_empty])
    if not item_view_rects:
        return BBoxTextStripPagePlan()
    if not resolver.text_index.overlaps_any(item_view_rects):
        return BBoxTextStripPagePlan(skip_reason=BBOX_TEXT_STRIP_PAGE_SKIP_NO_TEXT_OVERLAP)
    if resolver.has_large_background_image():
        return BBoxTextStripPagePlan(skip_reason=BBOX_TEXT_STRIP_PAGE_SKIP_VISUAL_BACKGROUND)

    formula_rects = [rect for _item, rect in iter_formula_item_rects_for_page(page, translated_items)]
    source_protected_rects = [rect for _item, rect in iter_protected_item_rects_for_page(page, protected_items or [])]
    source_strip_rects = merge_rects([pair.pdf_rect for pair in strip_pairs])
    strip_rects = _build_page_strip_rects_from_pairs(
        strip_pairs,
        formula_rects=formula_rects,
        unsafe_rects=resolver.unsafe_vector_index,
    )
    protected_rects = merge_rects(
        [
            *build_formula_guard_rects(formula_rects, strip_rects=source_strip_rects),
            *source_protected_rects,
        ]
    )
    return BBoxTextStripPagePlan(
        strip_rects=tuple(strip_rects),
        protected_rects=tuple(protected_rects),
        uncovered_unsafe_vector_item_ids=uncovered_unsafe_vector_item_ids(
            strip_pairs,
            unsafe_rects=resolver.unsafe_vector_index,
        ),
    )


def build_page_strip_rects_for_page(
    page: fitz.Page,
    *,
    translated_items: list[dict],
) -> list[fitz.Rect]:
    protected_formula_rects = build_page_formula_rects_for_page(page, translated_items=translated_items)
    resolver = PageBBoxResolver.build(page)
    strip_pairs = list(iter_strip_item_rect_pairs_for_page(page, translated_items, resolver=resolver))
    return _build_page_strip_rects_from_pairs(
        strip_pairs,
        formula_rects=protected_formula_rects,
        unsafe_rects=resolver.unsafe_vector_index,
    )


def _build_page_strip_rects_from_pairs(
    strip_pairs: list,
    *,
    formula_rects: list[fitz.Rect],
    unsafe_rects,
) -> list[fitz.Rect]:
    rects: list[fitz.Rect] = []
    for pair in strip_pairs:
        rects.extend(strip_segments_for_text_rect(pair.pdf_rect, formula_rects))
    return merge_rects(rects)


def _plan_form_xobject_page(
    page: fitz.Page,
    *,
    translated_items: list[dict],
    strip_items: list[dict],
    protected_items: list[dict] | None = None,
) -> BBoxTextStripPagePlan:
    formula_rects = [rect for _item, rect in iter_formula_item_rects_for_page(page, translated_items)]
    source_strip_rects = [
        rect
        for item in strip_items
        if (rect := ocr_bbox_to_pdf_rect(page, item.get("bbox", []))) is not None
    ]
    strip_rects = merge_rects(
        segment
        for rect in source_strip_rects
        for segment in strip_segments_for_text_rect(rect, formula_rects)
    )
    protected_rects = merge_rects(
        [
            *build_formula_guard_rects(formula_rects, strip_rects=merge_rects(source_strip_rects)),
            *(rect for _item, rect in iter_protected_item_rects_for_page(page, protected_items or [])),
        ]
    )
    return BBoxTextStripPagePlan(
        strip_rects=tuple(strip_rects),
        protected_rects=tuple(protected_rects),
    )


def iter_protected_item_rects_for_page(page: fitz.Page, protected_items: list[dict]):
    resolver = PageBBoxResolver.build(page, bboxes=[item.get("bbox", []) for item in protected_items])
    for item in protected_items:
        rect = resolver.ocr_bbox_to_pdf_rect(item.get("bbox", []))
        if rect is not None:
            yield item, rect


def item_ids_with_uncovered_unsafe_vector_overlap(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
) -> frozenset[str]:
    item_ids: set[str] = set()
    doc = fitz.open(source_pdf_path)
    try:
        for page_idx, items in translated_pages.items():
            if page_idx < 0 or page_idx >= len(doc):
                continue
            item_ids.update(page_uncovered_unsafe_vector_item_ids(doc[page_idx], items))
    finally:
        doc.close()
    return frozenset(item_ids)


def page_uncovered_unsafe_vector_item_ids(page: fitz.Page, translated_items: list[dict]) -> frozenset[str]:
    strip_items = [item for item in translated_items if item_should_emit_strip_rect(item)]
    if not strip_items:
        return frozenset()
    resolver = PageBBoxResolver.build(page, bboxes=[item.get("bbox", []) for item in strip_items])
    return uncovered_unsafe_vector_item_ids(
        iter_strip_item_rect_pairs_for_page(page, strip_items, resolver=resolver, prefiltered=True),
        unsafe_rects=resolver.unsafe_vector_index,
    )


def uncovered_unsafe_vector_item_ids(strip_pairs, *, unsafe_rects) -> frozenset[str]:
    if not unsafe_rects.rects:
        return frozenset()
    item_ids: set[str] = set()
    for pair in strip_pairs:
        item_id = str(pair.item.get("item_id") or "").strip()
        if not item_id:
            continue
        if not item_allows_item_cover_fallback(pair.item):
            continue
        if pair_overlaps_unsafe_vector(pair, unsafe_rects):
            item_ids.add(item_id)
    return frozenset(item_ids)


def pair_overlaps_unsafe_vector(pair, unsafe_rects) -> bool:
    probe_rects = tuple(getattr(pair, "probe_rects", ()) or (pair.view_rect,))
    return any(rect_overlaps_any_unsafe_vector(rect, unsafe_rects) for rect in probe_rects)


def build_page_formula_rects_for_page(
    page: fitz.Page,
    *,
    translated_items: list[dict],
) -> list[fitz.Rect]:
    return [rect for _item, rect in iter_formula_item_rects_for_page(page, translated_items)]


def build_formula_guard_rects(
    formula_rects: list[fitz.Rect],
    *,
    strip_rects: list[fitz.Rect] | None = None,
) -> list[fitz.Rect]:
    return formula_guard_rects(formula_rects, strip_rects=strip_rects)


def build_page_strip_source_rects_for_page(page: fitz.Page, *, translated_items: list[dict]) -> list[fitz.Rect]:
    return merge_rects([rect for _item, rect in iter_strip_item_rects_for_page(page, translated_items)])
