from __future__ import annotations

from services.rendering.layout.font_fit import BODY_LEADING_FLOOR_MIN
from services.rendering.layout.font_fit import BODY_LEADING_MAX
from services.rendering.layout.font_fit import BODY_LEADING_MIN
from services.rendering.layout.font_fit import BODY_LEADING_SIZE_ADJUST
from services.rendering.layout.font_fit import normalize_leading_em_for_font_size
from services.rendering.layout.payload.capacity import estimated_render_height_pt
from services.rendering.layout.payload.shared import source_word_count
from services.rendering.layout.payload.shared import translated_zh_char_count


BODY_DENSITY_TARGET_MAX = 0.92
ADJACENT_BODY_SMOOTH_MAX_GAP_PT = 42.0
ADJACENT_BODY_SMOOTH_MIN_WIDTH_RATIO = 0.72
ADJACENT_BODY_SMOOTH_MIN_WIDTH_OVERLAP_RATIO = 0.64
ADJACENT_BODY_SMOOTH_MAX_LEFT_DELTA_PT = 18.0
ADJACENT_BODY_SMOOTH_MAX_CENTER_DELTA_PT = 22.0
ADJACENT_BODY_SMOOTH_MIN_BOX_HEIGHT_PT = 36.0
ADJACENT_BODY_SMOOTH_MIN_WIDTH_PT = 64.0
ADJACENT_BODY_SMOOTH_MIN_PAGE_WIDTH_RATIO = 0.38
ADJACENT_BODY_SMOOTH_MIN_SOURCE_WORDS = 10
ADJACENT_BODY_SMOOTH_MIN_TRANSLATED_ZH_CHARS = 18
ADJACENT_BODY_SMOOTH_MAX_FONT_DELTA_PT = 0.24
ADJACENT_BODY_SMOOTH_RELAXED_FONT_DELTA_PT = 0.34
ADJACENT_BODY_SMOOTH_MAX_LEADING_DELTA_EM = 0.06
ADJACENT_BODY_SMOOTH_RELAXED_LEADING_DELTA_EM = 0.09
ADJACENT_BODY_SMOOTH_GROW_DENSITY_MAX = 0.95
ADJACENT_BODY_SMOOTH_RELAXED_GROW_DENSITY_MAX = 0.99


def page_box_area_ratio(bbox: list[float], page_width: float | None, page_height: float | None) -> float:
    if len(bbox) != 4 or not page_width or not page_height or page_width <= 0 or page_height <= 0:
        return 0.0
    width = max(0.0, bbox[2] - bbox[0])
    height = max(0.0, bbox[3] - bbox[1])
    if width <= 0 or height <= 0:
        return 0.0
    return (width * height) / (page_width * page_height)


def payload_inner_width(payload: dict) -> float:
    return max(8.0, payload["inner_bbox"][2] - payload["inner_bbox"][0])


def payload_inner_height(payload: dict) -> float:
    return max(8.0, payload["inner_bbox"][3] - payload["inner_bbox"][1])


def payload_inner_top(payload: dict) -> float:
    return payload["inner_bbox"][1]


def payload_inner_bottom(payload: dict) -> float:
    return payload["inner_bbox"][3]


def payload_center_x(payload: dict) -> float:
    return (payload["inner_bbox"][0] + payload["inner_bbox"][2]) / 2.0


def payload_estimated_density(
    payload: dict,
    *,
    font_size_pt: float | None = None,
    leading_em: float | None = None,
) -> float:
    inner_height = payload_inner_height(payload)
    estimated_height = estimated_render_height_pt(
        payload["inner_bbox"],
        payload["translated_text"],
        payload["formula_map"],
        font_size_pt if font_size_pt is not None else payload["font_size_pt"],
        leading_em if leading_em is not None else payload["leading_em"],
    )
    return estimated_height / inner_height


def _payload_has_enough_text_for_smoothing(payload: dict) -> bool:
    item = payload["item"]
    source_words = source_word_count(item)
    translated_zh_chars = translated_zh_char_count(payload["translated_text"])
    return source_words >= ADJACENT_BODY_SMOOTH_MIN_SOURCE_WORDS or translated_zh_chars >= ADJACENT_BODY_SMOOTH_MIN_TRANSLATED_ZH_CHARS


def _is_adjacent_body_smoothing_candidate(payload: dict, *, page_text_width_med: float) -> bool:
    if not payload["is_body"] or payload["render_kind"] != "markdown":
        return False
    if payload["heavy_dense_small_box"]:
        return False
    if payload_inner_height(payload) < ADJACENT_BODY_SMOOTH_MIN_BOX_HEIGHT_PT:
        return False
    width = payload_inner_width(payload)
    min_width = ADJACENT_BODY_SMOOTH_MIN_WIDTH_PT
    if page_text_width_med > 0:
        min_width = max(min_width, page_text_width_med * ADJACENT_BODY_SMOOTH_MIN_PAGE_WIDTH_RATIO)
    if width < min_width:
        return False
    if not _payload_has_enough_text_for_smoothing(payload):
        return False
    return True


def is_same_column_adjacent_body_pair(current: dict, nxt: dict, *, page_text_width_med: float) -> bool:
    if not _is_adjacent_body_smoothing_candidate(current, page_text_width_med=page_text_width_med):
        return False
    if not _is_adjacent_body_smoothing_candidate(nxt, page_text_width_med=page_text_width_med):
        return False
    if payload_inner_top(nxt) < payload_inner_top(current):
        return False

    current_width = payload_inner_width(current)
    next_width = payload_inner_width(nxt)
    width_ratio = min(current_width, next_width) / max(current_width, next_width)
    if width_ratio < ADJACENT_BODY_SMOOTH_MIN_WIDTH_RATIO:
        return False

    overlap_width = max(0.0, min(current["inner_bbox"][2], nxt["inner_bbox"][2]) - max(current["inner_bbox"][0], nxt["inner_bbox"][0]))
    if overlap_width / min(current_width, next_width) < ADJACENT_BODY_SMOOTH_MIN_WIDTH_OVERLAP_RATIO:
        return False

    gap = payload_inner_top(nxt) - payload_inner_bottom(current)
    max_gap = max(ADJACENT_BODY_SMOOTH_MAX_GAP_PT, min(payload_inner_height(current), payload_inner_height(nxt)) * 0.45)
    if gap < -4.0 or gap > max_gap:
        return False

    left_delta = abs(current["inner_bbox"][0] - nxt["inner_bbox"][0])
    center_delta = abs(payload_center_x(current) - payload_center_x(nxt))
    left_limit = max(ADJACENT_BODY_SMOOTH_MAX_LEFT_DELTA_PT, max(current_width, next_width) * 0.06)
    center_limit = max(ADJACENT_BODY_SMOOTH_MAX_CENTER_DELTA_PT, max(current_width, next_width) * 0.08)
    if left_delta > left_limit and center_delta > center_limit:
        return False
    return True


def cap_font_growth_by_density(payload: dict, target_font_size_pt: float, *, density_limit: float) -> float:
    current_font_size = payload["font_size_pt"]
    if target_font_size_pt <= current_font_size:
        return round(target_font_size_pt, 2)

    low = current_font_size
    high = target_font_size_pt
    best = current_font_size
    for _ in range(8):
        mid = (low + high) / 2.0
        if payload_estimated_density(payload, font_size_pt=mid) <= density_limit:
            best = mid
            low = mid
        else:
            high = mid
    return round(best, 2)


def cap_leading_growth_by_density(payload: dict, target_leading_em: float, *, density_limit: float) -> float:
    current_leading = payload["leading_em"]
    if target_leading_em <= current_leading:
        return round(target_leading_em, 2)

    low = current_leading
    high = target_leading_em
    best = current_leading
    for _ in range(8):
        mid = (low + high) / 2.0
        if payload_estimated_density(payload, leading_em=mid) <= density_limit:
            best = mid
            low = mid
        else:
            high = mid
    return round(best, 2)


def normalize_body_payload_leading(payload: dict) -> None:
    reference_font_size_pt = payload.get("page_body_font_size_pt") or payload["font_size_pt"]
    payload["leading_em"] = normalize_leading_em_for_font_size(
        payload["font_size_pt"],
        payload["leading_em"],
        reference_font_size_pt=reference_font_size_pt,
        min_leading_em=BODY_LEADING_MIN,
        max_leading_em=BODY_LEADING_MAX,
        strength=BODY_LEADING_SIZE_ADJUST,
        floor_min_leading_em=BODY_LEADING_FLOOR_MIN,
    )


def smooth_adjacent_body_pair(current: dict, nxt: dict) -> None:
    current_density = payload_estimated_density(current)
    next_density = payload_estimated_density(nxt)
    relaxed = (
        max(current_density, next_density) > 0.92
        or current["dense_small_box"]
        or nxt["dense_small_box"]
        or current["prefer_typst_fit"]
        or nxt["prefer_typst_fit"]
    )
    max_font_delta = ADJACENT_BODY_SMOOTH_RELAXED_FONT_DELTA_PT if relaxed else ADJACENT_BODY_SMOOTH_MAX_FONT_DELTA_PT
    max_leading_delta = ADJACENT_BODY_SMOOTH_RELAXED_LEADING_DELTA_EM if relaxed else ADJACENT_BODY_SMOOTH_MAX_LEADING_DELTA_EM
    density_limit = ADJACENT_BODY_SMOOTH_RELAXED_GROW_DENSITY_MAX if relaxed else ADJACENT_BODY_SMOOTH_GROW_DENSITY_MAX

    if current["font_size_pt"] <= nxt["font_size_pt"]:
        smaller_font_payload = current
        larger_font_payload = nxt
    else:
        smaller_font_payload = nxt
        larger_font_payload = current

    font_delta = larger_font_payload["font_size_pt"] - smaller_font_payload["font_size_pt"]
    if font_delta > max_font_delta:
        excess = font_delta - max_font_delta
        grow_allowed = (
            not smaller_font_payload["prefer_typst_fit"]
            and not smaller_font_payload["heavy_dense_small_box"]
            and payload_estimated_density(smaller_font_payload) <= density_limit
        )
        grown = 0.0
        if grow_allowed:
            desired_font_size = smaller_font_payload["font_size_pt"] + excess * 0.6
            bounded_font_size = cap_font_growth_by_density(
                smaller_font_payload,
                desired_font_size,
                density_limit=density_limit,
            )
            grown = max(0.0, bounded_font_size - smaller_font_payload["font_size_pt"])
            smaller_font_payload["font_size_pt"] = bounded_font_size
        larger_font_payload["font_size_pt"] = round(max(6.4, larger_font_payload["font_size_pt"] - max(0.0, excess - grown)), 2)

    if current["leading_em"] <= nxt["leading_em"]:
        smaller_leading_payload = current
        larger_leading_payload = nxt
    else:
        smaller_leading_payload = nxt
        larger_leading_payload = current

    leading_delta = larger_leading_payload["leading_em"] - smaller_leading_payload["leading_em"]
    if leading_delta > max_leading_delta:
        excess = leading_delta - max_leading_delta
        grow_allowed = (
            not smaller_leading_payload["prefer_typst_fit"]
            and payload_estimated_density(smaller_leading_payload) <= max(BODY_DENSITY_TARGET_MAX, density_limit - 0.02)
        )
        grown = 0.0
        if grow_allowed:
            desired_leading = smaller_leading_payload["leading_em"] + excess * 0.35
            bounded_leading = cap_leading_growth_by_density(
                smaller_leading_payload,
                desired_leading,
                density_limit=max(BODY_DENSITY_TARGET_MAX, density_limit - 0.02),
            )
            grown = max(0.0, bounded_leading - smaller_leading_payload["leading_em"])
            smaller_leading_payload["leading_em"] = bounded_leading
        larger_leading_payload["leading_em"] = round(max(0.18, larger_leading_payload["leading_em"] - max(0.0, excess - grown)), 2)

    normalize_body_payload_leading(current)
    normalize_body_payload_leading(nxt)
