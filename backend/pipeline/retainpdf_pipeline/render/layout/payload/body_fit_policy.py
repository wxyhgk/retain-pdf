from __future__ import annotations

from statistics import median

from retainpdf_pipeline.render.layout.payload.body_common import BODY_CONTEXT_MIN_ANCHORS
from retainpdf_pipeline.render.layout.payload.body_common import SHORT_BODY_INHERIT_MAX_HEIGHT_PT
from retainpdf_pipeline.render.layout.payload.body_common import body_context_anchors
from retainpdf_pipeline.render.layout.payload.body_common import is_body_context_text_payload
from retainpdf_pipeline.render.layout.payload.body_common import payload_height
from retainpdf_pipeline.render.layout.payload.body_common import same_body_column


BODY_SHORT_HEIGHT_RELAX_RATIO = 1.55
BODY_SHORT_HEIGHT_RELAX_MAX_EXTRA_PT = 10.0


def relax_short_body_context_heights(
    body_payloads: list[dict],
    all_payloads: list[dict],
    *,
    page_text_width_med: float,
) -> None:
    anchors = body_context_anchors(body_payloads, page_text_width_med=page_text_width_med)
    if len(anchors) < BODY_CONTEXT_MIN_ANCHORS:
        return
    anchor_heights = [payload_height(anchor) for anchor in anchors if payload_height(anchor) > SHORT_BODY_INHERIT_MAX_HEIGHT_PT]
    if not anchor_heights:
        return
    target_height = median(anchor_heights)
    for payload in all_payloads:
        if not is_body_context_text_payload(payload):
            continue
        if payload_height(payload) <= 0 or payload_height(payload) > SHORT_BODY_INHERIT_MAX_HEIGHT_PT:
            continue
        local_anchor_count = sum(
            1 for anchor in anchors if same_body_column(payload, anchor, page_text_width_med=page_text_width_med)
        )
        if local_anchor_count < BODY_CONTEXT_MIN_ANCHORS:
            continue
        relaxed_height = min(
            target_height,
            payload_height(payload) * BODY_SHORT_HEIGHT_RELAX_RATIO,
            payload_height(payload) + BODY_SHORT_HEIGHT_RELAX_MAX_EXTRA_PT,
        )
        if relaxed_height <= payload_height(payload) + 0.5:
            continue
        payload["_relaxed_fit_height_pt"] = round(relaxed_height, 2)
        payload["prefer_typst_fit"] = True
