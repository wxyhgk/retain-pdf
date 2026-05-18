from __future__ import annotations

from typing import TYPE_CHECKING

import fitz

from services.rendering.source.background.fill import draw_white_covers
from services.rendering.source.background.fill import resolved_fill_color
from services.rendering.source.cleanup.diagnostics import new_redaction_diagnostics
from services.rendering.source.cleanup.standard_execution import apply_page_cover_text_cleanup
from services.rendering.source.cleanup.standard_execution import apply_redaction_annotations
from services.rendering.source.cleanup.standard_policy import should_force_bbox_redaction
from services.rendering.source.cleanup.standard_policy import should_force_visual_cover
from services.rendering.source.cleanup.standard_policy import should_use_fast_page_cover_for_removable_counts
from services.rendering.source.cleanup.standard_thresholds import ITEM_REMOVABLE_RECTS_FAST_COVER_THRESHOLD
from services.rendering.source.cleanup.text_matching import item_removable_text_rects
from services.rendering.source.rects import merge_rects
from services.rendering.source.text_redaction import remove_text_under_rects_with_pymupdf_redaction
from services.rendering.source.vector_profile import collect_page_drawing_rects
from services.rendering.source.vector_profile import page_should_use_cover_only

if TYPE_CHECKING:
    from services.rendering.source.cleanup.plan_types import RedactionPlan


def apply_standard_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
    *,
    fill_background: bool | None = None,
    plan: RedactionPlan | None = None,
) -> dict[str, object]:
    diagnostics = new_redaction_diagnostics(valid_items)
    diagnostics["strategy"] = "text_layer_only"
    drawing_rects = plan.drawing_rects if plan is not None else collect_page_drawing_rects(page)
    if fill_background is None and page_should_use_cover_only(drawing_rects):
        return apply_page_cover_text_cleanup(
            page,
            valid_items,
            diagnostics,
            route="cover_only_page",
            reason="cover_only_page_text_cleanup",
            draw_covers=draw_white_covers,
            remove_text=remove_text_under_rects_with_pymupdf_redaction,
        )

    redactions: list[tuple[fitz.Rect, tuple[float, float, float] | None]] = []
    cover_rects: list[fitz.Rect] = []
    removable_counts: list[int] = []
    for rect, item, _translated_text in valid_items:
        if fill_background is None:
            if should_force_visual_cover(item):
                cover_rects.append(rect)
                diagnostics["item_fast_cover_count"] = int(diagnostics["item_fast_cover_count"]) + 1
                continue
            if should_force_bbox_redaction(item):
                redactions.append((rect, None))
                continue
            removable_rects = item_removable_text_rects(page, item, rect)
            raw_count = len(removable_rects)
            diagnostics["raw_removable_rects"] = int(diagnostics["raw_removable_rects"]) + raw_count
            if raw_count:
                removable_counts.append(raw_count)
            merged_removable_rects = merge_rects(removable_rects)
            merged_count = len(merged_removable_rects)
            diagnostics["merged_removable_rects"] = int(diagnostics["merged_removable_rects"]) + merged_count
            if raw_count >= ITEM_REMOVABLE_RECTS_FAST_COVER_THRESHOLD:
                cover_rects.append(rect)
                diagnostics["item_fast_cover_count"] = int(diagnostics["item_fast_cover_count"]) + 1
                continue
            if merged_removable_rects:
                for removable_rect in merged_removable_rects:
                    redactions.append((removable_rect, None))
                continue
            cover_rects.append(rect)
            continue
        fill = (1, 1, 1) if fill_background else None
        redactions.append((rect, fill))

    if fill_background is None and should_use_fast_page_cover_for_removable_counts(removable_counts):
        return apply_page_cover_text_cleanup(
            page,
            valid_items,
            diagnostics,
            route="fast_page_cover_only",
            reason="fast_page_cover_only_text_cleanup",
            draw_covers=draw_white_covers,
            remove_text=remove_text_under_rects_with_pymupdf_redaction,
        )

    merged_cover_rects = merge_rects(cover_rects)
    diagnostics["cover_rects"] = len(merged_cover_rects)
    draw_white_covers(page, merged_cover_rects)

    apply_redaction_annotations(
        page,
        redactions,
        diagnostics,
        resolve_fill=resolved_fill_color,
    )
    diagnostics["route"] = "standard_redaction"
    return diagnostics
