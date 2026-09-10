from __future__ import annotations

import fitz

from retainpdf_pipeline.render.output.typst.color_adapt import apply_adaptive_overlay_colors


RenderColorProfile = dict[str, dict[str, tuple[float, float, float]]]


def apply_overlay_page_colors(
    doc: fitz.Document,
    page_indices: list[int],
    translated_pages: dict[int, list[dict]],
    *,
    precomputed_colors_by_item_id: RenderColorProfile | None = None,
) -> dict[int, list[dict]]:
    adapted: dict[int, list[dict]] = {}
    for page_idx in page_indices:
        items = translated_pages.get(page_idx, [])
        if 0 <= page_idx < len(doc):
            adapted[page_idx] = apply_adaptive_overlay_colors(
                doc[page_idx],
                items,
                precomputed_colors_by_item_id=precomputed_colors_by_item_id,
            )
        else:
            adapted[page_idx] = [
                {
                    **item,
                    "_render_cover_fill": item.get("_render_cover_fill", (1, 1, 1)),
                    "_render_text_color": item.get("_render_text_color", (0, 0, 0)),
                }
                for item in items
            ]
    return adapted


__all__ = ["RenderColorProfile", "apply_overlay_page_colors"]
