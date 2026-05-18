from __future__ import annotations

from collections.abc import Callable

import fitz

from services.rendering.policy import build_cleanup_item_plan
from services.rendering.source.background.fill import draw_flat_white_covers
from services.rendering.source.background.fill import draw_white_covers
from services.rendering.source.cleanup.diagnostics import new_redaction_diagnostics
from services.rendering.source.cleanup.item_rects import cover_rects_from_valid_items
from services.rendering.source.cleanup.math_intrusion import page_has_intrusive_math_protection
from services.rendering.source.cleanup.math_spans import collect_page_math_protection_rects
from services.rendering.source.cleanup.math_spans import collect_page_non_math_span_heights
from services.rendering.source.cleanup.text_matching import item_removable_text_rects
from services.rendering.source.rects import merge_rects
from services.rendering.source.text_redaction import remove_text_under_rects_with_pymupdf_redaction

CollectMathRects = Callable[[fitz.Page], list[fitz.Rect]]
CollectSpanHeights = Callable[[fitz.Page], list[float]]
DrawCovers = Callable[[fitz.Page, list[fitz.Rect]], None]
ItemRemovableRects = Callable[..., list[fitz.Rect]]
MathProtectionPredicate = Callable[[list[tuple[fitz.Rect, dict, str]], list[fitz.Rect], list[float]], bool]
RemoveText = Callable[[fitz.Page, list[fitz.Rect]], None]


def item_is_safe_for_auto_text_cleanup(item: dict) -> bool:
    if build_cleanup_item_plan(item).visual_cover_only:
        return False
    if str(item.get("block_kind", item.get("block_type", "")) or "").strip().lower() == "render_block":
        return False
    if item.get("continuation_group") or item.get("continuation_group_id"):
        return False
    return True


def apply_auto_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
    *,
    flat_cover: bool = False,
    collect_math_rects: CollectMathRects = collect_page_math_protection_rects,
    collect_span_heights: CollectSpanHeights = collect_page_non_math_span_heights,
    has_intrusive_math: MathProtectionPredicate = page_has_intrusive_math_protection,
    item_text_rects: ItemRemovableRects = item_removable_text_rects,
    draw_covers: DrawCovers = draw_white_covers,
    draw_flat_covers: DrawCovers = draw_flat_white_covers,
    remove_text: RemoveText = remove_text_under_rects_with_pymupdf_redaction,
) -> dict[str, object]:
    diagnostics = new_redaction_diagnostics(valid_items)
    diagnostics["route"] = "auto"
    diagnostics["strategy"] = "auto"

    protected_math_rects = collect_math_rects(page)
    non_math_span_heights = collect_span_heights(page)
    has_intrusive_math_protection = has_intrusive_math(
        valid_items,
        protected_math_rects,
        non_math_span_heights,
    )
    if has_intrusive_math_protection:
        diagnostics["auto_text_cleanup_math_protected"] = True

    cover_items: list[tuple[fitz.Rect, dict, str]] = []
    removable_rects: list[fitz.Rect] = []
    skipped_risky_items = 0
    for rect, item, translated_text in valid_items:
        if not item_is_safe_for_auto_text_cleanup(item):
            skipped_risky_items += 1
            cover_items.append((rect, item, translated_text))
            continue
        item_rects = item_text_rects(
            page,
            item,
            rect,
            special_math_rects=protected_math_rects if has_intrusive_math_protection else None,
        )
        diagnostics["raw_removable_rects"] = int(diagnostics["raw_removable_rects"]) + len(item_rects)
        if item_rects:
            removable_rects.extend(item_rects)
        else:
            cover_items.append((rect, item, translated_text))

    cover_rects = cover_rects_from_valid_items(cover_items)
    if flat_cover:
        draw_flat_covers(page, cover_rects)
    else:
        draw_covers(page, cover_rects)
    diagnostics["cover_rects"] = len(cover_rects)
    diagnostics["fast_page_cover_only"] = bool(cover_rects) and len(cover_items) == len(valid_items)

    merged_removable_rects = merge_rects(removable_rects)
    diagnostics["merged_removable_rects"] = len(merged_removable_rects)
    diagnostics["auto_text_cleanup_items_skipped"] = skipped_risky_items
    if merged_removable_rects:
        remove_text(page, merged_removable_rects)
        diagnostics["uses_pymupdf_redaction"] = True
        diagnostics["legacy_pdf_write_reason"] = "auto_text_cleanup"
    return diagnostics
