from __future__ import annotations

from services.rendering.core.models import RenderBlock
from services.rendering.formula.core.markdown import build_plain_text_from_text
from services.rendering.formula.mode_router import build_item_render_markdown
from services.rendering.layout.payload.metrics import resolve_typst_binary_fit


def payload_to_render_block(payload: dict) -> RenderBlock:
    fit_to_box, fit_min_font_size_pt, fit_min_leading_em, fit_max_height_pt = resolve_typst_binary_fit(
        {
            **payload["item"],
            "_is_body_text_candidate": payload["is_body"],
            "_dense_small_box": payload["dense_small_box"],
            "_heavy_dense_small_box": payload["heavy_dense_small_box"],
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
        font_weight=payload.get("font_weight", "regular"),
        fit_to_box=fit_to_box and payload["render_kind"] == "markdown",
        fit_min_font_size_pt=fit_min_font_size_pt,
        fit_min_leading_em=fit_min_leading_em,
        fit_max_height_pt=fit_max_height_pt,
        text_color=tuple(payload.get("text_color", (0, 0, 0))),
        cover_fill=tuple(payload.get("cover_fill", (1, 1, 1))),
    )


def emit_render_blocks(block_payloads: list[dict]) -> list[RenderBlock]:
    return [payload_to_render_block(payload) for payload in sorted(block_payloads, key=lambda payload: payload["index"])]
