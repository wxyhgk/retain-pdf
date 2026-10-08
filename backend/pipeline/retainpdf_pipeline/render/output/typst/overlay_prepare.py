"""overlay 路线渲染前的页面准备：缩进 / 有效框 → 页面排序 → 取色 → 每页的块。

从 ``overlay_ops.overlay_translated_pages_on_doc`` 抽出来，让 Typst overlay 路线与 rpr 引擎的
overlay 路线用同一份准备结果（同一套字号、颜色、有效框），两条路线的差别只剩排版本身。
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from dataclasses import field
from pathlib import Path

import fitz

from retainpdf_pipeline.render.output.typst.book_support import prepare_translated_pages_for_render
from retainpdf_pipeline.render.output.typst.overlay_book import build_overlay_page_specs
from retainpdf_pipeline.render.output.typst.overlay_book import prepare_overlay_doc_pages
from retainpdf_pipeline.render.output.typst.overlay_color import apply_overlay_page_colors
from retainpdf_pipeline.render.visual_profile import merge_visual_profile_colors


@dataclass
class PreparedOverlayPages:
    ordered_page_indices: list[int]
    translated_pages: dict[int, list[dict]]
    # build_overlay_page_specs 的结果：(page_idx, page_width, page_height, items, stem)
    page_specs: list[tuple] = field(default_factory=list)
    cover_fallback_page_indices: frozenset[int] = frozenset()
    visual_profile_diagnostics: dict = field(default_factory=dict)
    prepare_elapsed: float = 0.0
    color_elapsed: float = 0.0
    specs_elapsed: float = 0.0

    @property
    def empty(self) -> bool:
        return not self.ordered_page_indices


def prepare_overlay_pages(
    doc: fitz.Document,
    translated_pages: dict[int, list[dict]],
    *,
    stem: str,
    source_pdf_path: Path | None = None,
    first_line_indent_lookup: dict[str, float] | None = None,
    effective_inner_bbox_lookup: dict[str, list[float]] | None = None,
    source_text_precleaned_page_indices: frozenset[int] = frozenset(),
    color_sample_pdf_path: Path | None = None,
    prepared_overlay_pages: dict[int, list[dict]] | None = None,
    precomputed_colors_by_item_id: dict[str, dict[str, tuple[float, float, float]]] | None = None,
    visual_profile_path: Path | None = None,
    visual_cover_page_indices: frozenset[int] = frozenset(),
) -> PreparedOverlayPages:
    prepare_started = time.perf_counter()
    if prepared_overlay_pages is not None:
        translated_pages = prepared_overlay_pages
    else:
        translated_pages = prepare_translated_pages_for_render(
            source_pdf_path,
            translated_pages,
            first_line_indent_lookup=first_line_indent_lookup,
            effective_inner_bbox_lookup=effective_inner_bbox_lookup,
            skip_policy_page_indices=source_text_precleaned_page_indices,
        )
    ordered_page_indices, translated_pages = prepare_overlay_doc_pages(doc, translated_pages)
    cover_fallback_page_indices = frozenset(
        page_idx
        for page_idx in ordered_page_indices
        if page_idx in visual_cover_page_indices and translated_pages.get(page_idx)
    )
    prepare_elapsed = time.perf_counter() - prepare_started
    if not ordered_page_indices:
        return PreparedOverlayPages(
            ordered_page_indices=ordered_page_indices,
            translated_pages=translated_pages,
            cover_fallback_page_indices=cover_fallback_page_indices,
            prepare_elapsed=prepare_elapsed,
        )

    active_colors_by_item_id, visual_profile_diagnostics = merge_visual_profile_colors(
        visual_profile_path=visual_profile_path,
        precomputed_colors_by_item_id=precomputed_colors_by_item_id,
    )
    color_started = time.perf_counter()
    if prepared_overlay_pages is not None:
        color_elapsed = 0.0
    elif color_sample_pdf_path is not None:
        sample_doc = fitz.open(color_sample_pdf_path)
        try:
            translated_pages = apply_overlay_page_colors(
                sample_doc,
                ordered_page_indices,
                translated_pages,
                precomputed_colors_by_item_id=active_colors_by_item_id,
            )
        finally:
            sample_doc.close()
    else:
        translated_pages = apply_overlay_page_colors(
            doc,
            ordered_page_indices,
            translated_pages,
            precomputed_colors_by_item_id=active_colors_by_item_id,
        )
    if prepared_overlay_pages is None:
        color_elapsed = time.perf_counter() - color_started
    specs_started = time.perf_counter()
    page_specs = build_overlay_page_specs(doc, ordered_page_indices, translated_pages, stem=stem)
    specs_elapsed = time.perf_counter() - specs_started
    return PreparedOverlayPages(
        ordered_page_indices=ordered_page_indices,
        translated_pages=translated_pages,
        page_specs=page_specs,
        cover_fallback_page_indices=cover_fallback_page_indices,
        visual_profile_diagnostics=visual_profile_diagnostics,
        prepare_elapsed=prepare_elapsed,
        color_elapsed=color_elapsed,
        specs_elapsed=specs_elapsed,
    )


__all__ = ["PreparedOverlayPages", "prepare_overlay_pages"]
