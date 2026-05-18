from __future__ import annotations

import fitz

from services.rendering.source.background.fill import draw_flat_white_covers
from services.rendering.source.background.fill import draw_white_covers
from services.rendering.source.background.fill import apply_prepared_background_covers
from services.rendering.source.background.fill import prepare_background_covers
from services.rendering.source.cleanup.auto import apply_auto_redaction as _apply_auto_redaction
from services.rendering.source.cleanup.cover_only import apply_cover_only_count_redaction as _apply_cover_only_count_redaction
from services.rendering.source.cleanup.image_page import apply_image_page_redaction as _apply_image_page_redaction
from services.rendering.source.cleanup.math_intrusion import page_has_intrusive_math_protection
from services.rendering.source.cleanup.math_spans import collect_page_math_protection_rects
from services.rendering.source.cleanup.math_spans import collect_page_non_math_span_heights
from services.rendering.source.cleanup.route_context import RedactionRouteContext
from services.rendering.source.cleanup.route_context import build_redaction_route_context
from services.rendering.source.cleanup.route_decider import decide_redaction_execution
from services.rendering.source.cleanup.standard import apply_standard_redaction
from services.rendering.source.cleanup.strategy import resolve_redaction_route
from services.rendering.source.cleanup.text_matching import item_removable_text_rects
from services.rendering.source.cleanup.valid_items import iter_valid_redaction_items
from services.rendering.source.cleanup.vector_heavy import apply_vector_heavy_redaction as _apply_vector_heavy_redaction
from services.rendering.source.cleanup.visual_cover_execution import apply_visual_cover_redaction
from services.rendering.source.cleanup.plan_types import RedactionPlan
from services.rendering.source.text_redaction import remove_text_under_rects_with_pymupdf_redaction


def apply_auto_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
    *,
    flat_cover: bool = False,
) -> dict[str, object]:
    return _apply_auto_redaction(
        page,
        valid_items,
        flat_cover=flat_cover,
        collect_math_rects=collect_page_math_protection_rects,
        collect_span_heights=collect_page_non_math_span_heights,
        has_intrusive_math=page_has_intrusive_math_protection,
        item_text_rects=item_removable_text_rects,
        draw_covers=draw_white_covers,
        draw_flat_covers=draw_flat_white_covers,
        remove_text=remove_text_under_rects_with_pymupdf_redaction,
    )


def apply_cover_only_count_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
) -> dict[str, object]:
    return _apply_cover_only_count_redaction(
        page,
        valid_items,
        draw_covers=draw_flat_white_covers,
        remove_text=remove_text_under_rects_with_pymupdf_redaction,
    )


def apply_image_page_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
) -> dict[str, object]:
    return _apply_image_page_redaction(
        page,
        valid_items,
        prepare_covers=prepare_background_covers,
        apply_covers=apply_prepared_background_covers,
        draw_covers=draw_white_covers,
        remove_text=remove_text_under_rects_with_pymupdf_redaction,
    )


def apply_vector_heavy_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
) -> dict[str, object]:
    return _apply_vector_heavy_redaction(
        page,
        valid_items,
        draw_covers=draw_white_covers,
        remove_text=remove_text_under_rects_with_pymupdf_redaction,
    )


def apply_redaction_route(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
    *,
    fill_background: bool | None = None,
    cover_only: bool = False,
    strategy: str | None = None,
    plan: RedactionPlan | None = None,
) -> dict[str, object]:
    route = resolve_redaction_route(strategy, cover_only=cover_only)
    if route in ("auto", "visual_cover", "visual_cover_and_remove_text"):
        context = RedactionRouteContext(image_page=False, drawing_count=0)
    else:
        context = build_redaction_route_context(page, plan)
    decision = decide_redaction_execution(route, context, fill_background=fill_background)
    if decision.execution == "auto":
        return apply_auto_redaction(
            page,
            valid_items,
            flat_cover=cover_only,
        )

    if decision.execution == "visual_cover":
        return apply_visual_cover_redaction(
            page,
            valid_items,
            remove_text_layer=False,
            flat_cover=cover_only,
            route="visual_cover",
            draw_covers=draw_white_covers,
            draw_flat_covers=draw_flat_white_covers,
            remove_text=remove_text_under_rects_with_pymupdf_redaction,
        )

    if decision.execution == "visual_cover_and_remove_text":
        return apply_visual_cover_redaction(
            page,
            valid_items,
            remove_text_layer=True,
            flat_cover=cover_only,
            route="visual_cover_and_remove_text",
            draw_covers=draw_white_covers,
            draw_flat_covers=draw_flat_white_covers,
            remove_text=remove_text_under_rects_with_pymupdf_redaction,
        )

    if decision.execution == "image_page_redaction":
        return apply_image_page_redaction(page, valid_items)

    if decision.execution == "cover_only_count":
        return apply_cover_only_count_redaction(page, valid_items)

    if decision.execution == "vector_heavy_redaction":
        return apply_vector_heavy_redaction(page, valid_items)

    return apply_standard_redaction(page, valid_items, fill_background=fill_background, plan=plan)
