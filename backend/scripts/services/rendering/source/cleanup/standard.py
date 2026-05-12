from __future__ import annotations

from typing import TYPE_CHECKING

import fitz

from services.rendering.layout.inline_content.complexity import item_has_complex_inline_math
from services.rendering.source.cleanup.analysis import collect_page_drawing_rects
from services.rendering.source.cleanup.analysis import item_removable_text_rects
from services.rendering.source.cleanup.analysis import page_should_use_cover_only
from services.rendering.source.cleanup.fill import draw_white_covers
from services.rendering.source.cleanup.fill import resolved_fill_color
from services.rendering.source.cleanup.ops import cover_rects_from_valid_items
from services.rendering.source.cleanup.ops import merge_rects
from services.rendering.source.cleanup.ops import new_redaction_diagnostics
from services.rendering.source.cleanup.ops import remove_text_under_rects

if TYPE_CHECKING:
    from services.rendering.source.cleanup.plan import RedactionPlan


ITEM_REMOVABLE_RECTS_FAST_COVER_THRESHOLD = 24
PAGE_REMOVABLE_RECTS_FAST_COVER_THRESHOLD = 180
PAGE_AVG_REMOVABLE_RECTS_FAST_COVER_THRESHOLD = 24.0
PAGE_ITEM_REMOVABLE_RECTS_FAST_COVER_COUNT = 8


def should_force_bbox_redaction(item: dict) -> bool:
    return bool(item.get("continuation_group"))


def should_force_visual_cover(item: dict) -> bool:
    return item_has_complex_inline_math(item)


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
        cover_rects = cover_rects_from_valid_items(valid_items)
        draw_white_covers(page, cover_rects)
        remove_text_under_rects(page, cover_rects)
        diagnostics["cover_rects"] = len(cover_rects)
        diagnostics["fast_page_cover_only"] = True
        diagnostics["route"] = "cover_only_page"
        return diagnostics

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

    if fill_background is None and removable_counts:
        total_raw_rects = sum(removable_counts)
        avg_raw_rects = total_raw_rects / max(len(removable_counts), 1)
        if (
            total_raw_rects >= PAGE_REMOVABLE_RECTS_FAST_COVER_THRESHOLD
            or avg_raw_rects >= PAGE_AVG_REMOVABLE_RECTS_FAST_COVER_THRESHOLD
            or len([count for count in removable_counts if count >= ITEM_REMOVABLE_RECTS_FAST_COVER_THRESHOLD])
            >= PAGE_ITEM_REMOVABLE_RECTS_FAST_COVER_COUNT
        ):
            page_cover_rects = cover_rects_from_valid_items(valid_items)
            draw_white_covers(page, page_cover_rects)
            remove_text_under_rects(page, page_cover_rects)
            diagnostics["cover_rects"] = len(page_cover_rects)
            diagnostics["fast_page_cover_only"] = True
            diagnostics["route"] = "fast_page_cover_only"
            return diagnostics

    merged_cover_rects = merge_rects(cover_rects)
    diagnostics["cover_rects"] = len(merged_cover_rects)
    draw_white_covers(page, merged_cover_rects)

    for rect, fill in redactions:
        page.add_redact_annot(rect, fill=resolved_fill_color(page, rect, fill))
    if redactions:
        page.apply_redactions(
            images=fitz.PDF_REDACT_IMAGE_NONE,
            graphics=fitz.PDF_REDACT_LINE_ART_NONE,
            text=fitz.PDF_REDACT_TEXT_REMOVE,
        )
    diagnostics["route"] = "standard_redaction"
    return diagnostics
