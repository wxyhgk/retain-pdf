from __future__ import annotations

from statistics import median

from services.document_schema.semantics import is_bodylike_block
from services.document_schema.semantics import is_caption_like_block
from services.document_schema.semantics import is_footnote_like_block
from services.rendering.layout.payload.body_context import BODY_DENSITY_TARGET_MAX
from services.rendering.layout.payload.body_context import payload_center_x
from services.rendering.layout.payload.metrics import estimated_render_height_pt
from services.rendering.layout.payload.metrics import estimated_required_lines
from services.rendering.layout.payload.metrics import text_demand_units
from services.rendering.policy import typography_policy as typography
from services.translation.item_reader import item_block_kind


BODY_DENSITY_TARGET_MIN = 0.82
SHORT_BODY_INHERIT_MAX_HEIGHT_PT = 16.0
SHORT_BODY_INHERIT_LEFT_TOLERANCE_PT = 22.0
SHORT_BODY_INHERIT_CENTER_TOLERANCE_RATIO = 0.18
BODY_CONTEXT_MIN_ANCHORS = 2


def payload_density(payload: dict, *, font_size_pt: float | None = None, leading_em: float | None = None) -> float:
    inner_height = payload_density_height(payload)
    estimated_height = estimated_render_height_pt(
        payload["inner_bbox"],
        payload["translated_text"],
        payload["formula_map"],
        font_size_pt if font_size_pt is not None else payload["font_size_pt"],
        leading_em if leading_em is not None else payload["leading_em"],
    )
    return estimated_height / inner_height


def payload_density_height(payload: dict) -> float:
    return max(
        8.0,
        float(payload.get("density_effective_height_pt") or 0.0)
        or (payload["inner_bbox"][3] - payload["inner_bbox"][1]),
    )


def payload_width(payload: dict) -> float:
    return max(0.0, payload["inner_bbox"][2] - payload["inner_bbox"][0])


def payload_height(payload: dict) -> float:
    return max(0.0, payload["inner_bbox"][3] - payload["inner_bbox"][1])


def required_lines(payload: dict) -> int:
    inner = payload.get("inner_bbox") or []
    font_size = float(payload.get("font_size_pt") or 0.0)
    if len(inner) != 4 or font_size <= 0:
        return 1
    return estimated_required_lines(
        inner,
        payload.get("translated_text", ""),
        payload.get("formula_map", []),
        font_size,
    )


def resolve_body_targets(body_payloads: list[dict]) -> tuple[float, float, float]:
    annotate_tall_body_density_heights(body_payloads)
    stable_body_fonts = [
        payload["font_size_pt"]
        for payload in body_payloads
        if not payload["dense_small_box"] and not payload["heavy_dense_small_box"]
    ]
    body_font_median = median(stable_body_fonts or [payload["font_size_pt"] for payload in body_payloads])
    for payload in body_payloads:
        payload["page_body_font_size_pt"] = round(body_font_median, 2)

    body_density_values = []
    body_pressure_values = []
    for payload in body_payloads:
        inner_height = payload_density_height(payload)
        inner_width = max(8.0, payload["inner_bbox"][2] - payload["inner_bbox"][0])
        demand = text_demand_units(payload["translated_text"], payload["formula_map"])
        estimated_height = estimated_render_height_pt(
            payload["inner_bbox"],
            payload["translated_text"],
            payload["formula_map"],
            payload["font_size_pt"],
            payload["leading_em"],
        )
        body_density_values.append(estimated_height / inner_height)
        body_pressure_values.append(demand / max(1.0, inner_width * inner_height))

    body_density_target = median(body_density_values) if body_density_values else 0.72
    body_density_target = max(BODY_DENSITY_TARGET_MIN, min(BODY_DENSITY_TARGET_MAX, body_density_target))
    body_pressure_median = median(body_pressure_values) if body_pressure_values else 0.0
    return body_font_median, body_density_target, body_pressure_median


def annotate_tall_body_density_heights(body_payloads: list[dict]) -> None:
    ratios: list[float] = []
    candidates: list[tuple[dict, float, float, int]] = []
    for payload in body_payloads:
        payload.pop("density_effective_height_pt", None)
        payload.pop("density_height_ratio", None)
        payload.pop("density_height_policy", None)
        if not is_body_context_text_payload(payload):
            continue
        if payload.get("dense_small_box") or payload.get("heavy_dense_small_box"):
            continue
        line_count = required_lines(payload)
        bbox_h = payload_height(payload)
        if line_count < typography.BODY_TALL_BBOX_MIN_LINES or bbox_h < typography.BODY_TALL_BBOX_MIN_HEIGHT_PT:
            continue
        natural_h = _natural_body_text_height(payload, line_count)
        if natural_h <= 0:
            continue
        ratio = bbox_h / natural_h
        ratios.append(ratio)
        candidates.append((payload, ratio, natural_h, line_count))
    if not ratios:
        return
    page_ratio_ref = max(1.0, median(ratios))
    for payload, ratio, natural_h, line_count in candidates:
        if ratio < typography.BODY_TALL_BBOX_HEIGHT_RATIO_TRIGGER:
            continue
        if ratio < page_ratio_ref * typography.BODY_TALL_BBOX_PAGE_RATIO_MULTIPLIER:
            continue
        bbox_h = payload_height(payload)
        effective = min(
            bbox_h,
            max(
                bbox_h * typography.BODY_TALL_BBOX_EFFECTIVE_MIN_ORIGINAL_RATIO,
                natural_h * typography.BODY_TALL_BBOX_EFFECTIVE_NATURAL_MULTIPLIER,
            ),
        )
        if effective >= bbox_h - 0.5:
            continue
        payload["density_effective_height_pt"] = round(effective, 2)
        payload["density_height_ratio"] = round(ratio, 3)
        payload["density_height_policy"] = {
            "kind": "tall_body_bbox_effective_height",
            "bbox_height_pt": round(bbox_h, 2),
            "effective_height_pt": round(effective, 2),
            "natural_height_pt": round(natural_h, 2),
            "height_ratio": round(ratio, 3),
            "page_ratio_ref": round(page_ratio_ref, 3),
            "line_count": line_count,
        }


def _natural_body_text_height(payload: dict, line_count: int) -> float:
    font_size = float(payload.get("font_size_pt") or 0.0)
    leading = float(payload.get("leading_em") or 0.0)
    if font_size <= 0 or line_count <= 0:
        return 0.0
    return font_size * max(1, line_count) * (1.0 + max(0.0, leading))


def same_body_column(payload: dict, anchor: dict, *, page_text_width_med: float) -> bool:
    left_delta = abs(payload["inner_bbox"][0] - anchor["inner_bbox"][0])
    center_delta = abs(payload_center_x(payload) - payload_center_x(anchor))
    width_ref = max(page_text_width_med, payload_width(anchor), 1.0)
    return (
        left_delta <= SHORT_BODY_INHERIT_LEFT_TOLERANCE_PT
        or center_delta <= width_ref * SHORT_BODY_INHERIT_CENTER_TOLERANCE_RATIO
    )


def is_body_context_text_payload(payload: dict) -> bool:
    if payload["render_kind"] != "markdown":
        return False
    if payload.get("title_fit") is not None:
        return False
    item = payload.get("item") or {}
    if is_caption_like_block(item) or is_footnote_like_block(item):
        return False
    return payload["is_body"] or item_block_kind(item) == "text" or is_bodylike_block(item)


def body_context_anchors(body_payloads: list[dict], *, page_text_width_med: float) -> list[dict]:
    return [
        payload
        for payload in body_payloads
        if payload_width(payload) >= max(1.0, page_text_width_med * 0.72)
        and payload_height(payload) >= 18.0
    ]
