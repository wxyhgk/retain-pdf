from __future__ import annotations

from pathlib import Path

import fitz

from retainpdf_pipeline.render.layout.typography.geometry import cover_bbox
from retainpdf_pipeline.render.policy import item_overlay_fill
from retainpdf_pipeline.render.semantics.item_view import (
    is_document_title,
    source_item_kind,
)
from retainpdf_pipeline.render.source.background.fill import (
    LocalBackgroundSampler,
    sample_local_background_fill,
)
from retainpdf_pipeline.render.visual_profile.contracts import (
    VISUAL_PROFILE_ALGORITHM_VERSION,
    DocumentVisualProfile,
    ItemVisualProfile,
    PageVisualProfile,
)
from retainpdf_pipeline.render.visual_profile.foreground import (
    sample_foreground_color_from_pixels,
    text_color_for_background,
)
from retainpdf_pipeline.render.visual_profile.text_spans import (
    PageSpanColorSampler,
)

DEFAULT_PAGE_BACKGROUND = (1.0, 1.0, 1.0)


def build_document_visual_profile(
    source_pdf_path: Path,
    pages: dict[int, list[dict]],
) -> DocumentVisualProfile:
    doc = fitz.open(source_pdf_path)
    try:
        page_profiles: dict[int, PageVisualProfile] = {}
        for page_index, items in pages.items():
            if 0 <= page_index < len(doc):
                page_profiles[page_index] = build_page_visual_profile(doc[page_index], page_index, items)
        return DocumentVisualProfile(
            algorithm=VISUAL_PROFILE_ALGORITHM_VERSION,
            pages=page_profiles,
        )
    finally:
        doc.close()


def build_page_visual_profile(
    page: fitz.Page,
    page_index: int,
    items: list[dict],
) -> PageVisualProfile:
    item_rects = _item_rects(items)
    background_rects = [
        rect
        for item in items
        if _item_needs_visual_profile_background(item)
        for rect in [item_rects.get(str(item.get("item_id") or ""))]
        if rect is not None
    ]
    background_sampler = (
        LocalBackgroundSampler.build(page, background_rects)
        if background_rects
        else None
    )
    span_sampler = PageSpanColorSampler.build(page) if _page_needs_span_text_color(items) else None
    page_background = DEFAULT_PAGE_BACKGROUND
    profiles: dict[str, ItemVisualProfile] = {}

    for item in items:
        item_id = str(item.get("item_id") or "")
        if not item_id:
            continue
        rect = item_rects.get(item_id)
        if rect is None:
            profiles[item_id] = ItemVisualProfile(
                item_id=item_id,
                page_index=page_index,
                bbox=(0.0, 0.0, 0.0, 0.0),
                bbox_space="page_pt",
                bbox_source="missing_bbox",
                source_item_kind=_source_item_kind(item),
                background_rgb=page_background,
                text_rgb=text_color_for_background(page_background),
                confidence=0.1,
                method="page_fallback",
                warnings=("missing_bbox",),
            )
            continue
        profiles[item_id] = _sample_item_profile(
            page=page,
            page_index=page_index,
            item=item,
            item_id=item_id,
            rect=rect,
            background_sampler=background_sampler,
            span_sampler=span_sampler,
        )

    return PageVisualProfile(
        page_index=page_index,
        background_rgb=page_background,
        items=profiles,
    )


def _sample_item_profile(
    *,
    page: fitz.Page,
    page_index: int,
    item: dict,
    item_id: str,
    rect: fitz.Rect,
    background_sampler: LocalBackgroundSampler | None,
    span_sampler: PageSpanColorSampler | None,
) -> ItemVisualProfile:
    should_sample_background = _item_needs_visual_profile_background(item)
    background = (
        sample_local_background_fill(page, rect, sampler=background_sampler)
        if should_sample_background
        else DEFAULT_PAGE_BACKGROUND
    )
    warnings: list[str] = []
    method_parts: list[str] = ["background_pixels" if should_sample_background else "background_default"]
    confidence = 0.55
    if not should_sample_background:
        warnings.append("background_pixel_probe_skipped")

    should_sample_text_color = _item_needs_span_text_color(item, should_sample_background=should_sample_background)
    text_color = (
        span_sampler.sample_text_color(rect, background)
        if should_sample_text_color and span_sampler is not None
        else None
    )
    if text_color is not None:
        method_parts.append("span_color")
        confidence = 0.86
    elif _is_document_title(item):
        sampled_color, sampled_confidence = sample_foreground_color_from_pixels(page, rect, background)
        if sampled_color is not None:
            text_color = sampled_color
            method_parts.append("foreground_pixels")
            confidence = max(confidence, sampled_confidence)
        else:
            text_color = text_color_for_background(background)
            method_parts.append("contrast_fallback")
            confidence = min(confidence, 0.35)
            warnings.append("foreground_not_detected")
    else:
        text_color = text_color_for_background(background)
        method_parts.append("contrast_fallback")
        confidence = min(confidence, 0.45)
        warnings.append("foreground_pixel_probe_skipped")

    return ItemVisualProfile(
        item_id=item_id,
        page_index=page_index,
        bbox=(float(rect.x0), float(rect.y0), float(rect.x1), float(rect.y1)),
        bbox_space="page_pt",
        bbox_source="render_cover_bbox",
        source_item_kind=_source_item_kind(item),
        background_rgb=background,
        text_rgb=text_color,
        confidence=round(confidence, 4),
        method="+".join(method_parts),
        warnings=tuple(warnings),
    )


def _item_rects(items: list[dict]) -> dict[str, fitz.Rect]:
    rects: dict[str, fitz.Rect] = {}
    for item in items:
        item_id = str(item.get("item_id") or "")
        if not item_id:
            continue
        bbox = cover_bbox(item)
        if len(bbox) != 4:
            continue
        rect = fitz.Rect(bbox)
        if rect.is_empty or rect.is_infinite:
            continue
        rects[item_id] = rect
    return rects


def _item_needs_visual_profile_background(item: dict) -> bool:
    if _is_document_title(item):
        return True
    if item_overlay_fill(item) == "sampled":
        return True
    return bool(item.get("_render_use_cover_fill"))


def _page_needs_span_text_color(items: list[dict]) -> bool:
    return any(
        _item_needs_span_text_color(
            item,
            should_sample_background=_item_needs_visual_profile_background(item),
        )
        for item in items
    )


def _item_needs_span_text_color(item: dict, *, should_sample_background: bool) -> bool:
    return should_sample_background or _is_document_title(item)


def _is_document_title(item: dict) -> bool:
    return is_document_title(item)


def _source_item_kind(item: dict) -> str:
    return source_item_kind(item)
