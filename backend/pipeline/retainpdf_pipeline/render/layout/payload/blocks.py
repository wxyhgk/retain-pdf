from __future__ import annotations

from retainpdf_pipeline.foundation.config import layout
from retainpdf_pipeline.render.layout.payload.annotation_font_policy import recover_underfilled_annotation_density
from retainpdf_pipeline.render.layout.payload.annotation_font_policy import unify_annotation_fonts
from retainpdf_pipeline.render.layout.payload.block_seed import build_block_payloads
from retainpdf_pipeline.render.layout.payload.body_pipeline import apply_body_payload_pipeline
from retainpdf_pipeline.render.layout.payload.body_font_policy import resolve_book_body_font_target
from retainpdf_pipeline.render.layout.payload.collision import mark_adjacent_collision_risk
from retainpdf_pipeline.render.layout.payload.emit import emit_render_blocks
from retainpdf_pipeline.render.layout.model.models import RenderBlock
from retainpdf_pipeline.render.layout.payload.render_item import seed_render_fields
from retainpdf_pipeline.render.layout.payload.reading_sort import sort_payloads_by_reading_order
from retainpdf_pipeline.render.layout.typography_memory.learning import observe_payload_typography


def build_render_blocks(
    translated_items: list[dict],
    *,
    page_width: float | None = None,
    page_height: float | None = None,
    book_body_font_target: float | None = None,
) -> list[RenderBlock]:
    for item in translated_items:
        seed_render_fields(item)
    block_payloads, page_text_width_med = build_block_payloads(
        translated_items,
        page_width=page_width,
        page_height=page_height,
    )
    # Reading-order-first: on double-column pages a global sorted((y, x))
    # interleaves the right-column top into the left column. Bbox (y, x) is
    # only the in-column fallback (no reading_order -> legacy order).
    ordered_payloads = sort_payloads_by_reading_order(block_payloads)
    apply_body_payload_pipeline(
        ordered_payloads,
        page_text_width_med=page_text_width_med,
        book_body_font_target=book_body_font_target,
    )
    if layout.FONT_UNIFY_MODE != "off":
        unify_annotation_fonts(ordered_payloads)
    recover_underfilled_annotation_density(ordered_payloads)
    mark_adjacent_collision_risk(ordered_payloads)
    observe_payload_typography(ordered_payloads)
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
