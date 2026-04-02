from __future__ import annotations

from services.rendering.layout.payload.block_seed import build_block_payloads
from services.rendering.layout.payload.body_pipeline import apply_body_payload_pipeline
from services.rendering.layout.payload.collision import mark_adjacent_collision_risk
from services.rendering.layout.payload.emit import emit_render_blocks
from services.rendering.core.models import RenderBlock


def build_render_blocks(
    translated_items: list[dict],
    *,
    page_width: float | None = None,
    page_height: float | None = None,
) -> list[RenderBlock]:
    block_payloads, page_text_width_med = build_block_payloads(
        translated_items,
        page_width=page_width,
        page_height=page_height,
    )
    ordered_payloads = sorted(block_payloads, key=lambda payload: (payload["inner_bbox"][1], payload["inner_bbox"][0]))
    apply_body_payload_pipeline(ordered_payloads, page_text_width_med=page_text_width_med)
    mark_adjacent_collision_risk(ordered_payloads)
    return emit_render_blocks(block_payloads)
