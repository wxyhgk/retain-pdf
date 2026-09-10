from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from retainpdf_pipeline.render.contracts import RenderDocumentAnalysis
from retainpdf_pipeline.render.source_cleanup.types import BBoxTextStripCandidates
from retainpdf_pipeline.render.source_cleanup.types import BBoxTextStripResult


@dataclass(frozen=True)
class SourceCleanupOptions:
    strategy: str = "pikepdf_text_strip"
    skip_formula_pages: bool = False
    recurse_forms: bool | None = None
    skip_form_xobject_pages: bool = False
    max_elapsed_seconds: float | None = None


@dataclass(frozen=True)
class SourceCleanupRequest:
    source_pdf_path: Path
    output_pdf_path: Path
    translated_pages: dict[int, list[dict]]
    protected_pages: dict[int, list[dict]] | None = None
    options: SourceCleanupOptions = SourceCleanupOptions()
    candidates: BBoxTextStripCandidates | None = None
    document_analysis: RenderDocumentAnalysis | None = None


@dataclass(frozen=True)
class SourceCleanupResult:
    bbox_text_strip: BBoxTextStripResult

    @property
    def changed(self) -> bool:
        return self.bbox_text_strip.changed

    @property
    def output_pdf_path(self) -> Path | None:
        return self.bbox_text_strip.output_pdf_path

    @property
    def candidates(self) -> BBoxTextStripCandidates | None:
        return self.bbox_text_strip.candidates

    @property
    def changed_page_indices(self) -> frozenset[int]:
        return self.bbox_text_strip.changed_page_indices

    @property
    def skipped_page_indices(self) -> frozenset[int]:
        return (
            self.bbox_text_strip.skipped_complex_page_indices
            | self.bbox_text_strip.skipped_no_text_overlap_page_indices
            | self.bbox_text_strip.skipped_visual_background_page_indices
            | self.bbox_text_strip.skipped_form_xobject_page_indices
            | self.bbox_text_strip.strip_no_effect_page_indices
        )
