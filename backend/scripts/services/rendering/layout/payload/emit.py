from __future__ import annotations

from services.rendering.layout.model.models import RenderBlock
from services.rendering.layout.inline_content.core.markdown import build_plain_text_from_text
from services.rendering.layout.inline_content.mode_router import build_item_render_markdown
from services.rendering.layout.payload.metrics import resolve_typst_binary_fit
from services.rendering.policy import item_uses_white_overlay_fill


def payload_to_render_block(payload: dict) -> RenderBlock:
    title_fit = payload.get("title_fit")
    if title_fit is not None:
        fit_to_box = title_fit.fit_to_box
        fit_single_line = title_fit.fit_single_line
        fit_min_font_size_pt = title_fit.fit_min_font_size_pt
        fit_max_font_size_pt = title_fit.fit_max_font_size_pt
        fit_min_leading_em = title_fit.fit_min_leading_em
        fit_max_height_pt = title_fit.fit_max_height_pt
        fit_target_width_pt = title_fit.fit_target_width_pt
        fit_target_height_pt = title_fit.fit_target_height_pt
    else:
        fit_to_box, fit_min_font_size_pt, fit_min_leading_em, fit_max_height_pt = resolve_typst_binary_fit(
            {
                **payload["item"],
                "_render_inner_bbox": payload["inner_bbox"],
                "_is_body_text_candidate": payload["is_body"],
                "_dense_small_box": payload["dense_small_box"],
                "_heavy_dense_small_box": payload["heavy_dense_small_box"],
                "_short_body_inherited_font_floor_pt": payload.get("_short_body_inherited_font_floor_pt", 0.0),
                "_relaxed_fit_height_pt": payload.get("_relaxed_fit_height_pt", 0.0),
            },
            payload["translated_text"],
            payload["formula_map"],
            payload["font_size_pt"],
            payload["leading_em"],
            page_body_font_size_pt=payload["page_body_font_size_pt"],
            prefer_typst_fit=payload["prefer_typst_fit"],
            adjacent_collision_risk=payload["adjacent_collision_risk"],
            adjacent_available_height_pt=payload["adjacent_available_height_pt"],
        )
        if payload.get("_body_font_unified") and not payload.get("prefer_typst_fit"):
            fit_to_box = False
            fit_min_font_size_pt = 0.0
            fit_min_leading_em = 0.0
            fit_max_height_pt = 0.0
        fit_single_line = False
        fit_max_font_size_pt = 0.0
        fit_target_width_pt = 0.0
        fit_target_height_pt = 0.0
    return RenderBlock(
        block_id=f"item-{payload['index']}",
        bbox=payload["bbox"],
        cover_bbox=payload["cover_bbox"],
        inner_bbox=payload["inner_bbox"],
        markdown_text=build_item_render_markdown(payload["item"], payload["translated_text"], payload["formula_map"]),
        plain_text=build_plain_text_from_text(payload["translated_text"]),
        render_kind=payload["render_kind"],
        font_size_pt=payload["font_size_pt"],
        leading_em=payload["leading_em"],
        first_line_indent_pt=payload.get("first_line_indent_pt", 0.0),
        justify_text=bool(payload.get("is_body") and payload["render_kind"] == "markdown"),
        font_weight=payload.get("font_weight", "regular"),
        fit_to_box=bool(fit_to_box and payload["render_kind"] == "markdown"),
        fit_single_line=fit_single_line,
        fit_min_font_size_pt=fit_min_font_size_pt,
        fit_max_font_size_pt=fit_max_font_size_pt,
        fit_min_leading_em=fit_min_leading_em,
        fit_max_height_pt=fit_max_height_pt,
        fit_target_width_pt=fit_target_width_pt,
        fit_target_height_pt=fit_target_height_pt,
        text_color=tuple(payload.get("text_color", (0, 0, 0))),
        cover_fill=tuple(payload.get("cover_fill", (1, 1, 1))),
        use_cover_fill=item_uses_white_overlay_fill(payload["item"]),
        math_map=list(payload["formula_map"]),
        skip_reason="adjacent_collision_risk" if payload.get("adjacent_collision_risk") else "",
        source_item_id=str(payload["item"].get("item_id") or ""),
    )


def emit_render_blocks(block_payloads: list[dict]) -> list[RenderBlock]:
    return [payload_to_render_block(payload) for payload in sorted(block_payloads, key=lambda payload: payload["index"])]
