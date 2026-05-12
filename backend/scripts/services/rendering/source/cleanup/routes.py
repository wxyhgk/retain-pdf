from __future__ import annotations

import fitz

from services.rendering.source.cleanup.analysis import collect_page_math_protection_rects
from services.rendering.source.cleanup.analysis import collect_page_non_math_span_heights
from services.rendering.source.cleanup.analysis import item_has_removable_text
from services.rendering.source.cleanup.analysis import item_removable_text_rects
from services.rendering.source.cleanup.analysis import page_drawing_count
from services.rendering.source.cleanup.analysis import page_has_intrusive_math_protection
from services.rendering.source.cleanup.analysis import page_has_large_background_image
from services.rendering.source.cleanup.analysis import page_is_vector_heavy_count
from services.rendering.source.cleanup.analysis import page_should_use_cover_only_count
from services.rendering.source.cleanup.fill import draw_flat_white_covers
from services.rendering.source.cleanup.fill import draw_white_covers
from services.rendering.source.cleanup.ops import cover_rects_from_valid_items
from services.rendering.source.cleanup.ops import merge_rects
from services.rendering.source.cleanup.ops import new_redaction_diagnostics
from services.rendering.source.cleanup.ops import remove_text_under_rects
from services.rendering.source.cleanup.shared import iter_valid_translated_items
from services.rendering.source.cleanup.standard import apply_standard_redaction
from services.rendering.source.cleanup.strategy import resolve_redaction_route
from services.rendering.source.cleanup.text_layer import apply_image_page_redaction
from services.rendering.source.cleanup.text_layer import apply_vector_heavy_redaction
from services.rendering.source.cleanup.visual_cover import apply_visual_redaction
from services.rendering.source.cleanup.plan import RedactionPlan

def iter_valid_redaction_items(
    translated_items: list[dict],
    *,
    image_page: bool = False,
) -> list[tuple[fitz.Rect, dict, str]]:
    del image_page
    redaction_items: list[tuple[fitz.Rect, dict, str]] = []
    for rect, item, translated_text in iter_valid_translated_items(translated_items):
        if rect.is_empty:
            continue
        redaction_items.append((fitz.Rect(rect), item, translated_text))
    return redaction_items


def _item_is_safe_for_auto_text_cleanup(item: dict) -> bool:
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
) -> dict[str, object]:
    diagnostics = new_redaction_diagnostics(valid_items)
    diagnostics["route"] = "auto"
    diagnostics["strategy"] = "auto"

    protected_math_rects = collect_page_math_protection_rects(page)
    non_math_span_heights = collect_page_non_math_span_heights(page)
    has_intrusive_math_protection = page_has_intrusive_math_protection(
        valid_items,
        protected_math_rects,
        non_math_span_heights,
    )
    if has_intrusive_math_protection:
        diagnostics["auto_text_cleanup_math_protected"] = True

    cover_items: list[tuple[fitz.Rect, dict, str]] = []
    removable_rects: list[fitz.Rect] = []
    skipped_risky_items = 0
    for rect, item, _translated_text in valid_items:
        if not _item_is_safe_for_auto_text_cleanup(item):
            skipped_risky_items += 1
            cover_items.append((rect, item, _translated_text))
            continue
        item_rects = item_removable_text_rects(
            page,
            item,
            rect,
            special_math_rects=protected_math_rects if has_intrusive_math_protection else None,
        )
        diagnostics["raw_removable_rects"] = int(diagnostics["raw_removable_rects"]) + len(item_rects)
        if item_rects:
            removable_rects.extend(item_rects)
        else:
            cover_items.append((rect, item, _translated_text))

    cover_rects = cover_rects_from_valid_items(cover_items)
    if flat_cover:
        draw_flat_white_covers(page, cover_rects)
    else:
        draw_white_covers(page, cover_rects)
    diagnostics["cover_rects"] = len(cover_rects)
    diagnostics["fast_page_cover_only"] = bool(cover_rects) and len(cover_items) == len(valid_items)

    merged_removable_rects = merge_rects(removable_rects)
    diagnostics["merged_removable_rects"] = len(merged_removable_rects)
    diagnostics["auto_text_cleanup_items_skipped"] = skipped_risky_items
    if merged_removable_rects:
        remove_text_under_rects(page, merged_removable_rects)
    return diagnostics


def apply_redaction_route(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
    *,
    fill_background: bool | None = None,
    cover_only: bool = False,
    strategy: str | None = None,
    plan: RedactionPlan | None = None,
) -> dict[str, object]:
    resolved_route = resolve_redaction_route(strategy, cover_only=cover_only)
    if resolved_route == "auto":
        return apply_auto_redaction(
            page,
            valid_items,
            flat_cover=cover_only,
        )

    if resolved_route == "visual_cover":
        return apply_visual_redaction(
            page,
            valid_items,
            remove_text_layer=False,
            flat_cover=cover_only,
            route="visual_cover",
        )

    if resolved_route == "visual_cover_and_remove_text":
        return apply_visual_redaction(
            page,
            valid_items,
            remove_text_layer=True,
            flat_cover=cover_only,
            route="visual_cover_and_remove_text",
        )

    image_page = plan.image_page if plan is not None else page_has_large_background_image(page)
    if image_page:
        return apply_image_page_redaction(page, valid_items)

    drawing_count = plan.drawing_count if plan is not None else page_drawing_count(page)
    if fill_background is None and page_should_use_cover_only_count(drawing_count):
        cover_rects = cover_rects_from_valid_items(valid_items)
        draw_flat_white_covers(page, cover_rects)
        remove_text_under_rects(page, cover_rects)
        diagnostics = new_redaction_diagnostics(valid_items)
        diagnostics["cover_rects"] = len(cover_rects)
        diagnostics["fast_page_cover_only"] = True
        diagnostics["route"] = "cover_only_count"
        diagnostics["strategy"] = "text_layer_only"
        return diagnostics

    if fill_background is None and page_is_vector_heavy_count(drawing_count):
        return apply_vector_heavy_redaction(page, valid_items)

    return apply_standard_redaction(page, valid_items, fill_background=fill_background, plan=plan)
