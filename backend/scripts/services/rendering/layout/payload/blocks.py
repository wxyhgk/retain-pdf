from __future__ import annotations

from foundation.config import layout
from services.rendering.layout.payload.annotation_font_policy import recover_underfilled_annotation_density
from services.rendering.layout.payload.annotation_font_policy import unify_annotation_fonts
from services.rendering.layout.payload.block_seed import build_block_payloads
from services.rendering.layout.payload.body_pipeline import apply_body_payload_pipeline
from services.rendering.layout.payload.body_font_policy import resolve_book_body_font_target
from services.rendering.layout.payload.collision import mark_adjacent_collision_risk
from services.rendering.layout.payload.emit import emit_render_blocks
from services.rendering.layout.model.models import RenderBlock


def build_render_blocks(
    translated_items: list[dict],
    *,
    page_width: float | None = None,
    page_height: float | None = None,
    book_body_font_target: float | None = None,
) -> list[RenderBlock]:
    block_payloads, page_text_width_med = build_block_payloads(
        translated_items,
        page_width=page_width,
        page_height=page_height,
    )
    ordered_payloads = sorted(block_payloads, key=lambda payload: (payload["inner_bbox"][1], payload["inner_bbox"][0]))
    apply_body_payload_pipeline(
        ordered_payloads,
        page_text_width_med=page_text_width_med,
        book_body_font_target=book_body_font_target,
    )
    if layout.FONT_UNIFY_MODE != "off":
        unify_annotation_fonts(ordered_payloads)
    recover_underfilled_annotation_density(ordered_payloads)
    mark_adjacent_collision_risk(ordered_payloads)
    return emit_render_blocks(block_payloads)


def build_render_block_payloads(
    translated_items: list[dict],
    *,
    page_width: float | None = None,
    page_height: float | None = None,
) -> tuple[list[dict], float]:
    del page_height
    return build_block_payloads(translated_items, page_width=page_width)


def resolve_book_body_font_target_from_payloads(page_payloads: list[tuple[list[dict], float]]) -> float | None:
    if layout.FONT_UNIFY_MODE == "off":
        return None
    return resolve_book_body_font_target(page_payloads)
