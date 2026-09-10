from __future__ import annotations

from collections.abc import Callable

import fitz

from retainpdf_pipeline.render.source.background.fill import draw_flat_white_covers
from retainpdf_pipeline.render.source.background.fill import draw_white_covers
from retainpdf_pipeline.render.source.cleanup.diagnostics import new_redaction_diagnostics
from retainpdf_pipeline.render.source.cleanup.item_rects import cover_rects_from_valid_items
from retainpdf_pipeline.render.source.text_redaction import remove_text_under_rects_with_pymupdf_redaction
from retainpdf_pipeline.render.visual_profile import VisualProfileRuntime

DrawCovers = Callable[[fitz.Page, list[fitz.Rect]], None]
RemoveText = Callable[[fitz.Page, list[fitz.Rect]], None]


def apply_visual_cover_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
    *,
    remove_text_layer: bool = False,
    flat_cover: bool = False,
    route: str = "visual_cover",
    draw_covers: DrawCovers = draw_white_covers,
    draw_flat_covers: DrawCovers = draw_flat_white_covers,
    remove_text: RemoveText = remove_text_under_rects_with_pymupdf_redaction,
    visual_profile: VisualProfileRuntime | None = None,
) -> dict[str, object]:
    diagnostics = new_redaction_diagnostics(valid_items)
    profile_cover_count = 0
    profile_miss_items: list[tuple[fitz.Rect, dict, str]] = []
    if visual_profile is not None and visual_profile.loaded and not flat_cover:
        for rect, item, translated_text in valid_items:
            fill = visual_profile.background_fill_for_item(item)
            if fill is None:
                profile_miss_items.append((rect, item, translated_text))
                continue
            shape = page.new_shape()
            shape.draw_rect(rect)
            shape.finish(color=None, fill=fill)
            shape.commit(overlay=True)
            profile_cover_count += 1
        cover_rects = cover_rects_from_valid_items(profile_miss_items)
    else:
        cover_rects = cover_rects_from_valid_items(valid_items)
    if flat_cover:
        draw_flat_covers(page, cover_rects)
    else:
        draw_covers(page, cover_rects)
    if remove_text_layer:
        remove_text(page, cover_rects)
        diagnostics["uses_pymupdf_redaction"] = bool(cover_rects)
        diagnostics["legacy_pdf_write_reason"] = "visual_cover_remove_text_layer" if cover_rects else ""
    diagnostics["cover_rects"] = len(cover_rects) + profile_cover_count
    diagnostics["visual_profile_cover_rects"] = profile_cover_count
    diagnostics["fast_page_cover_only"] = True
    diagnostics["route"] = route
    diagnostics["strategy"] = "visual_cover_and_remove_text" if remove_text_layer else "visual_cover"
    return diagnostics
