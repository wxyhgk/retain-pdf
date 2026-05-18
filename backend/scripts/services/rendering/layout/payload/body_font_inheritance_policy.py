from __future__ import annotations

from statistics import median

from services.document_schema.semantics import is_bodylike_block
from services.document_schema.semantics import is_caption_like_block
from services.document_schema.semantics import is_footnote_like_block
from services.rendering.layout.payload.body_common import SHORT_BODY_INHERIT_MAX_HEIGHT_PT
from services.rendering.layout.payload.body_common import body_context_anchors
from services.rendering.layout.payload.body_common import payload_density
from services.rendering.layout.payload.body_common import payload_height
from services.rendering.layout.payload.body_common import payload_width
from services.rendering.layout.payload.body_common import required_lines
from services.rendering.layout.payload.body_common import same_body_column
from services.translation.item_reader import item_block_kind


SHORT_BODY_INHERIT_MIN_ANCHORS = 2
SHORT_BODY_INHERIT_MAX_WIDTH_RATIO = 1.18
SHORT_BODY_INHERIT_FONT_FLOOR_DELTA_PT = 0.75
LOW_HEIGHT_BODY_INHERIT_MAX_HEIGHT_RATIO = 0.72
LOW_HEIGHT_BODY_INHERIT_MAX_LINES = 8
LOW_HEIGHT_BODY_INHERIT_DENSITY_LIMIT = 1.08


def inherit_short_body_fonts(
    body_payloads: list[dict],
    all_payloads: list[dict],
    *,
    page_text_width_med: float,
) -> None:
    anchors = body_context_anchors(body_payloads, page_text_width_med=page_text_width_med)
    if len(anchors) < SHORT_BODY_INHERIT_MIN_ANCHORS:
        return
    page_anchor_font = median(payload["font_size_pt"] for payload in anchors)
    for payload in all_payloads:
        if not _is_short_body_inherit_candidate(payload, page_text_width_med=page_text_width_med):
            continue
        local_anchors = [
            anchor["font_size_pt"]
            for anchor in anchors
            if same_body_column(payload, anchor, page_text_width_med=page_text_width_med)
        ]
        if len(local_anchors) < 2:
            continue
        target_font = round(median(local_anchors or [page_anchor_font]), 2)
        target_font = min(target_font, page_anchor_font + 0.18)
        payload["_short_body_inherited_font_floor_pt"] = round(
            max(7.6, min(payload["font_size_pt"], target_font, page_anchor_font - SHORT_BODY_INHERIT_FONT_FLOOR_DELTA_PT)),
            2,
        )
        payload["page_body_font_size_pt"] = round(page_anchor_font, 2)


def inherit_low_height_body_fonts(
    body_payloads: list[dict],
    all_payloads: list[dict],
    *,
    page_text_width_med: float,
) -> None:
    anchors = body_context_anchors(body_payloads, page_text_width_med=page_text_width_med)
    if len(anchors) < SHORT_BODY_INHERIT_MIN_ANCHORS:
        return
    tall_anchors = [
        anchor
        for anchor in anchors
        if not anchor["dense_small_box"]
        and not anchor["heavy_dense_small_box"]
        and payload_height(anchor) > SHORT_BODY_INHERIT_MAX_HEIGHT_PT
    ]
    if len(tall_anchors) < SHORT_BODY_INHERIT_MIN_ANCHORS:
        return
    page_tall_height = median(payload_height(anchor) for anchor in tall_anchors)

    for payload in all_payloads:
        if not _is_low_height_body_inherit_candidate(payload):
            continue
        local_anchors = [
            anchor
            for anchor in tall_anchors
            if same_body_column(payload, anchor, page_text_width_med=page_text_width_med)
        ]
        if len(local_anchors) < SHORT_BODY_INHERIT_MIN_ANCHORS:
            continue
        local_height = median(payload_height(anchor) for anchor in local_anchors)
        height_ref = max(page_tall_height, local_height, 1.0)
        if payload_height(payload) > height_ref * LOW_HEIGHT_BODY_INHERIT_MAX_HEIGHT_RATIO:
            continue
        payload["page_body_font_size_pt"] = round(median(float(anchor["font_size_pt"]) for anchor in tall_anchors), 2)


def _is_short_body_inherit_candidate(payload: dict, *, page_text_width_med: float) -> bool:
    if payload["render_kind"] != "markdown":
        return False
    item = payload.get("item") or {}
    if is_caption_like_block(item) or is_footnote_like_block(item):
        return False
    if not payload["is_body"] and item_block_kind(item) != "text" and not is_bodylike_block(item):
        return False
    if payload.get("title_fit") is not None:
        return False
    if required_lines(payload) > 2:
        return False
    height = payload_height(payload)
    width = payload_width(payload)
    if height <= 0 or height > SHORT_BODY_INHERIT_MAX_HEIGHT_PT:
        return False
    if page_text_width_med <= 0 or width >= page_text_width_med * SHORT_BODY_INHERIT_MAX_WIDTH_RATIO:
        return False
    return bool(str(item.get("source_text") or item.get("protected_source_text") or "").strip())


def _is_low_height_body_inherit_candidate(payload: dict) -> bool:
    if payload["render_kind"] != "markdown":
        return False
    if payload["heavy_dense_small_box"] and payload_density(payload) > LOW_HEIGHT_BODY_INHERIT_DENSITY_LIMIT:
        return False
    if payload.get("title_fit") is not None:
        return False
    item = payload.get("item") or {}
    if is_caption_like_block(item) or is_footnote_like_block(item):
        return False
    if not payload["is_body"] and item_block_kind(item) != "text" and not is_bodylike_block(item):
        return False
    if required_lines(payload) > LOW_HEIGHT_BODY_INHERIT_MAX_LINES:
        return False
    return bool(str(item.get("source_text") or item.get("protected_source_text") or "").strip())
