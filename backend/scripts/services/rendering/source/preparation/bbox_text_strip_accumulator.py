from __future__ import annotations

from dataclasses import dataclass, field

from services.rendering.source.preparation.bbox_text_strip_geometry import rect_tuple
from services.rendering.source.preparation.bbox_text_strip_types import BBOX_TEXT_STRIP_PAGE_SKIP_COMPLEX
from services.rendering.source.preparation.bbox_text_strip_types import BBOX_TEXT_STRIP_PAGE_SKIP_NO_TEXT_OVERLAP
from services.rendering.source.preparation.bbox_text_strip_types import BBoxTextStripCandidates
from services.rendering.source.preparation.bbox_text_strip_types import BBoxTextStripPagePlan


@dataclass
class BBoxTextStripCandidateAccumulator:
    page_rects: dict[int, tuple[tuple[float, float, float, float], ...]] = field(default_factory=dict)
    page_protected_rects: dict[int, tuple[tuple[float, float, float, float], ...]] = field(default_factory=dict)
    skipped_complex_page_indices: set[int] = field(default_factory=set)
    skipped_no_text_overlap_page_indices: set[int] = field(default_factory=set)

    def add_page_plan(self, page_idx: int, page_plan: BBoxTextStripPagePlan) -> None:
        if page_plan.skip_reason == BBOX_TEXT_STRIP_PAGE_SKIP_COMPLEX:
            self.skipped_complex_page_indices.add(page_idx)
            return
        if page_plan.skip_reason == BBOX_TEXT_STRIP_PAGE_SKIP_NO_TEXT_OVERLAP:
            self.skipped_no_text_overlap_page_indices.add(page_idx)
            return
        if not page_plan.strip_rects:
            return
        self.page_rects[page_idx] = tuple(rect_tuple(rect) for rect in page_plan.strip_rects)
        if page_plan.protected_rects:
            self.page_protected_rects[page_idx] = tuple(rect_tuple(rect) for rect in page_plan.protected_rects)

    def build(self) -> BBoxTextStripCandidates:
        return BBoxTextStripCandidates(
            page_rects=self.page_rects,
            page_protected_rects=self.page_protected_rects,
            pages_skipped_complex=len(self.skipped_complex_page_indices),
            pages_skipped_no_text_overlap=len(self.skipped_no_text_overlap_page_indices),
            skipped_complex_page_indices=frozenset(self.skipped_complex_page_indices),
            skipped_no_text_overlap_page_indices=frozenset(self.skipped_no_text_overlap_page_indices),
        )
