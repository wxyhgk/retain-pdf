from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
from pathlib import Path

import fitz


BBOX_TEXT_STRIP_PAGE_SKIP_NONE = "none"
BBOX_TEXT_STRIP_PAGE_SKIP_COMPLEX = "complex"
BBOX_TEXT_STRIP_PAGE_SKIP_NO_TEXT_OVERLAP = "no_text_overlap"
BBOX_TEXT_STRIP_PAGE_SKIP_VISUAL_BACKGROUND = "visual_background"
BBOX_TEXT_STRIP_CANDIDATE_SOURCE_FRESH_PLAN = "fresh_plan"
BBOX_TEXT_STRIP_CANDIDATE_SOURCE_MANIFEST = "manifest"


@dataclass(frozen=True)
class BBoxTextStripResult:
    changed: bool
    output_pdf_path: Path | None = None
    pages_changed: int = 0
    text_show_ops_removed: int = 0
    pages_skipped_complex: int = 0
    pages_skipped_no_text_overlap: int = 0
    pages_skipped_visual_background: int = 0
    pages_skipped_form_xobject: int = 0
    pages_strip_no_effect: int = 0
    forms_changed: int = 0
    changed_page_indices: frozenset[int] = frozenset()
    skipped_complex_page_indices: frozenset[int] = frozenset()
    skipped_no_text_overlap_page_indices: frozenset[int] = frozenset()
    skipped_visual_background_page_indices: frozenset[int] = frozenset()
    skipped_form_xobject_page_indices: frozenset[int] = frozenset()
    strip_no_effect_page_indices: frozenset[int] = frozenset()
    candidates: BBoxTextStripCandidates | None = None


@dataclass(frozen=True)
class BBoxTextStripCandidates:
    page_rects: dict[int, tuple[tuple[float, float, float, float], ...]]
    page_protected_rects: dict[int, tuple[tuple[float, float, float, float], ...]] | None = None
    uncovered_unsafe_vector_item_ids: frozenset[str] = frozenset()
    candidate_source: str = BBOX_TEXT_STRIP_CANDIDATE_SOURCE_FRESH_PLAN
    pages_skipped_complex: int = 0
    pages_skipped_no_text_overlap: int = 0
    pages_skipped_visual_background: int = 0
    pages_skipped_form_xobject: int = 0
    pages_strip_no_effect: int = 0
    skipped_complex_page_indices: frozenset[int] = frozenset()
    skipped_no_text_overlap_page_indices: frozenset[int] = frozenset()
    skipped_visual_background_page_indices: frozenset[int] = frozenset()
    skipped_form_xobject_page_indices: frozenset[int] = frozenset()
    strip_no_effect_page_indices: frozenset[int] = frozenset()
    page_features: dict[int, dict[str, object]] = field(default_factory=dict)

    def fitz_page_rects(self) -> dict[int, list[fitz.Rect]]:
        return {
            page_idx: [fitz.Rect(rect) for rect in rects]
            for page_idx, rects in self.page_rects.items()
        }

    def fitz_page_protected_rects(self) -> dict[int, list[fitz.Rect]]:
        return {
            page_idx: [fitz.Rect(rect) for rect in rects]
            for page_idx, rects in (self.page_protected_rects or {}).items()
        }


@dataclass(frozen=True)
class BBoxTextStripPagePlan:
    strip_rects: tuple[fitz.Rect, ...] = ()
    protected_rects: tuple[fitz.Rect, ...] = ()
    skip_reason: str = BBOX_TEXT_STRIP_PAGE_SKIP_NONE
    uncovered_unsafe_vector_item_ids: frozenset[str] = frozenset()
