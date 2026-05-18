from __future__ import annotations

from statistics import median

from services.document_schema.semantics import is_caption_like_block
from services.document_schema.semantics import is_footnote_like_block
from services.rendering.layout.payload.body_common import is_body_context_text_payload
from services.rendering.layout.payload.body_common import payload_density
from services.rendering.policy import typography_policy as typography


def unify_annotation_fonts(ordered_payloads: list[dict]) -> None:
    body_font_cap = _body_font_reference(ordered_payloads)
    for role in ("caption", "footnote"):
        payloads = [
            payload
            for payload in ordered_payloads
            if _annotation_role(payload.get("item") or {}) == role
            and payload["render_kind"] == "markdown"
            and float(payload.get("font_size_pt") or 0.0) > 0
        ]
        if len(payloads) < 2:
            continue
        target_font = _low_role_font_target(payloads)
        if role == "caption":
            target_font = _annotation_target_font(
                payloads,
                target_font,
                target_bonus_pt=typography.CAPTION_FONT_UNIFY_TARGET_BONUS_PT,
            )
            target_font = _cap_annotation_font(target_font, role=role, body_font_cap=body_font_cap)
        elif role == "footnote":
            target_font = _annotation_target_font(
                payloads,
                target_font,
                target_bonus_pt=typography.FOOTNOTE_FONT_UNIFY_TARGET_BONUS_PT,
            )
            target_font = _cap_annotation_font(target_font, role=role, body_font_cap=body_font_cap)
        for payload in payloads:
            current_font = float(payload["font_size_pt"])
            if abs(current_font - target_font) <= typography.ANNOTATION_FONT_UNIFY_APPLY_TOLERANCE_PT:
                continue
            if current_font > target_font:
                payload["font_size_pt"] = round(max(target_font, current_font - typography.ANNOTATION_FONT_UNIFY_MAX_SHRINK_PT), 2)
            elif role == "caption":
                payload["font_size_pt"] = round(min(target_font, current_font + typography.CAPTION_FONT_UNIFY_MAX_GROW_PT), 2)
            elif role == "footnote":
                payload["font_size_pt"] = round(min(target_font, current_font + typography.FOOTNOTE_FONT_UNIFY_MAX_GROW_PT), 2)


def recover_underfilled_annotation_density(ordered_payloads: list[dict]) -> None:
    body_font_cap = _body_font_reference(ordered_payloads)
    for payload in ordered_payloads:
        role = _annotation_role(payload.get("item") or {})
        if role not in {"caption", "footnote"}:
            continue
        if payload["render_kind"] != "markdown":
            continue
        if float(payload.get("font_size_pt") or 0.0) <= 0 or float(payload.get("leading_em") or 0.0) <= 0:
            continue
        if payload_density(payload) >= typography.ANNOTATION_UNDERFILLED_DENSITY_FLOOR_TRIGGER:
            _clamp_annotation_payload_font(payload, role=role, body_font_cap=body_font_cap)
            continue
        _recover_annotation_payload_density(payload, role=role, body_font_cap=body_font_cap)
        _clamp_annotation_payload_font(payload, role=role, body_font_cap=body_font_cap)


def _annotation_role(item: dict) -> str:
    if is_footnote_like_block(item):
        return "footnote"
    if is_caption_like_block(item):
        return "caption"
    return ""


def _low_role_font_target(payloads: list[dict]) -> float:
    fonts = sorted(float(payload["font_size_pt"]) for payload in payloads if float(payload.get("font_size_pt") or 0.0) > 0)
    if not fonts:
        return 0.0
    fonts = _without_extreme_small_fonts(fonts)
    index = int((len(fonts) - 1) * typography.ANNOTATION_FONT_UNIFY_TARGET_QUANTILE)
    return round(fonts[index], 2)


def _annotation_target_font(payloads: list[dict], low_target: float, *, target_bonus_pt: float) -> float:
    fonts = sorted(float(payload["font_size_pt"]) for payload in payloads if float(payload.get("font_size_pt") or 0.0) > 0)
    if not fonts:
        return low_target
    fonts = _without_extreme_small_fonts(fonts)
    mid = fonts[len(fonts) // 2]
    return round(min(mid, low_target + target_bonus_pt), 2)


def _without_extreme_small_fonts(fonts: list[float]) -> list[float]:
    if len(fonts) < typography.ANNOTATION_FONT_UNIFY_MIN_FILTERED_COUNT + 1:
        return fonts
    median_font = median(fonts)
    floor = max(
        median_font * typography.ANNOTATION_FONT_UNIFY_EXTREME_SMALL_RATIO,
        median_font - typography.ANNOTATION_FONT_UNIFY_EXTREME_SMALL_DELTA_PT,
    )
    filtered = [font for font in fonts if font >= floor]
    if len(filtered) < typography.ANNOTATION_FONT_UNIFY_MIN_FILTERED_COUNT:
        return fonts
    return filtered


def _body_font_reference(payloads: list[dict]) -> float | None:
    fonts = sorted(
        float(payload.get("font_size_pt") or 0.0)
        for payload in payloads
        if is_body_context_text_payload(payload) and float(payload.get("font_size_pt") or 0.0) > 0
    )
    if not fonts:
        return None
    return fonts[(len(fonts) - 1) // 2]


def _cap_annotation_font(font_size_pt: float, *, role: str, body_font_cap: float | None) -> float:
    if body_font_cap is None or body_font_cap <= 0:
        return font_size_pt
    ratio = typography.CAPTION_BODY_FONT_CAP_RATIO if role == "caption" else typography.FOOTNOTE_BODY_FONT_CAP_RATIO
    return min(font_size_pt, body_font_cap * ratio)


def _clamp_annotation_payload_font(payload: dict, *, role: str, body_font_cap: float | None) -> None:
    current_font = float(payload.get("font_size_pt") or 0.0)
    capped = _cap_annotation_font(current_font, role=role, body_font_cap=body_font_cap)
    if capped < current_font:
        payload["font_size_pt"] = round(capped, 2)


def _recover_annotation_payload_density(payload: dict, *, role: str, body_font_cap: float | None) -> None:
    for _ in range(typography.ANNOTATION_UNDERFILLED_RECOVERY_MAX_ITERATIONS):
        if payload_density(payload) >= typography.ANNOTATION_UNDERFILLED_DENSITY_RECOVERY_TARGET:
            return
        changed = _recover_annotation_font_step(payload, role=role, body_font_cap=body_font_cap)
        if payload_density(payload) >= typography.ANNOTATION_UNDERFILLED_DENSITY_RECOVERY_TARGET:
            return
        changed = _recover_annotation_leading_step(payload, role=role) or changed
        if not changed:
            return


def _recover_annotation_font_step(payload: dict, *, role: str, body_font_cap: float | None) -> bool:
    current_font = float(payload.get("font_size_pt") or 0.0)
    if current_font <= 0:
        return False
    step = (
        typography.CAPTION_UNDERFILLED_RECOVERY_FONT_STEP_PT
        if role == "caption"
        else typography.FOOTNOTE_UNDERFILLED_RECOVERY_FONT_STEP_PT
    )
    target_font = min(
        _cap_annotation_font(_font_for_annotation_recovery_density(payload), role=role, body_font_cap=body_font_cap),
        current_font + step,
    )
    best = _largest_annotation_font_within_density(
        payload,
        current_font,
        target_font,
        density_limit=typography.ANNOTATION_UNDERFILLED_DENSITY_SAFE_MAX,
    )
    if best <= current_font + 0.02:
        return False
    payload["font_size_pt"] = round(best, 2)
    return True


def _recover_annotation_leading_step(payload: dict, *, role: str) -> bool:
    current_leading = float(payload.get("leading_em") or 0.0)
    if current_leading <= 0:
        return False
    if role == "caption":
        cap = typography.CAPTION_UNDERFILLED_RECOVERY_LEADING_CAP_EM
        step = typography.CAPTION_UNDERFILLED_RECOVERY_LEADING_STEP_EM
    else:
        cap = typography.FOOTNOTE_UNDERFILLED_RECOVERY_LEADING_CAP_EM
        step = typography.FOOTNOTE_UNDERFILLED_RECOVERY_LEADING_STEP_EM
    target_leading = min(cap, current_leading + step)
    best = _largest_annotation_leading_within_density(
        payload,
        current_leading,
        target_leading,
        density_limit=typography.ANNOTATION_UNDERFILLED_DENSITY_SAFE_MAX,
    )
    if best <= current_leading + 0.01:
        return False
    payload["leading_em"] = round(best, 2)
    return True


def _font_for_annotation_recovery_density(payload: dict) -> float:
    current_font = float(payload.get("font_size_pt") or 0.0)
    density = payload_density(payload)
    if current_font <= 0 or density <= 0:
        return current_font
    scale = (typography.ANNOTATION_UNDERFILLED_DENSITY_RECOVERY_TARGET / max(0.01, density)) ** 0.5
    return current_font * scale


def _largest_annotation_font_within_density(payload: dict, low: float, high: float, *, density_limit: float) -> float:
    best = low
    for _ in range(8):
        mid = (low + high) / 2.0
        if payload_density(payload, font_size_pt=mid) <= density_limit:
            best = mid
            low = mid
        else:
            high = mid
    return best


def _largest_annotation_leading_within_density(payload: dict, low: float, high: float, *, density_limit: float) -> float:
    best = low
    for _ in range(8):
        mid = (low + high) / 2.0
        if payload_density(payload, leading_em=mid) <= density_limit:
            best = mid
            low = mid
        else:
            high = mid
    return best
