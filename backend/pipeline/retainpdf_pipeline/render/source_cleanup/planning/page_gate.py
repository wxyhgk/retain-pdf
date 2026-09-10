from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import fitz

from retainpdf_pipeline.render.source_cleanup.planning.page_probe import page_content_stream_too_large
from retainpdf_pipeline.render.source_cleanup.planning.page_probe import page_has_text_overlap
from retainpdf_pipeline.render.source_cleanup.policy.adapter import should_skip_page_for_bbox_text_strip
from retainpdf_pipeline.render.source_cleanup.types import BBOX_TEXT_STRIP_PAGE_SKIP_COMPLEX
from retainpdf_pipeline.render.source_cleanup.types import BBOX_TEXT_STRIP_PAGE_SKIP_NONE
from retainpdf_pipeline.render.source_cleanup.types import BBOX_TEXT_STRIP_PAGE_SKIP_NO_TEXT_OVERLAP


PageGatePredicate = Callable[["PageGateContext"], bool]


@dataclass(frozen=True)
class PageGateContext:
    doc: fitz.Document
    page: fitz.Page
    source_item_rects: tuple[fitz.Rect, ...]
    allow_vector_overlap: bool = False


@dataclass(frozen=True)
class PageGateRule:
    name: str
    skip_reason: str
    matches: PageGatePredicate


PAGE_GATE_RULES: tuple[PageGateRule, ...] = (
    PageGateRule(
        name="large_content_stream",
        skip_reason=BBOX_TEXT_STRIP_PAGE_SKIP_COMPLEX,
        matches=lambda context: page_content_stream_too_large(context.doc, context.page),
    ),
    PageGateRule(
        name="no_text_overlap",
        skip_reason=BBOX_TEXT_STRIP_PAGE_SKIP_NO_TEXT_OVERLAP,
        matches=lambda context: not page_has_text_overlap(context.page, list(context.source_item_rects)),
    ),
)


def bbox_text_strip_items_skip_reason(
    items: list[dict],
    *,
    skip_formula_pages: bool,
) -> str:
    return (
        BBOX_TEXT_STRIP_PAGE_SKIP_COMPLEX
        if should_skip_page_for_bbox_text_strip(items, skip_formula_pages=skip_formula_pages)
        else BBOX_TEXT_STRIP_PAGE_SKIP_NONE
    )


def bbox_text_strip_page_skip_reason(
    doc: fitz.Document,
    page: fitz.Page,
    *,
    source_item_rects: list[fitz.Rect],
    allow_vector_overlap: bool = False,
) -> str:
    context = PageGateContext(
        doc=doc,
        page=page,
        source_item_rects=tuple(source_item_rects),
        allow_vector_overlap=allow_vector_overlap,
    )
    return evaluate_page_gate(context)


def evaluate_page_gate(context: PageGateContext) -> str:
    if not context.source_item_rects:
        return BBOX_TEXT_STRIP_PAGE_SKIP_NONE
    matched_rule = next((rule for rule in PAGE_GATE_RULES if rule.matches(context)), None)
    return matched_rule.skip_reason if matched_rule is not None else BBOX_TEXT_STRIP_PAGE_SKIP_NONE
