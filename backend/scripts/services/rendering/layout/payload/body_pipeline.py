from __future__ import annotations

from math import ceil
from statistics import median

from services.rendering.layout.font_fit import BODY_LEADING_MAX
from services.rendering.layout.payload.body_context import BODY_DENSITY_TARGET_MAX
from services.rendering.layout.payload.body_context import is_same_column_adjacent_body_pair
from services.rendering.layout.payload.body_context import payload_center_x
from services.rendering.layout.payload.body_context import payload_inner_bottom
from services.rendering.layout.payload.body_context import payload_inner_top
from services.rendering.layout.payload.body_context import smooth_adjacent_body_pair
from services.rendering.layout.payload.metrics import estimated_render_height_pt
from services.rendering.layout.payload.metrics import text_demand_units


BODY_DENSITY_TARGET_MIN = 0.82
BODY_PRESSURE_TIGHTEN_TRIGGER = 1.38
BODY_PRESSURE_TIGHTEN_TRIGGER_HIGH = 1.30
BODY_FINAL_FORCE_FIT_DENSITY = 1.12
SMALL_BOX_GROW_DENSITY_TRIGGER = 0.88
SMALL_BOX_GROW_FONT_GAP = 0.1
SMALL_BOX_GROW_STEP = 0.22
SMALL_BOX_GROW_ELIGIBLE_MAX_DENSITY = 1.02
SMALL_BOX_GROW_MAX_DENSITY = 1.03


def _payload_density(payload: dict, *, font_size_pt: float | None = None, leading_em: float | None = None) -> float:
    inner_height = max(8.0, payload["inner_bbox"][3] - payload["inner_bbox"][1])
    estimated_height = estimated_render_height_pt(
        payload["inner_bbox"],
        payload["translated_text"],
        payload["formula_map"],
        font_size_pt if font_size_pt is not None else payload["font_size_pt"],
        leading_em if leading_em is not None else payload["leading_em"],
    )
    return estimated_height / inner_height


def _resolve_body_targets(body_payloads: list[dict]) -> tuple[float, float, float]:
    body_font_median = median(payload["font_size_pt"] for payload in body_payloads)
    for payload in body_payloads:
        payload["page_body_font_size_pt"] = round(body_font_median, 2)

    body_density_values = []
    body_pressure_values = []
    for payload in body_payloads:
        inner_height = max(8.0, payload["inner_bbox"][3] - payload["inner_bbox"][1])
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


def _tighten_body_payloads(
    body_payloads: list[dict],
    *,
    body_font_median: float,
    body_density_target: float,
    body_pressure_median: float,
) -> None:
    for payload in body_payloads:
        payload["font_size_pt"] = round(min(max(payload["font_size_pt"], body_font_median - 0.10), body_font_median + 0.14), 2)
        inner_height = max(8.0, payload["inner_bbox"][3] - payload["inner_bbox"][1])
        inner_width = max(8.0, payload["inner_bbox"][2] - payload["inner_bbox"][0])
        demand = text_demand_units(payload["translated_text"], payload["formula_map"])
        pressure = demand / max(1.0, inner_width * inner_height)
        pressure_ratio = pressure / max(body_pressure_median, 1e-6) if body_pressure_median > 0 else 1.0
        density = _payload_density(payload)
        pressure_trigger = BODY_PRESSURE_TIGHTEN_TRIGGER_HIGH if density > body_density_target + 0.03 else BODY_PRESSURE_TIGHTEN_TRIGGER

        if pressure_ratio > pressure_trigger and payload["dense_small_box"] and density > body_density_target + 0.04:
            steps = min(3, max(1, ceil((pressure_ratio - pressure_trigger) / 0.26)))
            payload["font_size_pt"] = round(max(body_font_median - 0.34, payload["font_size_pt"] - steps * 0.08), 2)
            payload["leading_em"] = round(min(BODY_LEADING_MAX, payload["leading_em"] + 0.01 * min(steps, 2)), 2)
            payload["prefer_typst_fit"] = True
            density = _payload_density(payload)

        if density > body_density_target + 0.06 and payload["dense_small_box"] and pressure_ratio > BODY_PRESSURE_TIGHTEN_TRIGGER_HIGH:
            payload["prefer_typst_fit"] = True
        elif density < body_density_target - 0.12 and pressure_ratio < 0.94:
            steps = min(2, max(1, ceil((body_density_target - density) / 0.12)))
            payload["font_size_pt"] = round(min(body_font_median + 0.08, payload["font_size_pt"] + steps * 0.04), 2)


def _mark_force_fit_dense_outliers(body_payloads: list[dict]) -> None:
    for payload in body_payloads:
        if payload["heavy_dense_small_box"] and _payload_density(payload) > BODY_FINAL_FORCE_FIT_DENSITY:
            payload["prefer_typst_fit"] = True


def _grow_underfilled_body_payloads(body_payloads: list[dict], *, body_font_median: float) -> None:
    for payload in body_payloads:
        density = _payload_density(payload)
        eligible_max_density = SMALL_BOX_GROW_ELIGIBLE_MAX_DENSITY if payload["dense_small_box"] else 0.9
        if density >= eligible_max_density:
            continue

        grow_font_gap = SMALL_BOX_GROW_FONT_GAP if payload["dense_small_box"] else 0.2
        if payload["font_size_pt"] >= body_font_median - grow_font_gap:
            continue

        candidate_step = SMALL_BOX_GROW_STEP if payload["dense_small_box"] and density <= SMALL_BOX_GROW_DENSITY_TRIGGER else 0.12
        candidate_cap = body_font_median - 0.12
        candidate_font = round(min(candidate_cap, payload["font_size_pt"] + candidate_step), 2)
        candidate_density = _payload_density(payload, font_size_pt=candidate_font)
        max_candidate_density = SMALL_BOX_GROW_MAX_DENSITY if payload["dense_small_box"] else 0.94
        if candidate_density <= max_candidate_density:
            payload["font_size_pt"] = candidate_font


def _harmonize_long_body_payloads(body_payloads: list[dict], *, page_text_width_med: float) -> None:
    long_body_payloads = []
    for payload in body_payloads:
        inner_width = max(8.0, payload["inner_bbox"][2] - payload["inner_bbox"][0])
        inner_height = max(8.0, payload["inner_bbox"][3] - payload["inner_bbox"][1])
        if inner_height < 90 or inner_width < page_text_width_med * 0.72:
            continue
        if _payload_density(payload) > 0.98:
            continue
        long_body_payloads.append(payload)

    if len(long_body_payloads) < 2:
        return

    long_body_font_median = median(payload["font_size_pt"] for payload in long_body_payloads)
    long_body_leading_median = median(payload["leading_em"] for payload in long_body_payloads)
    for payload in long_body_payloads:
        payload["font_size_pt"] = round(
            min(max(payload["font_size_pt"], long_body_font_median - 0.14), long_body_font_median + 0.14),
            2,
        )
        payload["leading_em"] = round(
            min(max(payload["leading_em"], long_body_leading_median - 0.05), long_body_leading_median + 0.05),
            2,
        )


def _smooth_adjacent_body_payloads(body_payloads: list[dict], *, page_text_width_med: float) -> None:
    body_payloads_by_top = sorted(body_payloads, key=lambda payload: (payload["inner_bbox"][1], payload["inner_bbox"][0]))
    smoothed_pairs: set[tuple[int, int]] = set()
    for index, current in enumerate(body_payloads_by_top):
        best_next = None
        best_key = None
        for nxt in body_payloads_by_top[index + 1 :]:
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


def apply_body_payload_pipeline(ordered_payloads: list[dict], *, page_text_width_med: float) -> None:
    body_payloads = [payload for payload in ordered_payloads if payload["is_body"]]
    if not body_payloads:
        return

    body_font_median, body_density_target, body_pressure_median = _resolve_body_targets(body_payloads)
    _tighten_body_payloads(
        body_payloads,
        body_font_median=body_font_median,
        body_density_target=body_density_target,
        body_pressure_median=body_pressure_median,
    )
    _mark_force_fit_dense_outliers(body_payloads)

    body_font_median = median(payload["font_size_pt"] for payload in body_payloads)
    _grow_underfilled_body_payloads(body_payloads, body_font_median=body_font_median)
    _harmonize_long_body_payloads(body_payloads, page_text_width_med=page_text_width_med)
    _smooth_adjacent_body_payloads(body_payloads, page_text_width_med=page_text_width_med)
