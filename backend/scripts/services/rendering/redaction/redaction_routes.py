from __future__ import annotations

from typing import Literal

import fitz

from services.rendering.formula.mode_router import is_direct_typst_math_mode
from services.rendering.formula.complexity import item_has_complex_inline_math
from services.rendering.redaction.redaction_analysis import collect_page_drawing_rects
from services.rendering.redaction.redaction_analysis import collect_page_math_protection_rects
from services.rendering.redaction.redaction_analysis import collect_page_non_math_span_heights
from services.rendering.redaction.redaction_analysis import item_has_removable_text
from services.rendering.redaction.redaction_analysis import item_has_formula
from services.rendering.redaction.redaction_analysis import item_removable_text_rects
from services.rendering.redaction.redaction_analysis import page_drawing_count
from services.rendering.redaction.redaction_analysis import page_has_intrusive_math_protection
from services.rendering.redaction.redaction_analysis import page_has_large_background_image
from services.rendering.redaction.redaction_analysis import page_is_vector_heavy_count
from services.rendering.redaction.redaction_analysis import page_should_use_cover_only
from services.rendering.redaction.redaction_analysis import page_should_use_cover_only_count
from services.rendering.redaction.redaction_fill import apply_prepared_background_covers
from services.rendering.redaction.redaction_fill import draw_flat_white_covers
from services.rendering.redaction.redaction_fill import draw_white_covers
from services.rendering.redaction.redaction_fill import prepare_background_covers
from services.rendering.redaction.redaction_fill import resolved_fill_color
from services.rendering.redaction.redaction_geometry import expand_image_page_item_rect
from services.rendering.redaction.redaction_geometry import expand_item_rect
from services.rendering.redaction.shared import iter_valid_translated_items

ITEM_REMOVABLE_RECTS_FAST_COVER_THRESHOLD = 24
PAGE_REMOVABLE_RECTS_FAST_COVER_THRESHOLD = 180
PAGE_AVG_REMOVABLE_RECTS_FAST_COVER_THRESHOLD = 24.0
PAGE_ITEM_REMOVABLE_RECTS_FAST_COVER_COUNT = 8
RECT_MERGE_GAP_X_PT = 3.0
RECT_MERGE_GAP_Y_PT = 2.0
RECT_MERGE_MAX_VERTICAL_MISALIGN_PT = 6.0
RedactionStrategy = Literal["auto", "visual_only", "visual_and_text", "text_redaction"]
DEFAULT_REDACTION_STRATEGY: RedactionStrategy = "auto"


def iter_valid_redaction_items(
    translated_items: list[dict],
    *,
    image_page: bool = False,
) -> list[tuple[fitz.Rect, dict, str]]:
    redaction_items: list[tuple[fitz.Rect, dict, str]] = []
    for rect, item, translated_text in iter_valid_translated_items(translated_items):
        expanded = expand_image_page_item_rect(rect) if image_page else expand_item_rect(rect)
        if expanded.is_empty:
            continue
        redaction_items.append((expanded, item, translated_text))
    return redaction_items


def _rects_should_merge(left: fitz.Rect, right: fitz.Rect) -> bool:
    if not ((left & right).is_empty):
        return True
    same_row = (
        abs(left.y0 - right.y0) <= RECT_MERGE_MAX_VERTICAL_MISALIGN_PT
        and abs(left.y1 - right.y1) <= RECT_MERGE_MAX_VERTICAL_MISALIGN_PT
    )
    horizontal_gap = max(0.0, max(left.x0, right.x0) - min(left.x1, right.x1))
    vertical_gap = max(0.0, max(left.y0, right.y0) - min(left.y1, right.y1))
    if same_row and horizontal_gap <= RECT_MERGE_GAP_X_PT:
        return True
    if vertical_gap <= RECT_MERGE_GAP_Y_PT and horizontal_gap <= RECT_MERGE_GAP_X_PT:
        return True
    return False


def _merge_rects(rects: list[fitz.Rect]) -> list[fitz.Rect]:
    merged: list[fitz.Rect] = []
    for rect in sorted(rects, key=lambda value: (round(value.y0, 2), round(value.x0, 2), round(value.y1, 2))):
        current = fitz.Rect(rect)
        changed = True
        while changed:
            changed = False
            kept: list[fitz.Rect] = []
            for existing in merged:
                if _rects_should_merge(existing, current):
                    current |= existing
                    changed = True
                else:
                    kept.append(existing)
            merged = kept
        merged.append(current)
    return sorted(merged, key=lambda value: (round(value.y0, 2), round(value.x0, 2), round(value.y1, 2)))


def _cover_rects_from_valid_items(valid_items: list[tuple[fitz.Rect, dict, str]]) -> list[fitz.Rect]:
    return _merge_rects([rect for rect, _item, _translated_text in valid_items])


def _remove_text_under_rects(page: fitz.Page, rects: list[fitz.Rect]) -> None:
    if not rects:
        return
    for rect in rects:
        if rect.is_empty:
            continue
        page.add_redact_annot(rect, fill=False)
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_NONE,
        graphics=fitz.PDF_REDACT_LINE_ART_NONE,
        text=fitz.PDF_REDACT_TEXT_REMOVE,
    )


def _resolve_redaction_strategy(
    strategy: str | None,
    *,
    cover_only: bool = False,
) -> RedactionStrategy:
    if cover_only and not strategy:
        return "visual_only"
    if not strategy:
        return DEFAULT_REDACTION_STRATEGY
    normalized = strategy.strip().lower()
    if normalized not in {"auto", "visual_only", "visual_and_text", "text_redaction"}:
        raise ValueError(
            "unsupported redaction strategy: "
            f"{strategy!r}; expected auto, visual_only, visual_and_text, or text_redaction"
        )
    return normalized  # type: ignore[return-value]


def _should_force_bbox_redaction(item: dict) -> bool:
    return bool(item.get("continuation_group"))


def _should_force_visual_cover(item: dict) -> bool:
    return item_has_complex_inline_math(item)


def _new_redaction_diagnostics(valid_items: list[tuple[fitz.Rect, dict, str]]) -> dict[str, object]:
    return {
        "items": len(valid_items),
        "raw_removable_rects": 0,
        "merged_removable_rects": 0,
        "cover_rects": 0,
        "fast_page_cover_only": False,
        "item_fast_cover_count": 0,
        "route": "",
    }


def apply_visual_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
    *,
    remove_text_layer: bool = False,
    flat_cover: bool = False,
    route: str = "visual_only",
) -> dict[str, object]:
    diagnostics = _new_redaction_diagnostics(valid_items)
    cover_rects = _cover_rects_from_valid_items(valid_items)
    if flat_cover:
        draw_flat_white_covers(page, cover_rects)
    else:
        draw_white_covers(page, cover_rects)
    if remove_text_layer:
        _remove_text_under_rects(page, cover_rects)
    diagnostics["cover_rects"] = len(cover_rects)
    diagnostics["fast_page_cover_only"] = True
    diagnostics["route"] = route
    diagnostics["strategy"] = "visual_and_text" if remove_text_layer else "visual_only"
    return diagnostics


def _item_is_safe_for_auto_text_cleanup(item: dict) -> bool:
    if _should_force_bbox_redaction(item):
        return False
    if item_has_formula(item) or is_direct_typst_math_mode(item):
        return False
    if item.get("render_formula_map") or item.get("translation_unit_formula_map") or item.get("group_formula_map"):
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
    diagnostics = _new_redaction_diagnostics(valid_items)
    cover_rects = _cover_rects_from_valid_items(valid_items)
    if flat_cover:
        draw_flat_white_covers(page, cover_rects)
    else:
        draw_white_covers(page, cover_rects)

    diagnostics["cover_rects"] = len(cover_rects)
    diagnostics["fast_page_cover_only"] = True
    diagnostics["route"] = "auto"
    diagnostics["strategy"] = "auto"

    protected_math_rects = collect_page_math_protection_rects(page)
    non_math_span_heights = collect_page_non_math_span_heights(page)
    if page_has_intrusive_math_protection(valid_items, protected_math_rects, non_math_span_heights):
        diagnostics["auto_text_cleanup_skipped_reason"] = "intrusive_math_protection"
        return diagnostics

    removable_rects: list[fitz.Rect] = []
    skipped_risky_items = 0
    for rect, item, _translated_text in valid_items:
        if not _item_is_safe_for_auto_text_cleanup(item):
            skipped_risky_items += 1
            continue
        item_rects = item_removable_text_rects(page, item, rect)
        diagnostics["raw_removable_rects"] = int(diagnostics["raw_removable_rects"]) + len(item_rects)
        removable_rects.extend(item_rects)

    merged_removable_rects = _merge_rects(removable_rects)
    diagnostics["merged_removable_rects"] = len(merged_removable_rects)
    diagnostics["auto_text_cleanup_items_skipped"] = skipped_risky_items
    if merged_removable_rects:
        _remove_text_under_rects(page, merged_removable_rects)
    return diagnostics


def apply_image_page_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
) -> dict[str, object]:
    diagnostics = _new_redaction_diagnostics(valid_items)
    rects = [rect for rect, _item, _translated_text in valid_items]
    diagnostics["cover_rects"] = len(rects)
    diagnostics["route"] = "image_page_redaction"
    diagnostics["strategy"] = "text_redaction"
    prepared_covers = prepare_background_covers(page, rects)
    for rect in rects:
        page.add_redact_annot(rect, fill=False)
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_PIXELS,
        graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED,
        text=fitz.PDF_REDACT_TEXT_REMOVE,
    )
    apply_prepared_background_covers(page, prepared_covers)
    return diagnostics


def apply_vector_heavy_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
) -> dict[str, object]:
    diagnostics = _new_redaction_diagnostics(valid_items)
    rects = [rect for rect, _item, _translated_text in valid_items]
    diagnostics["cover_rects"] = len(rects)
    diagnostics["route"] = "vector_heavy_redaction"
    diagnostics["strategy"] = "text_redaction"
    draw_white_covers(page, rects)
    for rect in rects:
        page.add_redact_annot(rect, fill=False)
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_PIXELS,
        graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED,
        text=fitz.PDF_REDACT_TEXT_REMOVE,
    )
    return diagnostics


def apply_standard_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
    *,
    fill_background: bool | None = None,
) -> dict[str, object]:
    diagnostics = _new_redaction_diagnostics(valid_items)
    diagnostics["strategy"] = "text_redaction"
    drawing_rects = collect_page_drawing_rects(page)
    if fill_background is None and page_should_use_cover_only(drawing_rects):
        cover_rects = _cover_rects_from_valid_items(valid_items)
        draw_white_covers(page, cover_rects)
        _remove_text_under_rects(page, cover_rects)
        diagnostics["cover_rects"] = len(cover_rects)
        diagnostics["fast_page_cover_only"] = True
        diagnostics["route"] = "cover_only_page"
        return diagnostics

    redactions: list[tuple[fitz.Rect, tuple[float, float, float] | None]] = []
    cover_rects: list[fitz.Rect] = []
    removable_counts: list[int] = []
    for rect, item, _translated_text in valid_items:
        if fill_background is None:
            if _should_force_visual_cover(item):
                cover_rects.append(rect)
                diagnostics["item_fast_cover_count"] = int(diagnostics["item_fast_cover_count"]) + 1
                continue
            if _should_force_bbox_redaction(item):
                redactions.append((rect, None))
                continue
            removable_rects = item_removable_text_rects(page, item, rect)
            raw_count = len(removable_rects)
            diagnostics["raw_removable_rects"] = int(diagnostics["raw_removable_rects"]) + raw_count
            if raw_count:
                removable_counts.append(raw_count)
            merged_removable_rects = _merge_rects(removable_rects)
            merged_count = len(merged_removable_rects)
            diagnostics["merged_removable_rects"] = int(diagnostics["merged_removable_rects"]) + merged_count
            removable = bool(merged_removable_rects)
            if raw_count >= ITEM_REMOVABLE_RECTS_FAST_COVER_THRESHOLD:
                cover_rects.append(rect)
                diagnostics["item_fast_cover_count"] = int(diagnostics["item_fast_cover_count"]) + 1
                continue
            if removable:
                for removable_rect in merged_removable_rects:
                    redactions.append((removable_rect, None))
                continue
            cover_rects.append(rect)
            continue
        else:
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
            page_cover_rects = _cover_rects_from_valid_items(valid_items)
            draw_white_covers(page, page_cover_rects)
            _remove_text_under_rects(page, page_cover_rects)
            diagnostics["cover_rects"] = len(page_cover_rects)
            diagnostics["fast_page_cover_only"] = True
            diagnostics["route"] = "fast_page_cover_only"
            return diagnostics

    merged_cover_rects = _merge_rects(cover_rects)
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


def apply_redaction_route(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
    *,
    fill_background: bool | None = None,
    cover_only: bool = False,
    strategy: str | None = None,
) -> dict[str, object]:
    resolved_strategy = _resolve_redaction_strategy(strategy, cover_only=cover_only)
    if resolved_strategy == "auto":
        return apply_auto_redaction(
            page,
            valid_items,
            flat_cover=cover_only,
        )

    if resolved_strategy == "visual_only":
        return apply_visual_redaction(
            page,
            valid_items,
            remove_text_layer=False,
            flat_cover=cover_only,
            route="visual_only",
        )

    if resolved_strategy == "visual_and_text":
        return apply_visual_redaction(
            page,
            valid_items,
            remove_text_layer=True,
            flat_cover=cover_only,
            route="visual_and_text",
        )

    if page_has_large_background_image(page):
        return apply_image_page_redaction(page, valid_items)

    drawing_count = page_drawing_count(page)
    if fill_background is None and page_should_use_cover_only_count(drawing_count):
        cover_rects = _cover_rects_from_valid_items(valid_items)
        draw_flat_white_covers(page, cover_rects)
        _remove_text_under_rects(page, cover_rects)
        diagnostics = _new_redaction_diagnostics(valid_items)
        diagnostics["cover_rects"] = len(cover_rects)
        diagnostics["fast_page_cover_only"] = True
        diagnostics["route"] = "cover_only_count"
        diagnostics["strategy"] = "text_redaction"
        return diagnostics

    if fill_background is None and page_is_vector_heavy_count(drawing_count):
        return apply_vector_heavy_redaction(page, valid_items)

    return apply_standard_redaction(page, valid_items, fill_background=fill_background)
