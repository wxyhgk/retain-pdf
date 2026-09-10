from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from retainpdf_pipeline.render.layout.model.models import RenderLayoutBlock
from retainpdf_pipeline.render.layout.model.models import RenderPageSpec
from retainpdf_pipeline.render.contracts import RenderDocumentAnalysis
from retainpdf_pipeline.render.policy import apply_typst_cover_fallback_fields
from retainpdf_pipeline.render.source_cleanup import item_ids_with_uncovered_unsafe_vector_overlap


@dataclass(frozen=True)
class TypstCoverFallbackPlan:
    page_indices: frozenset[int] = frozenset()
    item_ids: frozenset[str] = frozenset()

    @classmethod
    def build(
        cls,
        *,
        source_pdf_path: Path,
        translated_pages: dict[int, list[dict]],
        cleanup_strategy: str,
        precleaned_page_indices: frozenset[int],
        skipped_page_indices: frozenset[int],
        document_analysis: RenderDocumentAnalysis | None = None,
        source_cleanup_cover_fallback_page_indices: frozenset[int] = frozenset(),
        source_cleanup_item_fallback_ids: frozenset[str] = frozenset(),
    ) -> "TypstCoverFallbackPlan":
        page_indices = source_cleanup_cover_fallback_page_indices
        if document_analysis is not None:
            page_indices = page_indices | document_analysis.visual_cover_page_indices
        translated_page_indices = frozenset(page_idx for page_idx, items in translated_pages.items() if items)
        item_ids = frozenset()
        if not translated_page_indices <= page_indices:
            item_ids = source_cleanup_item_fallback_ids or cover_fallback_item_ids(
                source_pdf_path=source_pdf_path,
                translated_pages=translated_pages,
                cleanup_strategy=cleanup_strategy,
            )
        return cls(
            page_indices=page_indices,
            item_ids=item_ids,
        )

    def apply_to_translated_pages(self, translated_pages: dict[int, list[dict]]) -> dict[int, list[dict]]:
        return apply_typst_cover_fallback_fields(translated_pages, self.page_indices, item_ids=self.item_ids)

    def apply_to_page_specs(self, page_specs: list[RenderPageSpec] | None) -> list[RenderPageSpec] | None:
        if not page_specs or not self.active:
            return page_specs
        return [self._patch_page_spec(spec) for spec in page_specs]

    @property
    def active(self) -> bool:
        return bool(self.page_indices or self.item_ids)

    def diagnostics(self) -> dict[str, object]:
        page_indices = sorted(self.page_indices)
        item_ids = sorted(self.item_ids)
        return {
            "typst_cover_fallback_pages": _summary(page_indices),
            "typst_cover_fallback_items": _summary(item_ids),
        }

    def _patch_page_spec(self, spec: RenderPageSpec) -> RenderPageSpec:
        blocks = [self._patch_block(spec.page_index, block) for block in spec.blocks]
        if blocks == spec.blocks:
            return spec
        return RenderPageSpec(
            page_index=spec.page_index,
            page_width_pt=spec.page_width_pt,
            page_height_pt=spec.page_height_pt,
            background_pdf_path=spec.background_pdf_path,
            blocks=blocks,
        )

    def _patch_block(self, page_index: int, block: RenderLayoutBlock) -> RenderLayoutBlock:
        reason = self._cover_reason(page_index, block)
        if not reason:
            return block
        return RenderLayoutBlock(
            **{
                **block.__dict__,
                "use_cover_fill": True,
                "skip_reason": block.skip_reason or reason,
            }
        )

    def _cover_reason(self, page_index: int, block: RenderLayoutBlock) -> str:
        if page_index in self.page_indices:
            return "typst_cover_fallback"
        if _block_source_item_id(block) in self.item_ids:
            return "typst_item_cover_fallback"
        return ""


def cover_fallback_page_indices(
    *,
    translated_pages: dict[int, list[dict]],
    cleanup_strategy: str,
    precleaned_page_indices: frozenset[int],
    skipped_page_indices: frozenset[int],
) -> frozenset[int]:
    if cleanup_strategy == "pikepdf_text_strip":
        return frozenset(page_idx for page_idx, items in translated_pages.items() if items) - precleaned_page_indices
    return skipped_page_indices


def cover_fallback_item_ids(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    cleanup_strategy: str,
) -> frozenset[str]:
    if cleanup_strategy != "pikepdf_text_strip":
        return frozenset()
    try:
        return item_ids_with_uncovered_unsafe_vector_overlap(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
        )
    except Exception as exc:
        print(f"typst cover fallback: item probe failed {type(exc).__name__}: {exc}", flush=True)
        return frozenset()


def _block_source_item_id(block: RenderLayoutBlock) -> str:
    block_id = str(block.block_id or "")
    return block_id.removeprefix("item-")


def _summary(values: list) -> dict[str, object]:
    return {
        "count": len(values),
        "head": values[:20],
        "tail": values[-20:] if len(values) > 20 else [],
    }
