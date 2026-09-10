from __future__ import annotations

from pathlib import Path
import math

import fitz
from retainpdf_pipeline.render.analysis.profile.builder import build_render_page_profile
from retainpdf_pipeline.render.contracts import RenderDocumentAnalysis


def is_pseudo_editable_scan_pdf(doc: fitz.Document, start_page: int, end_page: int) -> bool:
    sample_pages = range(start_page, min(end_page, start_page + 2) + 1)
    sampled = 0
    pseudo_scan_pages = 0
    for page_idx in sample_pages:
        if 0 <= page_idx < len(doc):
            sampled += 1
            if build_render_page_profile(doc[page_idx]).kind == "pseudo_editable_scan":
                pseudo_scan_pages += 1
    return sampled > 0 and pseudo_scan_pages >= max(1, math.ceil(sampled / 2))


def is_pseudo_editable_scan_analysis(analysis: RenderDocumentAnalysis) -> bool:
    pages = list(analysis.pages.values())[:3]
    sampled = len(pages)
    pseudo_scan_pages = sum(1 for page in pages if page.kind == "pseudo_editable_scan")
    return sampled > 0 and pseudo_scan_pages >= max(1, math.ceil(sampled / 2))


def is_editable_analysis(analysis: RenderDocumentAnalysis) -> bool:
    pages = list(analysis.pages.values())[:3]
    sampled = len(pages)
    editable_pages = sum(1 for page in pages if page.editable_text and page.kind == "editable_text")
    pseudo_scan_pages = sum(1 for page in pages if page.kind == "pseudo_editable_scan")
    if sampled == 0 or pseudo_scan_pages >= sampled:
        return False
    return editable_pages >= max(1, math.ceil(sampled / 2))


def is_editable_pdf(doc: fitz.Document, start_page: int, end_page: int) -> bool:
    sample_pages = range(start_page, min(end_page, start_page + 2) + 1)
    sampled = 0
    editable_pages = 0
    pseudo_scan_pages = 0
    for page_idx in sample_pages:
        if 0 <= page_idx < len(doc):
            sampled += 1
            profile = build_render_page_profile(doc[page_idx])
            if profile.kind == "pseudo_editable_scan":
                pseudo_scan_pages += 1
            if profile.text_layer.editable and profile.kind == "editable_text":
                editable_pages += 1
    if sampled == 0:
        return False
    if pseudo_scan_pages >= sampled:
        return False
    return editable_pages >= max(1, math.ceil(sampled / 2))


def resolve_effective_render_mode(
    *,
    render_mode: str,
    source_pdf_path: Path,
    start_page: int,
    end_page: int,
    translated_pages_map: dict[int, list[dict]] | None = None,
    document_analysis: RenderDocumentAnalysis | None = None,
) -> str:
    if render_mode != "auto":
        return render_mode

    if not translated_pages_map:
        print("auto render mode selected: overlay (no translated pages map)")
        return "overlay"

    if document_analysis is not None:
        if is_pseudo_editable_scan_analysis(document_analysis):
            print(
                "auto render mode selected: typst_visual "
                "(pseudo-editable scan or tiled image background PDF)"
            )
            return "typst_visual"
        if not is_editable_analysis(document_analysis):
            print("auto render mode selected: typst_visual (non-editable PDF)")
            return "typst_visual"
        print("auto render mode selected: overlay (editable PDF default route)")
        return "overlay"

    doc = fitz.open(source_pdf_path)
    try:
        total_pages = len(doc)
        sample_stop = total_pages - 1 if end_page < 0 else min(end_page, total_pages - 1)
        if is_pseudo_editable_scan_pdf(doc, start_page, sample_stop):
            print(
                "auto render mode selected: typst_visual "
                "(pseudo-editable scan or tiled image background PDF)"
            )
            return "typst_visual"
        editable = is_editable_pdf(doc, start_page, sample_stop)
        if not editable:
            print("auto render mode selected: typst_visual (non-editable PDF)")
            return "typst_visual"
    finally:
        doc.close()

    print("auto render mode selected: overlay (editable PDF default route)")
    return "overlay"
