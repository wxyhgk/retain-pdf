from __future__ import annotations

from dataclasses import replace
from pathlib import Path
import time

from retainpdf_pipeline.foundation.config import layout
from retainpdf_pipeline.render.source_cleanup.types import BBoxTextStripCandidates
from retainpdf_pipeline.render.source_cleanup.types import BBoxTextStripResult
from retainpdf_pipeline.render.source_cleanup.contracts import SourceCleanupRequest
from retainpdf_pipeline.render.source_cleanup.contracts import SourceCleanupResult
from retainpdf_pipeline.render.source_cleanup.pdf.document import strip_bbox_text_rects_from_pdf_copy
from retainpdf_pipeline.render.source_cleanup.planning.planner import plan_source_cleanup


def execute_source_cleanup(request: SourceCleanupRequest) -> SourceCleanupResult:
    if not request.translated_pages or not layout.use_bbox_text_strip_cleanup(request.options.strategy):
        return SourceCleanupResult(bbox_text_strip=BBoxTextStripResult(changed=False, candidates=request.candidates))

    candidates = request.candidates or plan_source_cleanup(
        source_pdf_path=request.source_pdf_path,
        translated_pages=request.translated_pages,
        protected_pages=request.protected_pages,
        skip_formula_pages=request.options.skip_formula_pages,
        skip_form_xobject_pages=request.options.skip_form_xobject_pages,
        document_analysis=request.document_analysis,
    )
    print(
        "source cleanup: bbox candidates "
        f"source={candidates.candidate_source} pages={len(candidates.page_rects)} "
        f"skipped_complex={candidates.pages_skipped_complex} "
        f"skipped_visual_background={candidates.pages_skipped_visual_background} "
        f"skipped_form_xobject={candidates.pages_skipped_form_xobject} "
        f"strip_no_effect={candidates.pages_strip_no_effect}",
        flush=True,
    )
    result = build_bbox_text_stripped_pdf_copy(
        source_pdf_path=request.source_pdf_path,
        output_pdf_path=request.output_pdf_path,
        translated_pages=request.translated_pages,
        candidates=candidates,
        recurse_forms=request.options.recurse_forms,
        skip_form_xobject_pages=request.options.skip_form_xobject_pages,
        skip_formula_pages=request.options.skip_formula_pages,
        max_elapsed_seconds=request.options.max_elapsed_seconds,
    )
    result = replace(result, candidates=_candidates_with_runtime_metadata(candidates, result))
    return SourceCleanupResult(bbox_text_strip=result)


def build_bbox_text_stripped_pdf_copy(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    protected_pages: dict[int, list[dict]] | None = None,
    candidates: BBoxTextStripCandidates | None = None,
    recurse_forms: bool | None = None,
    skip_form_xobject_pages: bool = False,
    skip_formula_pages: bool = False,
    max_elapsed_seconds: float | None = None,
) -> BBoxTextStripResult:
    if not translated_pages:
        return BBoxTextStripResult(changed=False)

    candidate_started = time.perf_counter()
    candidates = candidates or plan_source_cleanup(
        source_pdf_path=source_pdf_path,
        translated_pages=translated_pages,
        protected_pages=protected_pages,
        skip_formula_pages=skip_formula_pages,
        skip_form_xobject_pages=skip_form_xobject_pages,
    )
    page_rects = candidates.fitz_page_rects()
    page_protected_rects = candidates.fitz_page_protected_rects()
    skipped_complex = candidates.pages_skipped_complex
    skipped_no_text_overlap = candidates.pages_skipped_no_text_overlap
    skipped_visual_background = candidates.pages_skipped_visual_background
    skipped_complex_page_indices = candidates.skipped_complex_page_indices
    skipped_no_text_overlap_page_indices = candidates.skipped_no_text_overlap_page_indices
    skipped_visual_background_page_indices = candidates.skipped_visual_background_page_indices
    skipped_form_xobject_page_indices = candidates.skipped_form_xobject_page_indices
    strip_no_effect_page_indices = candidates.strip_no_effect_page_indices
    candidate_elapsed = time.perf_counter() - candidate_started

    if not page_rects:
        return BBoxTextStripResult(
            changed=False,
            candidates=candidates,
            pages_skipped_complex=skipped_complex,
            pages_skipped_no_text_overlap=skipped_no_text_overlap,
            pages_skipped_visual_background=skipped_visual_background,
            pages_skipped_form_xobject=len(skipped_form_xobject_page_indices),
            pages_strip_no_effect=len(strip_no_effect_page_indices),
            skipped_complex_page_indices=frozenset(skipped_complex_page_indices),
            skipped_no_text_overlap_page_indices=frozenset(skipped_no_text_overlap_page_indices),
            skipped_visual_background_page_indices=frozenset(skipped_visual_background_page_indices),
            skipped_form_xobject_page_indices=frozenset(skipped_form_xobject_page_indices),
            strip_no_effect_page_indices=frozenset(strip_no_effect_page_indices),
        )

    result = strip_bbox_text_rects_from_pdf_copy(
        source_pdf_path=source_pdf_path,
        output_pdf_path=output_pdf_path,
        page_rects=page_rects,
        page_protected_rects=page_protected_rects,
        recurse_forms=recurse_forms,
        skip_form_xobject_pages=skip_form_xobject_pages,
        skipped_complex=skipped_complex,
        skipped_no_text_overlap=skipped_no_text_overlap,
        skipped_visual_background=skipped_visual_background,
        skipped_complex_page_indices=skipped_complex_page_indices,
        skipped_no_text_overlap_page_indices=skipped_no_text_overlap_page_indices,
        skipped_visual_background_page_indices=skipped_visual_background_page_indices,
        pre_skipped_form_xobject_page_indices=skipped_form_xobject_page_indices,
        pre_strip_no_effect_page_indices=strip_no_effect_page_indices,
        candidate_elapsed=candidate_elapsed,
        candidate_source=candidates.candidate_source,
        max_elapsed_seconds=max_elapsed_seconds,
    )
    return replace(result, candidates=_candidates_with_runtime_metadata(candidates, result))


def _candidates_with_runtime_metadata(
    candidates: BBoxTextStripCandidates,
    result: BBoxTextStripResult,
) -> BBoxTextStripCandidates:
    return replace(
        candidates,
        pages_skipped_form_xobject=result.pages_skipped_form_xobject,
        pages_strip_no_effect=result.pages_strip_no_effect,
        skipped_form_xobject_page_indices=result.skipped_form_xobject_page_indices,
        strip_no_effect_page_indices=result.strip_no_effect_page_indices,
    )
