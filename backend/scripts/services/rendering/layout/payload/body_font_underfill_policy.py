from __future__ import annotations

from math import exp
from statistics import median

from services.rendering.layout.payload.body_common import body_context_anchors
from services.rendering.layout.payload.body_common import is_body_context_text_payload
from services.rendering.layout.payload.body_common import payload_density
from services.rendering.layout.payload.body_common import required_lines
from services.rendering.layout.payload.body_common import same_body_column
from services.rendering.layout.typography.measurement import source_visual_line_count
from services.rendering.policy import typography_policy as typography
from services.rendering.policy.typography_decision import FontGrowthDecision
from services.rendering.policy.typography_decision import font_growth_grew_pt
from services.rendering.policy.typography_decision import font_growth_seed_font_pt
from services.rendering.policy.typography_decision import set_font_growth_decision


def grow_underfilled_body_payloads(
    body_payloads: list[dict],
    *,
    body_font_median: float,
    page_text_width_med: float,
) -> None:
    page_font_target = _page_font_target(body_payloads, body_font_median, page_text_width_med=page_text_width_med)
    page_underfill_ratio = _page_underfill_ratio(body_payloads)
    for payload in body_payloads:
        if not _is_underfilled_growth_candidate(payload):
            continue
        density = payload_density(payload)
        if density >= typography.BODY_UNDERFILLED_FONT_GROW_DENSITY_TRIGGER:
            continue

        previous_font = float(payload["font_size_pt"])
        if previous_font < page_font_target - typography.BODY_UNDERFILLED_FONT_GROW_LOW_FONT_SKIP_DELTA_PT:
            continue
        target_font = _target_font_for_payload(
            payload,
            page_font_target=page_font_target,
            density=density,
            page_underfill_ratio=page_underfill_ratio,
        )
        if target_font <= previous_font + 0.03:
            continue

        best = largest_font_within_density(payload, previous_font, target_font)
        if best <= previous_font + 0.04:
            continue

        payload["font_size_pt"] = round(best, 2)
        set_font_growth_decision(
            payload,
            FontGrowthDecision(
                seed_font_pt=previous_font,
                target_font_pt=float(payload["font_size_pt"]),
                slack_ratio=_density_slack_ratio(density),
            ),
        )


def harmonize_underfilled_body_fonts(
    body_payloads: list[dict],
    all_payloads: list[dict],
    *,
    page_text_width_med: float,
) -> None:
    anchors = body_context_anchors(body_payloads, page_text_width_med=page_text_width_med)
    if len(anchors) < 2:
        return
    eligible = [
        payload
        for payload in all_payloads
        if _is_underfilled_growth_candidate(payload)
        and is_body_context_text_payload(payload)
        and float(payload.get("font_size_pt") or 0.0) > 0
        and sum(1 for anchor in anchors if same_body_column(payload, anchor, page_text_width_med=page_text_width_med)) >= 2
    ]
    if len(eligible) < 2 or not any(font_growth_grew_pt(payload) for payload in eligible):
        return

    min_font = min(float(payload["font_size_pt"]) for payload in eligible)
    max_font = max(float(payload["font_size_pt"]) for payload in eligible)
    if min_font <= 0 or max_font / min_font > typography.BODY_UNDERFILLED_FONT_HARMONIZE_MAX_RATIO:
        return

    target_font = _low_harmonize_font(eligible)
    for payload in eligible:
        previous_font = float(payload["font_size_pt"])
        if previous_font <= target_font + 0.04:
            continue
        payload["font_size_pt"] = round(target_font, 2)
        seed_font = font_growth_seed_font_pt(payload, previous_font)
        if payload["font_size_pt"] > seed_font:
            set_font_growth_decision(
                payload,
                FontGrowthDecision(
                    seed_font_pt=seed_font,
                    target_font_pt=float(payload["font_size_pt"]),
                    slack_ratio=0.0,
                    reason="underfilled_body_harmonized",
                ),
            )


def recover_underfilled_body_density(body_payloads: list[dict]) -> None:
    for payload in body_payloads:
        if not _is_underfilled_growth_candidate(payload):
            continue
        if payload_density(payload) >= typography.BODY_UNDERFILLED_DENSITY_FLOOR_TRIGGER:
            continue
        _recover_payload_density(payload)


def _low_harmonize_font(payloads: list[dict]) -> float:
    fonts = sorted(float(payload["font_size_pt"]) for payload in payloads if float(payload.get("font_size_pt") or 0.0) > 0)
    if not fonts:
        return 0.0
    return fonts[0]


def _page_font_target(body_payloads: list[dict], body_font_median: float, *, page_text_width_med: float) -> float:
    anchors = [
        payload
        for payload in body_context_anchors(body_payloads, page_text_width_med=page_text_width_med)
        if not payload["dense_small_box"] and not payload["heavy_dense_small_box"]
    ]
    if not anchors:
        return body_font_median
    return max(body_font_median, median(float(payload["font_size_pt"]) for payload in anchors))


def _is_underfilled_growth_candidate(payload: dict) -> bool:
    if payload["dense_small_box"] or payload["heavy_dense_small_box"]:
        return False
    if payload["render_kind"] != "markdown" or payload["prefer_typst_fit"]:
        return False
    return required_lines(payload) <= typography.BODY_UNDERFILLED_FONT_GROW_MAX_LINES


def _target_font_for_payload(
    payload: dict,
    *,
    page_font_target: float,
    density: float,
    page_underfill_ratio: float,
) -> float:
    line_count = required_lines(payload)
    slack_ratio = _density_slack_ratio(density)
    source_line_weight = _source_line_rich_weight(payload, line_count)
    if line_count < typography.BODY_UNDERFILLED_FONT_GROW_MIN_LINES or _payload_height(payload) < typography.BODY_UNDERFILLED_FONT_GROW_MIN_HEIGHT_PT:
        context_cap = min(page_font_target, float(payload["font_size_pt"]) + typography.BODY_UNDERFILLED_FONT_GROW_SHORT_MAX_PT)
        return min(context_cap, float(payload["font_size_pt"]) + typography.BODY_UNDERFILLED_FONT_GROW_SHORT_MAX_PT)
    recovery_font = _font_for_recovery_density(payload, density)
    growth_budget = typography.BODY_UNDERFILLED_FONT_GROW_MAX_PT
    growth_budget += typography.BODY_UNDERFILLED_FONT_GROW_SHORT_LINE_BONUS * _short_line_weight(line_count)
    growth_budget += typography.BODY_UNDERFILLED_FONT_GROW_TALL_SLACK_BONUS * _height_slack_weight(payload, line_count)
    growth_budget += typography.BODY_UNDERFILLED_FONT_GROW_SOURCE_LINE_BONUS_PT * source_line_weight
    eased_growth = growth_budget * (1.0 - exp(-typography.BODY_UNDERFILLED_FONT_GROW_EXP_RATE * slack_ratio))
    context_cap = max(page_font_target, recovery_font)
    context_cap += typography.BODY_UNDERFILLED_FONT_GROW_PAGE_BONUS_PT * page_underfill_ratio
    context_cap += typography.BODY_UNDERFILLED_FONT_GROW_CONTEXT_BONUS_PT * slack_ratio
    context_cap += typography.BODY_UNDERFILLED_FONT_GROW_SOURCE_LINE_CAP_BONUS_PT * source_line_weight
    return min(context_cap, float(payload["font_size_pt"]) + eased_growth)


def _font_for_recovery_density(payload: dict, density: float) -> float:
    current_font = float(payload.get("font_size_pt") or 0.0)
    if current_font <= 0 or density <= 0:
        return current_font
    scale = (typography.BODY_UNDERFILLED_DENSITY_RECOVERY_TARGET / max(0.01, density)) ** 0.5
    return current_font * scale


def _recover_payload_density(payload: dict) -> None:
    target_density = _density_recovery_target(payload)
    for _ in range(typography.BODY_UNDERFILLED_RECOVERY_MAX_ITERATIONS):
        if payload_density(payload) >= target_density:
            return
        changed = _recover_payload_font_step(payload)
        if payload_density(payload) >= target_density:
            return
        changed = _recover_payload_leading_step(payload) or changed
        if not changed:
            return


def _recover_payload_font_step(payload: dict) -> bool:
    current_font = float(payload.get("font_size_pt") or 0.0)
    if current_font <= 0:
        return False
    font_step = typography.BODY_UNDERFILLED_RECOVERY_FONT_STEP_PT
    if payload.get("_body_font_unified"):
        font_step = typography.BODY_UNDERFILLED_UNIFIED_FONT_MAX_STEP_PT
    if font_step <= 0:
        return False
    target_font = min(
        _font_for_recovery_density(payload, payload_density(payload)),
        current_font + font_step,
    )
    best = largest_font_within_density(
        payload,
        current_font,
        target_font,
        density_limit=typography.BODY_UNDERFILLED_DENSITY_SAFE_MAX,
    )
    if best <= current_font + 0.02:
        return False
    payload["font_size_pt"] = round(best, 2)
    return True


def _recover_payload_leading_step(payload: dict) -> bool:
    current_leading = float(payload.get("leading_em") or 0.0)
    if current_leading <= 0:
        return False
    target_leading = min(
        _leading_cap_for_recovery(payload),
        current_leading + typography.BODY_UNDERFILLED_RECOVERY_LEADING_STEP_EM,
    )
    best = _largest_leading_within_density(
        payload,
        current_leading,
        target_leading,
        density_limit=typography.BODY_UNDERFILLED_DENSITY_SAFE_MAX,
    )
    if best <= current_leading + 0.01:
        return False
    payload["leading_em"] = round(best, 2)
    return True


def _largest_leading_within_density(payload: dict, low: float, high: float, *, density_limit: float) -> float:
    best = low
    for _ in range(8):
        mid = (low + high) / 2.0
        if payload_density(payload, leading_em=mid) <= density_limit:
            best = mid
            low = mid
        else:
            high = mid
    return best


def _leading_cap_for_recovery(payload: dict) -> float:
    line_count = required_lines(payload)
    item = payload.get("item") or {}
    source_lines = item.get("lines") or []
    if line_count <= 2 or not source_lines:
        return typography.BODY_COMFORT_LOW_SOURCE_LINE_LEADING_MAX
    if len(source_lines) <= typography.BODY_COMFORT_LOW_SOURCE_LINE_COUNT_MAX:
        return typography.BODY_COMFORT_LOW_SOURCE_LINE_LEADING_MAX
    source_line_weight = _source_line_rich_weight(payload, line_count)
    return 0.82 + 0.20 * source_line_weight


def _density_recovery_target(payload: dict) -> float:
    line_count = required_lines(payload)
    item = payload.get("item") or {}
    has_source_lines = bool(item.get("lines") or [])
    if line_count <= 2:
        return typography.BODY_UNDERFILLED_DENSITY_RECOVERY_TARGET_SHORT
    if not has_source_lines:
        return typography.BODY_UNDERFILLED_DENSITY_RECOVERY_TARGET_NO_SOURCE
    return typography.BODY_UNDERFILLED_DENSITY_RECOVERY_TARGET


def largest_font_within_density(
    payload: dict,
    low: float,
    high: float,
    *,
    density_limit: float | None = None,
) -> float:
    best = low
    density_limit = _density_limit_for_payload(payload) if density_limit is None else density_limit
    for _ in range(9):
        mid = (low + high) / 2.0
        if payload_density(payload, font_size_pt=mid) <= density_limit:
            best = mid
            low = mid
        else:
            high = mid
    return best


def _density_limit_for_payload(payload: dict) -> float:
    line_count = required_lines(payload)
    source_line_bonus = typography.BODY_UNDERFILLED_FONT_GROW_SOURCE_LINE_DENSITY_BONUS * _source_line_rich_weight(
        payload,
        line_count,
    )
    if line_count <= 4:
        return typography.BODY_UNDERFILLED_FONT_GROW_DENSITY_LIMIT + source_line_bonus
    return min(
        typography.BODY_UNDERFILLED_FONT_GROW_DENSITY_LIMIT + source_line_bonus,
        1.00 + 0.01 * max(0, 8 - line_count) + source_line_bonus,
    )


def short_body_density_limit(payload: dict) -> float:
    return max(typography.BODY_UNDERFILLED_FONT_GROW_DENSITY_LIMIT + 0.08, _density_limit_for_payload(payload))


def _page_underfill_ratio(body_payloads: list[dict]) -> float:
    densities = [
        payload_density(payload)
        for payload in body_payloads
        if not payload["dense_small_box"] and not payload["heavy_dense_small_box"]
    ]
    if not densities:
        return 0.0
    page_density = median(densities)
    return _density_slack_ratio(page_density)


def _density_slack_ratio(density: float) -> float:
    slack_ratio = (typography.BODY_UNDERFILLED_FONT_GROW_DENSITY_TRIGGER - density) / max(
        0.01,
        typography.BODY_UNDERFILLED_FONT_GROW_DENSITY_TRIGGER,
    )
    return max(0.0, min(1.0, slack_ratio))


def _short_line_weight(line_count: int) -> float:
    return max(0.0, min(1.0, (5.0 - float(line_count)) / 4.0))


def _height_slack_weight(payload: dict, line_count: int) -> float:
    inner = payload.get("inner_bbox") or []
    font_size = float(payload.get("font_size_pt") or 0.0)
    if len(inner) != 4 or font_size <= 0 or line_count <= 0:
        return 0.0
    height = max(8.0, float(inner[3]) - float(inner[1]))
    natural_height = font_size * max(1, line_count) * 1.1
    return max(0.0, min(1.0, (height - natural_height) / max(height, 1.0)))


def _payload_height(payload: dict) -> float:
    inner = payload.get("inner_bbox") or []
    if len(inner) != 4:
        return 0.0
    return max(0.0, float(inner[3]) - float(inner[1]))


def _source_line_rich_weight(payload: dict, line_count: int) -> float:
    source_lines = source_visual_line_count(payload.get("item") or {})
    if source_lines <= 0 or line_count <= 0:
        return 0.0
    ratio = source_lines / max(1, line_count)
    return max(
        0.0,
        min(
            1.0,
            (ratio - typography.BODY_UNDERFILLED_FONT_GROW_SOURCE_LINE_RATIO_OFFSET)
            / typography.BODY_UNDERFILLED_FONT_GROW_SOURCE_LINE_RATIO_RANGE,
        ),
    )
