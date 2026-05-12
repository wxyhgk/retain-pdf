from __future__ import annotations

from services.rendering.layout.font_fit import estimate_font_size_pt
from services.rendering.layout.font_fit import estimate_leading_em
from services.rendering.layout.font_fit import is_body_text_candidate
from services.rendering.layout.font_fit import is_title_like_block
from services.rendering.layout.font_fit import resolve_font_weight
from services.rendering.layout.font_fit import resolve_title_fill_max_font_size_pt
from services.rendering.layout.inline_content.core.markdown import build_plain_text_from_text
from services.rendering.layout.inline_content.mode_router import build_item_render_markdown
from services.rendering.layout.model.models import RenderLayoutBlock
from services.rendering.layout.page_fit import fit_body_font_size_pt
from services.rendering.layout.page_fit import should_fit_wrapped_markdown
from services.rendering.layout.payload.text_common import get_render_formula_map
from services.rendering.layout.payload.text_common import get_render_protected_text
from services.rendering.layout.payload.text_common import is_flag_like_plain_text_block
from services.rendering.layout.typography.geometry import cover_bbox
from services.rendering.layout.typography.geometry import inner_bbox


def layout_block_from_item(
    item: dict,
    *,
    page_index: int,
    page_font_size: float,
    page_line_pitch: float,
    page_line_height: float,
    density_baseline: float,
    page_text_width_med: float,
) -> RenderLayoutBlock | None:
    protected_text = get_render_protected_text(item)
    if not protected_text:
        return None

    formula_map = get_render_formula_map(item)
    body_candidate = is_body_text_candidate(item, page_text_width_med)
    item_with_flag = {**item, "_is_body_text_candidate": body_candidate}
    font_size_pt = estimate_font_size_pt(
        item_with_flag,
        page_font_size,
        page_line_pitch,
        page_line_height,
        density_baseline,
    )
    leading_em = estimate_leading_em(item_with_flag, page_line_pitch, font_size_pt)
    content_kind = "plain" if item.get("_force_plain_line") or is_flag_like_plain_text_block(item) else "markdown"
    markdown_text = build_item_render_markdown(item, protected_text, formula_map)
    plain_text = build_plain_text_from_text(markdown_text)
    title_like = is_title_like_block(item)
    if body_candidate and content_kind == "markdown":
        font_size_pt = fit_body_font_size_pt(
            item,
            markdown_text=markdown_text,
            formula_map=formula_map,
            font_size_pt=font_size_pt,
            leading_em=leading_em,
            page_font_size=page_font_size,
        )
    wrapped_markdown_candidate = content_kind == "markdown" and should_fit_wrapped_markdown(
        item,
        markdown_text,
        font_size_pt=font_size_pt,
        leading_em=leading_em,
    )
    fit_to_box = title_like or body_candidate or wrapped_markdown_candidate
    fit_single_line = bool(title_like and content_kind == "markdown")
    fit_min_font_size_pt = font_size_pt if title_like else max(7.2, round(font_size_pt - 0.8, 2))
    fit_max_font_size_pt = resolve_title_fill_max_font_size_pt(item, font_size_pt) if title_like else font_size_pt
    fit_min_leading_em = leading_em if title_like else max(0.22, round(leading_em - 0.08, 2))
    if wrapped_markdown_candidate and not body_candidate:
        fit_min_font_size_pt = max(7.2, round(font_size_pt - 2.2, 2))
        fit_min_leading_em = max(0.18, round(leading_em - 0.2, 2))

    item_inner_bbox = inner_bbox(item)
    return RenderLayoutBlock(
        block_id=f"item-{item.get('item_id', page_index)}",
        page_index=page_index,
        background_rect=list(cover_bbox(item)),
        content_rect=list(item_inner_bbox),
        content_kind=content_kind,
        content_text=plain_text if content_kind == "plain" else markdown_text,
        plain_text=plain_text,
        math_map=list(formula_map),
        font_size_pt=font_size_pt,
        leading_em=leading_em,
        font_weight=resolve_font_weight(item),
        fit_to_box=fit_to_box,
        fit_single_line=fit_single_line,
        fit_min_font_size_pt=fit_min_font_size_pt,
        fit_max_font_size_pt=fit_max_font_size_pt,
        fit_min_leading_em=fit_min_leading_em,
        fit_max_height_pt=max(8.0, item_inner_bbox[3] - item_inner_bbox[1]),
    )


__all__ = [
    "layout_block_from_item",
]
