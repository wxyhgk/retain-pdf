from __future__ import annotations

from pathlib import Path

from retainpdf_pipeline.render.analysis.document import build_render_document_analysis
from retainpdf_pipeline.render.contracts import RenderDocumentAnalysis


def resolve_cached_workflow_document_analysis(
    *,
    render_source_pdf,
    payload_prewarm,
) -> RenderDocumentAnalysis | None:
    if payload_prewarm is not None and payload_prewarm.document_analysis is not None:
        return payload_prewarm.document_analysis
    if render_source_pdf is not None and render_source_pdf.document_analysis is not None:
        return render_source_pdf.document_analysis
    return None


def build_sync_workflow_document_analysis(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    start_page: int,
    end_page: int,
) -> RenderDocumentAnalysis:
    return build_render_document_analysis(
        source_pdf_path=source_pdf_path,
        translated_pages=translated_pages,
        start_page=start_page,
        end_page=end_page,
    )


def document_analysis_prewarm_hit(*, render_source_pdf, payload_prewarm) -> bool:
    return (
        (payload_prewarm is not None and payload_prewarm.document_analysis is not None)
        or (render_source_pdf is not None and render_source_pdf.document_analysis is not None)
    )


def document_analysis_diagnostics(document_analysis: RenderDocumentAnalysis | None) -> dict[str, object]:
    return {
        "render_page_route_counts": document_analysis.route_reason_counts if document_analysis is not None else {},
    }
