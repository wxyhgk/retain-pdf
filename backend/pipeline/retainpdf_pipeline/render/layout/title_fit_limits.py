from __future__ import annotations

from retainpdf_pipeline.render.layout.font_roles import is_title_like_block
from retainpdf_pipeline.render.layout.title_source_size import title_source_font_size_pt
from retainpdf_pipeline.render.layout.typography.geometry import inner_bbox


TITLE_FILL_MAX_FONT_SIZE_PT = 72.0
TITLE_FILL_HEIGHT_TO_FONT_RATIO = 0.92
TITLE_FILL_GROW_SCALE = 2.6
TITLE_FILL_MAX_FONT_SCALE = 3.0


def resolve_title_fill_max_font_size_pt(item: dict, base_font_size_pt: float) -> float:
    if not is_title_like_block(item):
        return round(base_font_size_pt, 2)
    # 标题不超过原文字号（title_source_size）：框是原文的行数撑出来的，译文行数变少时按框放大会把字放大将近一倍。
    # 下面按框放大的规则只剩给量不出原文字号（没有原文）的标题用。
    source_size = title_source_font_size_pt(item)
    if source_size is not None:
        return round(source_size, 2)
    scaled_cap = max(base_font_size_pt, base_font_size_pt * TITLE_FILL_MAX_FONT_SCALE)
    inner = inner_bbox(item)
    if len(inner) != 4:
        return round(
            min(
                TITLE_FILL_MAX_FONT_SIZE_PT,
                scaled_cap,
                base_font_size_pt,
            ),
            2,
        )
    height_pt = max(8.0, inner[3] - inner[1])
    height_cap = height_pt * TITLE_FILL_HEIGHT_TO_FONT_RATIO
    optimistic = min(
        TITLE_FILL_MAX_FONT_SIZE_PT,
        scaled_cap,
        max(base_font_size_pt, min(base_font_size_pt * TITLE_FILL_GROW_SCALE, height_cap)),
    )
    return round(max(base_font_size_pt, optimistic), 2)


__all__ = [
    "TITLE_FILL_GROW_SCALE",
    "TITLE_FILL_HEIGHT_TO_FONT_RATIO",
    "TITLE_FILL_MAX_FONT_SCALE",
    "TITLE_FILL_MAX_FONT_SIZE_PT",
    "resolve_title_fill_max_font_size_pt",
]
