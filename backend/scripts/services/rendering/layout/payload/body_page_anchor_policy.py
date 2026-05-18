from __future__ import annotations

from services.rendering.layout.payload.body_common import is_body_context_text_payload
from services.rendering.layout.payload.body_common import payload_density
from services.rendering.layout.payload.body_common import payload_height
from services.rendering.layout.payload.body_common import payload_width
from services.rendering.layout.payload.body_common import same_body_column
from services.rendering.policy import typography_policy as typography
from services.rendering.policy.typography_decision import PageBodyAnchorDecision
from services.rendering.policy.typography_decision import set_page_body_anchor_decision


def apply_page_body_font_anchor(
    body_payloads: list[dict],
    all_payloads: list[dict],
    *,
    page_text_width_med: float,
) -> None:
    anchors = _page_body_font_anchors(body_payloads, page_text_width_med=page_text_width_med)
    if len(anchors) < typography.PAGE_BODY_FONT_ANCHOR_COUNT:
        return
    target_font = _low_anchor_font_target(anchors)
    for payload in all_payloads:
        if not _is_page_anchor_font_candidate(payload, page_text_width_med=page_text_width_med):
            continue
        if not any(same_body_column(payload, anchor, page_text_width_med=page_text_width_med) for anchor in anchors):
            continue
        current_font = float(payload["font_size_pt"])
        if current_font <= target_font + 0.04:
            payload["page_body_font_size_pt"] = target_font
            set_page_body_anchor_decision(payload, PageBodyAnchorDecision(target_font_pt=target_font, applied=True))
            continue
        payload["font_size_pt"] = target_font
        payload["page_body_font_size_pt"] = target_font
        set_page_body_anchor_decision(payload, PageBodyAnchorDecision(target_font_pt=target_font, applied=True))
        payload["_short_body_inherited_font_floor_pt"] = round(
            max(float(payload.get("_short_body_inherited_font_floor_pt") or 0.0), min(payload["font_size_pt"], target_font)),
            2,
        )


def _page_body_font_anchors(body_payloads: list[dict], *, page_text_width_med: float) -> list[dict]:
    candidates = [
        payload
        for payload in body_payloads
        if is_body_context_text_payload(payload)
        and not payload["dense_small_box"]
        and not payload["heavy_dense_small_box"]
        and float(payload.get("font_size_pt") or 0.0) > 0
        and payload_width(payload) >= max(1.0, page_text_width_med * typography.PAGE_BODY_FONT_ANCHOR_MIN_WIDTH_RATIO)
        and payload_height(payload) >= typography.PAGE_BODY_FONT_ANCHOR_MIN_HEIGHT_PT
        and _source_line_count(payload) >= typography.PAGE_BODY_FONT_ANCHOR_MIN_LINES
    ]
    return sorted(candidates, key=_anchor_score, reverse=True)[: typography.PAGE_BODY_FONT_ANCHOR_COUNT]


def _anchor_score(payload: dict) -> float:
    text_len = len(str(payload.get("translated_text") or payload.get("source_text") or "").strip())
    return payload_height(payload) * 2.0 + payload_width(payload) * 0.25 + min(160.0, float(text_len))


def _low_anchor_font_target(payloads: list[dict]) -> float:
    fonts = sorted(float(payload["font_size_pt"]) for payload in payloads if float(payload.get("font_size_pt") or 0.0) > 0)
    if not fonts:
        return 0.0
    return round(fonts[0], 2)


def _source_line_count(payload: dict) -> int:
    lines = (payload.get("item") or {}).get("lines") or []
    return len(lines) if isinstance(lines, list) else 0


def _is_page_anchor_font_candidate(payload: dict, *, page_text_width_med: float) -> bool:
    if not is_body_context_text_payload(payload):
        return False
    if payload["dense_small_box"] or payload["heavy_dense_small_box"]:
        return False
    if payload.get("prefer_typst_fit") and payload_density(payload) > typography.PAGE_BODY_FONT_ANCHOR_APPLY_DENSITY_LIMIT:
        return False
    return payload_width(payload) >= max(1.0, page_text_width_med * 0.32)
