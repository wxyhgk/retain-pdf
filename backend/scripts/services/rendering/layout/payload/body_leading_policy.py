from __future__ import annotations

from statistics import median

from services.rendering.layout.payload.body_common import required_lines
from services.rendering.layout.payload.body_leading_solver import annotate_body_vertical_budget
from services.rendering.layout.payload.body_leading_solver import solve_body_leading
from services.rendering.policy import typography_policy as typography
from services.rendering.policy.typography_decision import LeadingDecision
from services.rendering.policy.typography_decision import leading_refit_after_font_unify
from services.rendering.policy.typography_decision import set_leading_decision


def restore_comfort_body_leading(body_payloads: list[dict]) -> None:
    baseline = _page_body_leading_baseline(body_payloads)
    for payload in body_payloads:
        if not _eligible_for_body_leading(payload):
            continue
        _ensure_multiline_comfort_floor(payload)
        solution = solve_body_leading(payload, page_baseline_leading_em=baseline)
        if solution is None:
            continue
        if payload["leading_em"] >= solution.leading_em:
            continue
        annotate_body_vertical_budget(payload, solution)
        payload["leading_em"] = solution.leading_em
        set_leading_decision(
            payload,
            LeadingDecision(
                leading_em=solution.leading_em,
                target_density=solution.target_density,
                leading_cap_em=solution.leading_cap_em,
            ),
        )


def refit_body_leading_after_font_unify(body_payloads: list[dict]) -> None:
    baseline = _page_body_leading_baseline(body_payloads)
    for payload in body_payloads:
        if not _eligible_for_body_leading(payload):
            continue
        _ensure_multiline_comfort_floor(payload)
        solution = solve_body_leading(payload, page_baseline_leading_em=baseline)
        if solution is None:
            continue
        if payload["leading_em"] >= solution.leading_em:
            continue
        annotate_body_vertical_budget(payload, solution)
        payload["leading_em"] = solution.leading_em
        set_leading_decision(
            payload,
            LeadingDecision(
                leading_em=solution.leading_em,
                target_density=solution.target_density,
                leading_cap_em=solution.leading_cap_em,
                refit_after_font_unify=True,
            ),
        )


def _eligible_for_body_leading(payload: dict) -> bool:
    if payload["render_kind"] != "markdown":
        return False
    if payload["dense_small_box"] or payload["heavy_dense_small_box"] or payload["prefer_typst_fit"]:
        return False
    return True


def _page_body_leading_baseline(body_payloads: list[dict]) -> float | None:
    values = [
        float(payload.get("leading_em") or 0.0)
        for payload in body_payloads
        if _eligible_for_body_leading(payload)
        and float(payload.get("leading_em") or 0.0) > 0
        and not leading_refit_after_font_unify(payload)
    ]
    if len(values) < 2:
        return None
    return round(median(values), 2)


def _ensure_multiline_comfort_floor(payload: dict) -> None:
    if required_lines(payload) < 3:
        return
    current = float(payload.get("leading_em") or 0.0)
    if current >= typography.BODY_COMFORT_LEADING_MIN:
        return
    payload["leading_em"] = round(typography.BODY_COMFORT_LEADING_MIN, 2)
