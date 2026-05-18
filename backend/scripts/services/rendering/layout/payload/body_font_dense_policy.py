from __future__ import annotations

from math import ceil

from services.rendering.layout.payload.body_common import payload_density
from services.rendering.layout.payload.metrics import text_demand_units


BODY_PRESSURE_TIGHTEN_TRIGGER = 1.38
BODY_PRESSURE_TIGHTEN_TRIGGER_HIGH = 1.30
BODY_FINAL_FORCE_FIT_DENSITY = 1.12
BODY_FONT_SMOOTH_BAND_PT = 0.16
BODY_DENSE_FONT_MAX_PT = 10.35
BODY_HEAVY_DENSE_FONT_MAX_PT = 10.2
def tighten_body_payloads(
    body_payloads: list[dict],
    *,
    body_font_median: float,
    body_density_target: float,
    body_pressure_median: float,
) -> None:
    for payload in body_payloads:
        smooth_floor = payload["font_size_pt"]
        smooth_cap = body_font_median + BODY_FONT_SMOOTH_BAND_PT
        if payload["heavy_dense_small_box"]:
            smooth_cap = min(smooth_cap, BODY_HEAVY_DENSE_FONT_MAX_PT)
        elif payload["dense_small_box"]:
            smooth_cap = min(smooth_cap, BODY_DENSE_FONT_MAX_PT)
        if smooth_cap < smooth_floor:
            smooth_floor = smooth_cap
        payload["font_size_pt"] = round(min(max(payload["font_size_pt"], smooth_floor), smooth_cap), 2)
        inner_height = max(8.0, payload["inner_bbox"][3] - payload["inner_bbox"][1])
        inner_width = max(8.0, payload["inner_bbox"][2] - payload["inner_bbox"][0])
        demand = text_demand_units(payload["translated_text"], payload["formula_map"])
        pressure = demand / max(1.0, inner_width * inner_height)
        pressure_ratio = pressure / max(body_pressure_median, 1e-6) if body_pressure_median > 0 else 1.0
        density = payload_density(payload)
        pressure_trigger = BODY_PRESSURE_TIGHTEN_TRIGGER_HIGH if density > body_density_target + 0.03 else BODY_PRESSURE_TIGHTEN_TRIGGER

        if pressure_ratio > pressure_trigger and payload["dense_small_box"] and density > body_density_target + 0.04:
            steps = min(3, max(1, ceil((pressure_ratio - pressure_trigger) / 0.26)))
            shrink_floor = min(payload["font_size_pt"], body_font_median - 0.34)
            payload["font_size_pt"] = round(max(shrink_floor, payload["font_size_pt"] - steps * 0.08), 2)
            payload["leading_em"] = round(max(0.52, payload["leading_em"] - 0.01 * min(steps, 2)), 2)
            payload["prefer_typst_fit"] = True
            density = payload_density(payload)

        if density > body_density_target + 0.06 and payload["dense_small_box"] and pressure_ratio > BODY_PRESSURE_TIGHTEN_TRIGGER_HIGH:
            payload["prefer_typst_fit"] = True
        elif (
            not payload["dense_small_box"]
            and not payload["heavy_dense_small_box"]
            and density < body_density_target - 0.12
            and pressure_ratio < 0.94
        ):
            steps = min(2, max(1, ceil((body_density_target - density) / 0.12)))
            payload["font_size_pt"] = round(min(body_font_median + 0.08, payload["font_size_pt"] + steps * 0.04), 2)


def mark_force_fit_dense_outliers(body_payloads: list[dict]) -> None:
    for payload in body_payloads:
        if payload["heavy_dense_small_box"] and payload_density(payload) > BODY_FINAL_FORCE_FIT_DENSITY:
            payload["prefer_typst_fit"] = True
