from services.rendering.layout.font_fit import estimate_font_size_pt
from services.rendering.layout.font_fit import estimate_leading_em
from services.rendering.layout.font_fit import is_body_text_candidate
from services.rendering.layout.payload.capacity import box_capacity_units
from services.rendering.layout.payload.capacity import estimated_render_height_pt
from services.rendering.layout.payload.capacity import estimated_required_lines
from services.rendering.layout.payload.capacity import source_layout_density_reference
from services.rendering.layout.payload.capacity import text_demand_units
from services.rendering.layout.payload.fit import fit_block_to_vertical_limit
from services.rendering.layout.payload.fit import fit_translated_block_metrics
from services.rendering.layout.payload.fit import LAYOUT_DENSITY_SAFE_MAX
from services.rendering.layout.payload.fit import LAYOUT_DENSITY_SAFE_MIN
from services.rendering.layout.payload.fit import resolve_typst_binary_fit
from services.rendering.layout.payload.fit import VERTICAL_COLLISION_GAP_PT


def block_metrics(
    item: dict,
    page_font_size: float,
    page_line_pitch: float,
    page_line_height: float,
    density_baseline: float,
    page_text_width_med: float,
) -> tuple[float, float]:
    item = dict(item)
    item["_is_body_text_candidate"] = is_body_text_candidate(item, page_text_width_med)
    font_size_pt = estimate_font_size_pt(
        item,
        page_font_size,
        page_line_pitch,
        page_line_height,
        density_baseline,
    )
    leading_em = estimate_leading_em(item, page_line_pitch, font_size_pt)
    return font_size_pt, leading_em
