from __future__ import annotations

from foundation.config import fonts
from foundation.config import layout
from services.rendering.layout.typography.measurement import clamp
from services.rendering.layout.typography.measurement import formula_ratio
from services.rendering.layout.typography.measurement import local_line_pitch
from services.rendering.layout.typography.measurement import median_line_pitch
from services.rendering.layout.typography.measurement import occupied_ratio_x
from services.rendering.layout.typography.measurement import source_compactness_score


DEFAULT_LEADING_EM = 0.40
BODY_LEADING_MIN = 0.54
BODY_LEADING_MAX = 0.78
NON_BODY_LEADING_MIN = 0.26
NON_BODY_LEADING_MAX = 0.72
BODY_LEADING_SIZE_ADJUST = 0.62
NON_BODY_LEADING_SIZE_ADJUST = 0.78
LEADING_TIGHTEN_PT_LIMIT = 1.6
BODY_LEADING_FLOOR_MIN = 0.46
NON_BODY_LEADING_FLOOR_MIN = 0.22
BODY_LEADING_TIGHTEN_PER_PT = 0.12
NON_BODY_LEADING_TIGHTEN_PER_PT = 0.07
BODY_LEADING_TIGHTEN_RATIO_PER_PT = 0.12
NON_BODY_LEADING_TIGHTEN_RATIO_PER_PT = 0.04
HIGH_DENSITY_LEADING_RATIO = 0.9
FORMULA_LEADING_RATIO = 0.92
BODY_ZH_TARGET_BASE = 0.66
BODY_ZH_TARGET_MIN = 0.61
BODY_COMPACT_LEADING_TIGHTEN_MAX = 0.06
WIDE_ASPECT_OCR_LEADING_WEIGHT = 0.5
WIDE_ASPECT_ZH_LEADING_WEIGHT = 0.5
WIDE_ASPECT_COMPACT_LEADING_TIGHTEN_MAX = 0.025


def normalize_leading_em_for_font_size(
    font_size_pt: float,
    leading_em: float,
    *,
    reference_font_size_pt: float,
    min_leading_em: float,
    max_leading_em: float,
    strength: float,
    floor_min_leading_em: float | None = None,
) -> float:
    if font_size_pt <= 0:
        return round(clamp(leading_em, min_leading_em, max_leading_em), 2)
    reference = reference_font_size_pt if reference_font_size_pt > 0 else fonts.DEFAULT_FONT_SIZE
    floor_min = floor_min_leading_em if floor_min_leading_em is not None else min_leading_em
    if font_size_pt <= reference:
        return round(clamp(leading_em, min_leading_em, max_leading_em), 2)

    size_delta_pt = clamp(font_size_pt - reference, 0.0, LEADING_TIGHTEN_PT_LIMIT)
    tighten_per_pt = BODY_LEADING_TIGHTEN_PER_PT if min_leading_em >= BODY_LEADING_MIN else NON_BODY_LEADING_TIGHTEN_PER_PT
    tighten_ratio_per_pt = (
        BODY_LEADING_TIGHTEN_RATIO_PER_PT if min_leading_em >= BODY_LEADING_MIN else NON_BODY_LEADING_TIGHTEN_RATIO_PER_PT
    )
    dynamic_min = max(floor_min, min_leading_em - size_delta_pt * tighten_per_pt * strength)
    dynamic_max = max(dynamic_min + 0.08, max_leading_em - size_delta_pt * (tighten_per_pt + 0.03) * strength)
    adjusted = leading_em * (1.0 - size_delta_pt * tighten_ratio_per_pt * strength)
    return round(clamp(adjusted, dynamic_min, dynamic_max), 2)


def estimate_leading_em(item: dict, page_line_pitch: float, font_size_pt: float) -> float:
    block_pitch = local_line_pitch(item) or median_line_pitch(item)
    density_ratio_x = occupied_ratio_x(item)
    formula_weight = formula_ratio(item)
    compactness = source_compactness_score(item)
    wide_aspect_body_text = bool(item.get("_wide_aspect_body_text", False))
    if item.get("_is_body_text_candidate", False):
        pitch = block_pitch or page_line_pitch
        zh_target = max(BODY_ZH_TARGET_MIN, BODY_ZH_TARGET_BASE - compactness * 0.07)
        if pitch > 0 and font_size_pt > 0:
            ocr_estimated = (pitch / font_size_pt) - 1.0
            if wide_aspect_body_text:
                mixed = (ocr_estimated * WIDE_ASPECT_OCR_LEADING_WEIGHT) + (zh_target * WIDE_ASPECT_ZH_LEADING_WEIGHT)
            else:
                mixed = (ocr_estimated * 0.35) + (zh_target * 0.65)
            base = mixed * layout.BODY_LEADING_FACTOR
        else:
            base = zh_target * layout.BODY_LEADING_FACTOR
        if compactness > 0:
            tighten_max = WIDE_ASPECT_COMPACT_LEADING_TIGHTEN_MAX if wide_aspect_body_text else BODY_COMPACT_LEADING_TIGHTEN_MAX
            base *= 1.0 - min(tighten_max, compactness * 0.07)
        if density_ratio_x >= 0.86:
            base = max(base, BODY_LEADING_MIN / HIGH_DENSITY_LEADING_RATIO)
        if formula_weight >= 0.08:
            base = max(base, BODY_LEADING_MIN / FORMULA_LEADING_RATIO)
        return normalize_leading_em_for_font_size(
            font_size_pt,
            base,
            reference_font_size_pt=fonts.DEFAULT_FONT_SIZE,
            min_leading_em=BODY_LEADING_MIN,
            max_leading_em=BODY_LEADING_MAX,
            strength=BODY_LEADING_SIZE_ADJUST * (0.55 if density_ratio_x >= 0.86 or formula_weight >= 0.08 else 1.0),
            floor_min_leading_em=BODY_LEADING_FLOOR_MIN,
        )
    if block_pitch > 0 and font_size_pt > 0:
        ocr_estimated = (block_pitch / font_size_pt) - 1.0
        mixed = (ocr_estimated * 0.55) + (DEFAULT_LEADING_EM * 0.45)
        base = mixed * layout.BODY_LEADING_FACTOR
    else:
        base = DEFAULT_LEADING_EM * layout.BODY_LEADING_FACTOR
    if density_ratio_x >= 0.9:
        base = max(base, NON_BODY_LEADING_MIN / HIGH_DENSITY_LEADING_RATIO)
    if formula_weight >= 0.12:
        base = max(base, NON_BODY_LEADING_MIN / FORMULA_LEADING_RATIO)
    return normalize_leading_em_for_font_size(
        font_size_pt,
        base,
        reference_font_size_pt=fonts.DEFAULT_FONT_SIZE,
        min_leading_em=NON_BODY_LEADING_MIN,
        max_leading_em=NON_BODY_LEADING_MAX,
        strength=NON_BODY_LEADING_SIZE_ADJUST * (0.6 if density_ratio_x >= 0.9 or formula_weight >= 0.12 else 1.0),
        floor_min_leading_em=NON_BODY_LEADING_FLOOR_MIN,
    )


__all__ = [
    "BODY_LEADING_FLOOR_MIN",
    "BODY_LEADING_MAX",
    "BODY_LEADING_MIN",
    "BODY_LEADING_SIZE_ADJUST",
    "DEFAULT_LEADING_EM",
    "FORMULA_LEADING_RATIO",
    "HIGH_DENSITY_LEADING_RATIO",
    "NON_BODY_LEADING_FLOOR_MIN",
    "NON_BODY_LEADING_MAX",
    "NON_BODY_LEADING_MIN",
    "NON_BODY_LEADING_SIZE_ADJUST",
    "estimate_leading_em",
    "normalize_leading_em_for_font_size",
]
