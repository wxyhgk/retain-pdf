from __future__ import annotations

from pathlib import Path

import fitz

from retainpdf_pipeline.render.analysis.document.models import RenderDocumentAnalysis
from retainpdf_pipeline.render.analysis.document.models import RenderPageAnalysis
from retainpdf_pipeline.render.analysis.profile.builder import build_render_page_profile
from retainpdf_pipeline.render.analysis.profile.models import RenderPageProfile
from retainpdf_pipeline.render.analysis.route.builder import build_render_page_route
from retainpdf_pipeline.render.semantics.page_range import resolve_page_range


def build_render_document_analysis(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]] | None = None,
    start_page: int = 0,
    end_page: int = -1,
) -> RenderDocumentAnalysis:
    doc = fitz.open(source_pdf_path)
    try:
        if not doc:
            return RenderDocumentAnalysis(pages={})
        selected_pages = _selected_page_indices(
            page_count=len(doc),
            translated_pages=translated_pages,
            start_page=start_page,
            end_page=end_page,
        )
        pages = {
            page_idx: build_render_page_analysis(
                build_render_page_profile(
                    doc[page_idx],
                    ocr_items=(translated_pages or {}).get(page_idx),
                )
            )
            for page_idx in selected_pages
        }
        return RenderDocumentAnalysis(pages=pages)
    finally:
        doc.close()


def build_render_page_analysis(profile: RenderPageProfile) -> RenderPageAnalysis:
    route = build_render_page_route(profile)
    return RenderPageAnalysis(
        page_index=profile.geometry.page_index,
        kind=profile.kind,
        redaction=route.redaction,
        background=route.background,
        compose=route.compose,
        layout=route.layout,
        reason=route.reason,
        has_large_background=profile.image_background.has_large_background,
        background_coverage_ratio=profile.image_background.coverage_ratio,
        visible_text=profile.text_layer.has_visible_text,
        hidden_text=profile.text_layer.has_hidden_text,
        editable_text=profile.text_layer.editable,
        drawing_count=profile.vector_layer.drawing_count,
        vector_heavy=profile.vector_layer.vector_heavy,
    )


def _selected_page_indices(
    *,
    page_count: int,
    translated_pages: dict[int, list[dict]] | None,
    start_page: int,
    end_page: int,
) -> list[int]:
    if translated_pages:
        return sorted(page_idx for page_idx in translated_pages if 0 <= page_idx < page_count)
    resolved_start, resolved_stop = resolve_page_range(page_count, start_page, end_page)
    return list(range(resolved_start, resolved_stop + 1))


__all__ = [
    "build_render_document_analysis",
    "build_render_page_analysis",
]
