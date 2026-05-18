from __future__ import annotations

from pathlib import Path
import time

from services.rendering.source.preparation.bbox_text_strip_candidates import build_bbox_text_strip_candidates
from services.rendering.source.preparation.bbox_text_strip_document import strip_bbox_text_rects_from_pdf_copy
from services.rendering.source.preparation.bbox_text_strip_types import BBoxTextStripCandidates
from services.rendering.source.preparation.bbox_text_strip_types import BBoxTextStripResult


def build_bbox_text_stripped_pdf_copy(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    candidates: BBoxTextStripCandidates | None = None,
    recurse_forms: bool | None = None,
    skip_formula_pages: bool = True,
) -> BBoxTextStripResult:
    if not translated_pages:
        return BBoxTextStripResult(changed=False)

    candidate_started = time.perf_counter()
    candidates = candidates or build_bbox_text_strip_candidates(
        source_pdf_path=source_pdf_path,
        translated_pages=translated_pages,
        skip_formula_pages=skip_formula_pages,
    )
    page_rects = candidates.fitz_page_rects()
    page_protected_rects = candidates.fitz_page_protected_rects()
    skipped_complex = candidates.pages_skipped_complex
    skipped_no_text_overlap = candidates.pages_skipped_no_text_overlap
    skipped_complex_page_indices = candidates.skipped_complex_page_indices
    skipped_no_text_overlap_page_indices = candidates.skipped_no_text_overlap_page_indices
    candidate_elapsed = time.perf_counter() - candidate_started

    if not page_rects:
        return BBoxTextStripResult(
            changed=False,
            pages_skipped_complex=skipped_complex,
            pages_skipped_no_text_overlap=skipped_no_text_overlap,
            skipped_complex_page_indices=frozenset(skipped_complex_page_indices),
            skipped_no_text_overlap_page_indices=frozenset(skipped_no_text_overlap_page_indices),
        )

    return strip_bbox_text_rects_from_pdf_copy(
        source_pdf_path=source_pdf_path,
        output_pdf_path=output_pdf_path,
        page_rects=page_rects,
        page_protected_rects=page_protected_rects,
        recurse_forms=recurse_forms,
        skipped_complex=skipped_complex,
        skipped_no_text_overlap=skipped_no_text_overlap,
        skipped_complex_page_indices=skipped_complex_page_indices,
        skipped_no_text_overlap_page_indices=skipped_no_text_overlap_page_indices,
        candidate_elapsed=candidate_elapsed,
    )
