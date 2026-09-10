from __future__ import annotations

from dataclasses import dataclass, field

from retainpdf_pipeline.render.source_cleanup.planning.geometry import rect_tuple
from retainpdf_pipeline.render.source_cleanup.planning.page_features import PageCleanupFeatures
from retainpdf_pipeline.render.source_cleanup.types import BBOX_TEXT_STRIP_PAGE_SKIP_COMPLEX
from retainpdf_pipeline.render.source_cleanup.types import BBOX_TEXT_STRIP_PAGE_SKIP_NO_TEXT_OVERLAP
from retainpdf_pipeline.render.source_cleanup.types import BBOX_TEXT_STRIP_PAGE_SKIP_VISUAL_BACKGROUND
from retainpdf_pipeline.render.source_cleanup.types import BBoxTextStripCandidates
from retainpdf_pipeline.render.source_cleanup.types import BBoxTextStripPagePlan


@dataclass
class BBoxTextStripCandidateAccumulator:
    page_rects: dict[int, tuple[tuple[float, float, float, float], ...]] = field(default_factory=dict)
    page_protected_rects: dict[int, tuple[tuple[float, float, float, float], ...]] = field(default_factory=dict)
    skipped_complex_page_indices: set[int] = field(default_factory=set)
    skipped_no_text_overlap_page_indices: set[int] = field(default_factory=set)
    skipped_visual_background_page_indices: set[int] = field(default_factory=set)
    uncovered_unsafe_vector_item_ids: set[str] = field(default_factory=set)
    page_features: dict[int, dict[str, object]] = field(default_factory=dict)

    def add_page_features(self, page_idx: int, features: PageCleanupFeatures) -> None:
        self.page_features[page_idx] = features.to_manifest()

    def add_page_plan(self, page_idx: int, page_plan: BBoxTextStripPagePlan) -> None:
        self.uncovered_unsafe_vector_item_ids.update(page_plan.uncovered_unsafe_vector_item_ids)
        if page_plan.skip_reason == BBOX_TEXT_STRIP_PAGE_SKIP_COMPLEX:
            self.skipped_complex_page_indices.add(page_idx)
            return
        if page_plan.skip_reason == BBOX_TEXT_STRIP_PAGE_SKIP_NO_TEXT_OVERLAP:
            self.skipped_no_text_overlap_page_indices.add(page_idx)
            return
        if page_plan.skip_reason == BBOX_TEXT_STRIP_PAGE_SKIP_VISUAL_BACKGROUND:
            self.skipped_visual_background_page_indices.add(page_idx)
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
            uncovered_unsafe_vector_item_ids=frozenset(self.uncovered_unsafe_vector_item_ids),
            pages_skipped_complex=len(self.skipped_complex_page_indices),
            pages_skipped_no_text_overlap=len(self.skipped_no_text_overlap_page_indices),
            pages_skipped_visual_background=len(self.skipped_visual_background_page_indices),
            skipped_complex_page_indices=frozenset(self.skipped_complex_page_indices),
            skipped_no_text_overlap_page_indices=frozenset(self.skipped_no_text_overlap_page_indices),
            skipped_visual_background_page_indices=frozenset(self.skipped_visual_background_page_indices),
            page_features=self.page_features,
        )
