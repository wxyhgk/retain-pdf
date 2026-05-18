from __future__ import annotations

from services.rendering.layout.model.models import RenderBlock
from services.rendering.layout.model.models import RenderLayoutBlock


def layout_block_to_render_block(block: RenderLayoutBlock) -> RenderBlock:
    return RenderBlock(
        block_id=block.block_id,
        bbox=list(block.background_rect),
        cover_bbox=list(block.background_rect),
        inner_bbox=list(block.content_rect),
        markdown_text=block.content_text,
        plain_text=block.plain_text,
        render_kind=block.content_kind,
        font_size_pt=block.font_size_pt,
        leading_em=block.leading_em,
        font_weight=block.font_weight,
        fit_to_box=block.fit_to_box,
        fit_single_line=block.fit_single_line,
        fit_min_font_size_pt=block.fit_min_font_size_pt,
        fit_max_font_size_pt=block.fit_max_font_size_pt,
        fit_min_leading_em=block.fit_min_leading_em,
        fit_max_height_pt=block.fit_max_height_pt,
        fit_target_width_pt=block.fit_target_width_pt,
        fit_target_height_pt=block.fit_target_height_pt,
        fit_shift_up_pt=block.fit_shift_up_pt,
        first_line_indent_pt=block.first_line_indent_pt,
        justify_text=block.justify_text,
        use_cover_fill=block.use_cover_fill,
        skip_reason=block.skip_reason,
    )


def render_block_protected_text(block: RenderBlock) -> str:
    return block.markdown_text if block.render_kind == "markdown" else block.plain_text


def render_block_math_map(block: RenderBlock | RenderLayoutBlock) -> list[dict]:
    if isinstance(block, RenderLayoutBlock):
        return block.math_map
    return list(block.math_map or [])
