from __future__ import annotations

from retainpdf_pipeline.render.layout.payload.body_context import is_same_column_adjacent_body_pair
from retainpdf_pipeline.render.layout.payload.body_context import payload_center_x
from retainpdf_pipeline.render.layout.payload.body_context import payload_inner_bottom
from retainpdf_pipeline.render.layout.payload.body_context import payload_inner_top
from retainpdf_pipeline.render.layout.payload.body_context import smooth_adjacent_body_pair
from retainpdf_pipeline.render.layout.payload.body_common import payload_is_continuation_member
from retainpdf_pipeline.render.layout.payload.reading_sort import sort_payloads_by_reading_order


def smooth_adjacent_body_payloads(body_payloads: list[dict], *, page_text_width_med: float) -> None:
    # Reading-order-first (double-column): global sorted((y, x)) would smooth
    # left-column text with right-column text sharing a similar y.
    body_payloads_by_top = sort_payloads_by_reading_order(body_payloads)
    smoothed_pairs: set[tuple[int, int]] = set()
    for index, current in enumerate(body_payloads_by_top):
        if payload_is_continuation_member(current):
            continue
        best_next = None
        best_key = None
        for nxt in body_payloads_by_top[index + 1 :]:
            if payload_is_continuation_member(nxt):
                continue
            if not is_same_column_adjacent_body_pair(current, nxt, page_text_width_med=page_text_width_med):
                continue
            gap = max(-4.0, payload_inner_top(nxt) - payload_inner_bottom(current))
            center_delta = abs(payload_center_x(current) - payload_center_x(nxt))
            key = (gap, center_delta)
            if best_key is None or key < best_key:
                best_key = key
                best_next = nxt
        if best_next is None:
            continue
        pair_key = (id(current), id(best_next))
        if pair_key in smoothed_pairs:
            continue
        smooth_adjacent_body_pair(current, best_next)
        smoothed_pairs.add(pair_key)
