from __future__ import annotations

from statistics import median

from services.rendering.layout.payload.body_common import BODY_CONTEXT_MIN_ANCHORS
from services.rendering.layout.payload.body_common import body_context_anchors
from services.rendering.layout.payload.body_common import is_body_context_text_payload
from services.rendering.layout.payload.body_common import payload_density
from services.rendering.layout.payload.body_common import payload_height
from services.rendering.layout.payload.body_common import payload_width
from services.rendering.layout.payload.body_common import required_lines
from services.rendering.layout.payload.body_common import same_body_column
from services.rendering.policy import typography_policy as typography


def unify_similar_body_fonts(
    body_payloads: list[dict],
    all_payloads: list[dict],
    *,
    page_text_width_med: float,
    book_body_font_target: float | None = None,
) -> None:
    anchors = _stable_body_font_anchors(body_payloads, page_text_width_med=page_text_width_med)
    if len(anchors) < typography.BODY_FONT_UNIFY_ANCHOR_COUNT:
        return
    eligible_payloads = _eligible_payloads(all_payloads, anchors, page_text_width_med=page_text_width_med)
    if len(eligible_payloads) < 2:
        return
    target_font = float(book_body_font_target or 0.0) or _low_page_font_target(eligible_payloads)
    if target_font <= 0:
        return

    for payload in eligible_payloads:
        _apply_page_font_target(payload, target_font)


def resolve_book_body_font_target(page_payloads: list[tuple[list[dict], float]]) -> float | None:
    eligible: list[dict] = []
    for block_payloads, page_text_width_med in page_payloads:
        body_payloads = [payload for payload in block_payloads if payload.get("is_body")]
        if len(_stable_body_font_anchors(body_payloads, page_text_width_med=page_text_width_med)) < typography.BODY_FONT_UNIFY_ANCHOR_COUNT:
            continue
        eligible.extend(
            payload
            for payload in block_payloads
            if _is_book_target_candidate(payload, page_text_width_med=page_text_width_med)
        )
    if len(eligible) < typography.BODY_FONT_UNIFY_ANCHOR_COUNT:
        return None
    return _low_page_font_target(eligible)


def _stable_body_font_anchors(body_payloads: list[dict], *, page_text_width_med: float) -> list[dict]:
    candidates = [
        payload
        for payload in body_payloads
        if is_body_context_text_payload(payload)
        and not payload["dense_small_box"]
        and not payload["heavy_dense_small_box"]
        and float(payload.get("font_size_pt") or 0.0) > 0
        and payload_width(payload) >= max(1.0, page_text_width_med * typography.BODY_FONT_UNIFY_ANCHOR_MIN_WIDTH_RATIO)
        and payload_height(payload) >= typography.BODY_FONT_UNIFY_ANCHOR_MIN_HEIGHT_PT
        and payload_density(payload) <= typography.BODY_FONT_UNIFY_ANCHOR_MAX_DENSITY
    ]
    if len(candidates) >= typography.BODY_FONT_UNIFY_ANCHOR_COUNT:
        return sorted(candidates, key=_anchor_score, reverse=True)[: typography.BODY_FONT_UNIFY_ANCHOR_COUNT]
    fallback = body_context_anchors(body_payloads, page_text_width_med=page_text_width_med)
    return [
        payload
        for payload in fallback
        if is_body_context_text_payload(payload) and float(payload.get("font_size_pt") or 0.0) > 0
    ]


def _anchor_score(payload: dict) -> float:
    text_len = len(str(payload.get("translated_text") or payload.get("source_text") or "").strip())
    return payload_height(payload) * 2.0 + payload_width(payload) * 0.25 + min(180.0, float(text_len))


def _eligible_payloads(all_payloads: list[dict], anchors: list[dict], *, page_text_width_med: float) -> list[dict]:
    return [
        payload
        for payload in all_payloads
        if _is_unify_candidate(payload, anchors, page_text_width_med=page_text_width_med)
    ]


def _is_unify_candidate(payload: dict, anchors: list[dict], *, page_text_width_med: float) -> bool:
    if not is_body_context_text_payload(payload):
        return False
    if float(payload.get("font_size_pt") or 0.0) <= 0:
        return False
    if payload_width(payload) < max(1.0, page_text_width_med * typography.BODY_FONT_UNIFY_CANDIDATE_MIN_WIDTH_RATIO):
        return False
    return any(same_body_column(payload, anchor, page_text_width_med=page_text_width_med) for anchor in anchors)


def _is_book_target_candidate(payload: dict, *, page_text_width_med: float) -> bool:
    return (
        is_body_context_text_payload(payload)
        and not payload["dense_small_box"]
        and not payload["heavy_dense_small_box"]
        and float(payload.get("font_size_pt") or 0.0) > 0
        and payload_width(payload) >= max(1.0, page_text_width_med * typography.BODY_FONT_UNIFY_ANCHOR_MIN_WIDTH_RATIO)
        and payload_height(payload) >= typography.BODY_FONT_UNIFY_ANCHOR_MIN_HEIGHT_PT
        and payload_density(payload) <= typography.BODY_FONT_UNIFY_ANCHOR_MAX_DENSITY
    )


def _low_page_font_target(payloads: list[dict]) -> float:
    fonts = sorted(float(payload["font_size_pt"]) for payload in payloads if float(payload.get("font_size_pt") or 0.0) > 0)
    if not fonts:
        return 0.0
    fonts = _without_extreme_small_fonts(fonts)
    index = int((len(fonts) - 1) * typography.BODY_FONT_UNIFY_TARGET_QUANTILE)
    return round(fonts[index], 2)


def _without_extreme_small_fonts(fonts: list[float]) -> list[float]:
    if len(fonts) < typography.BODY_FONT_UNIFY_MIN_FILTERED_COUNT + 1:
        return fonts
    median_font = median(fonts)
    floor = max(
        median_font * typography.BODY_FONT_UNIFY_EXTREME_SMALL_RATIO,
        median_font - typography.BODY_FONT_UNIFY_EXTREME_SMALL_DELTA_PT,
    )
    filtered = [font for font in fonts if font >= floor]
    if len(filtered) < typography.BODY_FONT_UNIFY_MIN_FILTERED_COUNT:
        return fonts
    return filtered


def _apply_page_font_target(payload: dict, target_font: float) -> None:
    current_font = float(payload["font_size_pt"])
    payload["page_body_font_size_pt"] = target_font
    if abs(current_font - target_font) <= typography.BODY_FONT_UNIFY_APPLY_TOLERANCE_PT:
        payload["font_size_pt"] = round(target_font, 2)
    elif current_font > target_font:
        payload["font_size_pt"] = round(target_font, 2)
    elif _can_render_unified_body_directly(payload):
        payload["font_size_pt"] = round(target_font, 2)
    elif payload_density(payload, font_size_pt=target_font) <= typography.BODY_FONT_UNIFY_GROW_DENSITY_LIMIT:
        payload["font_size_pt"] = round(target_font, 2)
    else:
        return
    payload["_body_font_unified"] = True
    if _can_render_unified_body_directly(payload):
        payload["prefer_typst_fit"] = False
    floor = float(payload.get("_short_body_inherited_font_floor_pt") or 0.0)
    if floor > 0:
        payload["_short_body_inherited_font_floor_pt"] = round(min(floor, payload["font_size_pt"]), 2)


def _can_render_unified_body_directly(payload: dict) -> bool:
    if not payload.get("dense_small_box") and not payload.get("heavy_dense_small_box"):
        return True
    return required_lines(payload) <= typography.BODY_FONT_UNIFY_DIRECT_DENSE_MAX_LINES
