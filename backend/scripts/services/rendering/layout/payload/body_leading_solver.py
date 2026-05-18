from __future__ import annotations

from dataclasses import dataclass
from math import exp

from services.rendering.layout.font_fit import BODY_LEADING_MAX
from services.rendering.layout.font_fit import BODY_LEADING_MIN
from services.rendering.layout.payload.body_common import payload_density
from services.rendering.layout.payload.body_common import required_lines
from services.rendering.layout.typography.measurement import local_line_pitch
from services.rendering.layout.typography.measurement import median_line_pitch
from services.rendering.layout.typography.measurement import source_visual_line_count
from services.rendering.policy import typography_policy as typography
from services.rendering.policy.typography_decision import VerticalBudget
from services.rendering.policy.typography_decision import font_growth_grew_pt
from services.rendering.policy.typography_decision import font_growth_seed_font_pt
from services.rendering.policy.typography_decision import font_growth_slack_ratio
from services.rendering.policy.typography_decision import set_vertical_budget


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _exp_response(value: float, rate: float) -> float:
    return 1.0 - exp(-rate * max(0.0, value))


@dataclass(frozen=True)
class BodyLeadingContext:
    payload: dict
    current_density: float
    line_count: int
    source_lines: int
    has_source_line_geometry: bool
    source_leading_em: float
    font_growth_pt: float
    font_growth_score: float
    page_baseline_leading_em: float | None

    @classmethod
    def from_payload(cls, payload: dict, *, page_baseline_leading_em: float | None = None) -> BodyLeadingContext:
        item = payload.get("item") or {}
        font_size = max(0.1, float(payload.get("font_size_pt") or 0.0))
        pitch = local_line_pitch(item) or median_line_pitch(item)
        source_leading = pitch / font_size - 1.0 if pitch > 0 else 0.0
        grew = font_growth_grew_pt(payload)
        slack_ratio = font_growth_slack_ratio(payload)
        return cls(
            payload=payload,
            current_density=payload_density(payload),
            line_count=required_lines(payload),
            source_lines=source_visual_line_count(item),
            has_source_line_geometry=_has_source_line_geometry(item),
            source_leading_em=_clamp(source_leading, 0.0, typography.BODY_COMFORT_SOURCE_LINE_LEADING_MAX),
            font_growth_pt=max(0.0, grew),
            font_growth_score=_clamp(
                (grew / typography.BODY_COMFORT_FONT_GROWTH_NORMALIZER_PT) * max(0.0, slack_ratio),
                0.0,
                1.0,
            ),
            page_baseline_leading_em=page_baseline_leading_em,
        )

    @property
    def source_line_ratio(self) -> float:
        return self.source_lines / max(1, self.line_count)


@dataclass(frozen=True)
class BodyLeadingSolution:
    leading_em: float
    target_density: float
    leading_cap_em: float


def solve_body_leading(payload: dict, *, page_baseline_leading_em: float | None = None) -> BodyLeadingSolution | None:
    ctx = BodyLeadingContext.from_payload(payload, page_baseline_leading_em=page_baseline_leading_em)
    if ctx.current_density > typography.BODY_COMFORT_LEADING_DENSITY_MAX:
        return None
    if ctx.current_density >= typography.BODY_COMFORT_DENSITY_FLOOR_TRIGGER:
        return None

    leading_cap = _leading_cap(ctx)
    low = float(payload.get("leading_em") or BODY_LEADING_MIN)
    high = max(low, leading_cap)
    paired_low = _font_paired_min_leading(ctx, low, high)
    target_density = min(typography.BODY_COMFORT_LEADING_DENSITY_MAX, _target_density(ctx))
    if payload_density(payload, leading_em=paired_low) >= target_density:
        return None
    budget_high = max(paired_low, min(high, low + _leading_growth_budget(ctx)))

    best = _solve_leading_em(
        payload,
        low=paired_low,
        high=budget_high,
        target_density=target_density,
    )

    return BodyLeadingSolution(
        leading_em=round(max(float(payload.get("leading_em") or 0.0), best), 2),
        target_density=round(target_density, 3),
        leading_cap_em=round(leading_cap, 2),
    )


def annotate_body_vertical_budget(payload: dict, solution: BodyLeadingSolution) -> None:
    seed_font = font_growth_seed_font_pt(payload, float(payload.get("font_size_pt") or 0.0))
    current_font = float(payload.get("font_size_pt") or 0.0)
    current_leading = float(payload.get("leading_em") or 0.0)
    set_vertical_budget(
        payload,
        VerticalBudget(
            font_growth_pt=max(0.0, current_font - seed_font),
            leading_growth_em=max(0.0, solution.leading_em - current_leading),
            target_density=solution.target_density,
            leading_cap_em=solution.leading_cap_em,
        ),
    )


def _solve_leading_em(payload: dict, *, low: float, high: float, target_density: float) -> float:
    best = low
    low_density = payload_density(payload, leading_em=low)
    high_density = payload_density(payload, leading_em=high)
    low_residual = target_density - low_density
    high_residual = target_density - high_density

    for _ in range(typography.BODY_COMFORT_SOLVER_MAX_ITERATIONS):
        width = high - low
        if width <= typography.BODY_COMFORT_SOLVER_MIN_BRACKET_WIDTH:
            break
        trial = _residual_extrapolated_leading(
            low=low,
            high=high,
            low_residual=low_residual,
            high_residual=high_residual,
        )
        density = payload_density(payload, leading_em=trial)
        residual = target_density - density
        if abs(residual) <= typography.BODY_COMFORT_SOLVER_DENSITY_TOLERANCE:
            if density <= typography.BODY_COMFORT_LEADING_DENSITY_MAX and residual >= 0:
                best = trial
            break
        if density <= typography.BODY_COMFORT_LEADING_DENSITY_MAX and residual >= 0:
            best = trial
            low = trial
            low_residual = residual
        else:
            high = trial
            high_residual = residual
    return best


def _residual_extrapolated_leading(
    *,
    low: float,
    high: float,
    low_residual: float,
    high_residual: float,
) -> float:
    residual_span = low_residual - high_residual
    if abs(residual_span) <= 1e-9:
        return (low + high) / 2.0
    fraction = low_residual / residual_span
    fraction = _clamp(
        fraction,
        typography.BODY_COMFORT_SOLVER_EXTRAPOLATION_MIN_FRACTION,
        typography.BODY_COMFORT_SOLVER_EXTRAPOLATION_MAX_FRACTION,
    )
    return low + (high - low) * fraction


def _target_density(ctx: BodyLeadingContext) -> float:
    if ctx.line_count <= 2:
        return typography.BODY_COMFORT_DENSITY_RECOVERY_TARGET_SHORT
    if not ctx.has_source_line_geometry:
        return typography.BODY_COMFORT_DENSITY_RECOVERY_TARGET_NO_SOURCE
    if 0 < ctx.source_lines <= typography.BODY_COMFORT_LOW_SOURCE_LINE_COUNT_MAX:
        return min(
            typography.BODY_COMFORT_DENSITY_RECOVERY_TARGET,
            typography.BODY_COMFORT_LOW_SOURCE_LINE_TARGET_FILL_MAX,
        )
    return typography.BODY_COMFORT_DENSITY_RECOVERY_TARGET


def _leading_cap(ctx: BodyLeadingContext) -> float:
    if ctx.has_source_line_geometry and 0 < ctx.source_lines <= typography.BODY_COMFORT_LOW_SOURCE_LINE_COUNT_MAX:
        return _clamp(
            typography.BODY_COMFORT_LOW_SOURCE_LINE_LEADING_MAX,
            typography.BODY_COMFORT_LEADING_MIN,
            typography.BODY_COMFORT_SOURCE_LINE_LEADING_MAX,
        )
    if ctx.line_count <= 1:
        return BODY_LEADING_MAX

    line_extra = max(0.0, float(ctx.line_count - typography.BODY_COMFORT_LONG_LINE_THRESHOLD + 1))
    long_cap_target = typography.BODY_COMFORT_LONG_LEADING_MAX
    if ctx.source_lines <= 0:
        long_cap_target = typography.BODY_COMFORT_NO_SOURCE_LONG_LEADING_MAX
    long_line_cap = BODY_LEADING_MAX + _exp_response(line_extra, typography.BODY_COMFORT_LONG_LINE_CAP_RESPONSE_RATE) * (long_cap_target - BODY_LEADING_MAX)

    source_gap = max(0.0, ctx.source_line_ratio - 1.0)
    source_cap = BODY_LEADING_MAX + _exp_response(source_gap, typography.BODY_COMFORT_SOURCE_LINE_CAP_RESPONSE_RATE) * (
        typography.BODY_COMFORT_SOURCE_LINE_LEADING_MAX - BODY_LEADING_MAX
    )

    pitch_cap = BODY_LEADING_MAX + _exp_response(ctx.source_leading_em, typography.BODY_COMFORT_SOURCE_PITCH_CAP_RESPONSE_RATE) * (
        typography.BODY_COMFORT_SOURCE_LINE_LEADING_MAX - BODY_LEADING_MAX
    )
    cap = max(BODY_LEADING_MAX, long_line_cap, source_cap, pitch_cap)
    return _clamp(cap, typography.BODY_COMFORT_LEADING_MIN, typography.BODY_COMFORT_SOURCE_LINE_LEADING_MAX)


def _font_paired_min_leading(ctx: BodyLeadingContext, current_leading: float, leading_cap: float) -> float:
    if ctx.font_growth_pt <= 0:
        return current_leading
    line_weight = _exp_response(max(0.0, ctx.line_count - 1.0), typography.BODY_COMFORT_MULTI_LINE_WEIGHT_RATE)
    paired_gain = (
        typography.BODY_COMFORT_FONT_GROWTH_MIN_LEADING_GAIN_MAX
        * _exp_response(ctx.font_growth_pt, typography.BODY_COMFORT_FONT_GROWTH_MIN_LEADING_RATE)
        * line_weight
    )
    return _clamp(current_leading + paired_gain, current_leading, leading_cap)


def _leading_growth_budget(ctx: BodyLeadingContext) -> float:
    line_weight = _exp_response(max(0.0, ctx.line_count - 1.0), typography.BODY_COMFORT_MULTI_LINE_WEIGHT_RATE)
    long_text_bonus = typography.BODY_COMFORT_LEADING_GROWTH_LONG_TEXT_MAX * _exp_response(
        max(0.0, ctx.line_count - typography.BODY_COMFORT_LINE_COUNT_BASE),
        typography.BODY_COMFORT_LINE_COUNT_RESPONSE_RATE,
    )
    source_line_pressure = 0.0
    if ctx.has_source_line_geometry:
        source_line_pressure = _exp_response(
            max(0.0, float(ctx.source_lines) - typography.BODY_COMFORT_SOURCE_LINE_VOLUME_BASE),
            typography.BODY_COMFORT_SOURCE_LINE_VOLUME_RESPONSE_RATE,
        )
    source_pitch_pressure = _exp_response(
        max(0.0, ctx.source_leading_em - typography.BODY_COMFORT_LEADING_MIN),
        typography.BODY_COMFORT_SOURCE_PITCH_RESPONSE_RATE,
    )
    source_bonus = typography.BODY_COMFORT_LEADING_GROWTH_SOURCE_MAX * max(source_line_pressure, source_pitch_pressure)
    font_spend_penalty = typography.BODY_COMFORT_LEADING_FONT_SPEND_PENALTY_MAX * _exp_response(
        ctx.font_growth_pt,
        typography.BODY_COMFORT_FONT_GROWTH_MIN_LEADING_RATE,
    )
    if ctx.font_growth_pt > 0:
        floor = typography.BODY_COMFORT_LEADING_GROWTH_MIN_AFTER_FONT_GROWTH
    else:
        floor = 0.0
    return max(
        floor,
        typography.BODY_COMFORT_LEADING_GROWTH_BASE_MAX * line_weight
        + long_text_bonus
        + source_bonus
        - font_spend_penalty,
    )


def _has_source_line_geometry(item: dict) -> bool:
    lines = item.get("lines") or []
    return isinstance(lines, list) and bool(lines)
