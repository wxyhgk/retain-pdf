from __future__ import annotations

from services.rendering.layout.payload.collision_context import adjacent_collision_context
from services.rendering.layout.payload.collision_context import collision_fit_item
from services.rendering.layout.payload.metrics import estimated_render_height_pt
from services.rendering.layout.payload.fit_vertical import fit_block_to_vertical_limit
from services.rendering.policy import typography_policy as typography


VERTICAL_COLLISION_TRIGGER_RATIO = 0.9


def mark_adjacent_collision_risk(ordered_payloads: list[dict]) -> None:
    for current, nxt in zip(ordered_payloads, ordered_payloads[1:]):
        context = adjacent_collision_context(current, nxt)
        if context is None:
            continue

        estimated_height = estimated_render_height_pt(
            current["inner_bbox"],
            current["translated_text"],
            current["formula_map"],
            current["font_size_pt"],
            current["leading_em"],
        )
        if estimated_height <= context.max_height_pt * VERTICAL_COLLISION_TRIGGER_RATIO:
            continue

        if _has_unified_body_font(current):
            current["leading_em"] = round(
                max(typography.BODY_COLLISION_UNIFIED_MIN_LEADING_EM, min(float(current["leading_em"]), 0.56)),
                2,
            )
            current["_body_collision_leading_only"] = True
            continue

        current["adjacent_collision_risk"] = True
        fitted_font_size, fitted_leading = fit_block_to_vertical_limit(
            collision_fit_item(current),
            current["translated_text"],
            current["formula_map"],
            current["font_size_pt"],
            current["leading_em"],
            context.max_height_pt,
            page_body_font_size_pt=current["page_body_font_size_pt"],
        )
        current["font_size_pt"] = fitted_font_size
        current["leading_em"] = fitted_leading
        current["prefer_typst_fit"] = True
        _remember_adjacent_height_limit(current, context.max_height_pt)


def _has_unified_body_font(payload: dict) -> bool:
    if not payload.get("is_body"):
        return False
    page_font = float(payload.get("page_body_font_size_pt") or 0.0)
    font = float(payload.get("font_size_pt") or 0.0)
    return page_font > 0 and abs(font - page_font) <= typography.BODY_COLLISION_UNIFIED_FONT_TOLERANCE_PT


def _remember_adjacent_height_limit(payload: dict, max_height_pt: float) -> None:
    previous_limit = payload.get("adjacent_available_height_pt")
    if previous_limit is None or max_height_pt < previous_limit:
        payload["adjacent_available_height_pt"] = max(6.0, max_height_pt)
