from __future__ import annotations
import re

from foundation.config import fonts
from foundation.config import layout
from services.document_schema.semantics import is_body_structure_role
from services.document_schema.semantics import is_caption_like_block
from services.rendering.layout.typography.geometry import cover_bbox
from services.rendering.layout.typography.geometry import inner_bbox
from services.rendering.layout.typography.measurement import bbox_height
from services.rendering.layout.typography.measurement import bbox_width
from services.rendering.layout.typography.measurement import candidate_text_items
from services.rendering.layout.typography.measurement import clamp
from services.rendering.layout.typography.measurement import effective_text_height
from services.rendering.layout.typography.measurement import formula_ratio
from services.rendering.layout.typography.measurement import local_line_pitch
from services.rendering.layout.typography.measurement import median_line_height
from services.rendering.layout.typography.measurement import median_line_pitch
from services.rendering.layout.typography.measurement import occupied_ratio
from services.rendering.layout.typography.measurement import occupied_ratio_x
from services.rendering.layout.typography.measurement import page_baseline_font_size
from services.rendering.layout.typography.measurement import percentile_value
from services.rendering.layout.typography.measurement import source_compactness_score
from services.rendering.layout.typography.measurement import source_visual_line_count
from services.rendering.layout.typography.measurement import source_text_height_limit_pt
from services.rendering.layout.typography.measurement import visual_line_count


MIN_FONT_SIZE_PT = 8.4
MAX_FONT_SIZE_PT = 11.6
TITLE_FILL_MAX_FONT_SIZE_PT = 72.0
TITLE_FILL_HEIGHT_TO_FONT_RATIO = 0.92
TITLE_FILL_GROW_SCALE = 2.6
TITLE_FILL_MAX_FONT_SCALE = 3.0
ZH_FONT_SCALE = 0.91
PAGE_BASELINE_PERCENTILE = 0.42
BLOCK_SCALE_MIN = 0.985
BLOCK_SCALE_MAX = 1.015
DEFAULT_LEADING_EM = 0.40
BODY_LEADING_MIN = 0.54
BODY_LEADING_MAX = 0.78
BODY_FORMULA_RATIO_MAX = 0.5
LOCAL_BLOCK_SCALE_MIN = 0.97
LOCAL_BLOCK_SCALE_MAX = 1.03
NON_BODY_LEADING_MIN = 0.26
NON_BODY_LEADING_MAX = 0.72
BODY_LEADING_SIZE_ADJUST = 0.62
NON_BODY_LEADING_SIZE_ADJUST = 0.78
LEADING_SIZE_DELTA_LIMIT = 0.18
LEADING_TIGHTEN_PT_LIMIT = 1.6
BODY_LEADING_FLOOR_MIN = 0.46
NON_BODY_LEADING_FLOOR_MIN = 0.22
BODY_LEADING_TIGHTEN_PER_PT = 0.12
NON_BODY_LEADING_TIGHTEN_PER_PT = 0.07
BODY_LEADING_TIGHTEN_RATIO_PER_PT = 0.12
NON_BODY_LEADING_TIGHTEN_RATIO_PER_PT = 0.04
LOCAL_TEXTUAL_BLOCK_TYPES = {"text", "title", "image_caption", "table_caption", "table_footnote"}
CAPTION_FONT_SCALE = 0.92
CAPTION_MAX_FONT_SIZE_PT = 10.6
HIGH_DENSITY_LEADING_RATIO = 0.9
FORMULA_LEADING_RATIO = 0.92
BODY_PAGE_BLEND_BASE = 0.86
BODY_PAGE_BLEND_MIN = 0.74
BODY_COMPACT_FONT_SCALE_MAX = 0.04
BODY_ZH_TARGET_BASE = 0.66
BODY_ZH_TARGET_MIN = 0.61
BODY_COMPACT_LEADING_TIGHTEN_MAX = 0.06
WIDE_ASPECT_PAGE_BLEND_REDUCTION = 0.14
WIDE_ASPECT_COMPACT_FONT_SCALE_MAX = 0.018
WIDE_ASPECT_OCR_LEADING_WEIGHT = 0.5
WIDE_ASPECT_ZH_LEADING_WEIGHT = 0.5
WIDE_ASPECT_COMPACT_LEADING_TIGHTEN_MAX = 0.025

def _is_caption_like(item: dict) -> bool:
    return is_caption_like_block(item)


def _is_local_textual_item(item: dict) -> bool:
    if _is_caption_like(item):
        return True
    return item.get("block_type") in LOCAL_TEXTUAL_BLOCK_TYPES


def local_font_size_pt(item: dict) -> float:
    if not _is_local_textual_item(item):
        return fonts.DEFAULT_FONT_SIZE
    metric = local_line_pitch(item) or median_line_height(item)
    if metric <= 0:
        return fonts.DEFAULT_FONT_SIZE
    base_size = metric * ZH_FONT_SCALE * layout.BODY_FONT_SIZE_FACTOR
    if _is_caption_like(item):
        return round(clamp(base_size * CAPTION_FONT_SCALE, MIN_FONT_SIZE_PT, CAPTION_MAX_FONT_SIZE_PT), 2)
    return round(clamp(base_size, MIN_FONT_SIZE_PT, MAX_FONT_SIZE_PT), 2)


def is_body_text_candidate(item: dict, page_text_width_med: float) -> bool:
    if _is_caption_like(item):
        return False
    if item.get("block_type") != "text":
        return False
    if formula_ratio(item) > BODY_FORMULA_RATIO_MAX:
        return False
    text_len = len(re.sub(r"\s+", "", item.get("source_text", "")))
    width = bbox_width(item)
    if page_text_width_med > 0 and width < page_text_width_med * 0.75:
        # Multi-column body text can be much narrower than the page-wide median.
        # If OCR already marks it as body and it has enough real text / lines,
        # keep it in the body bucket so page-level normalization does not shrink
        # it into caption-like sizing.
        if not (
            is_body_structure_role(item.get("metadata", {}) or {})
            and text_len >= 36
            and source_visual_line_count(item) >= 2
        ):
            return False
    return text_len >= 40


def is_default_text_block(item: dict) -> bool:
    if item.get("block_type") == "title":
        return True
    if item.get("block_type") != "text":
        return False
    line_count = len(item.get("lines", []))
    text_len = len(re.sub(r"\s+", "", item.get("source_text", "")))
    return line_count <= 1 and text_len < 60


def is_title_like_block(item: dict) -> bool:
    if _is_caption_like(item):
        return False
    block_type = str(item.get("block_type", "") or "").strip().lower()
    if block_type == "title":
        return True
    metadata = item.get("metadata", {}) or {}
    normalized_sub_type = str(metadata.get("normalized_sub_type", "") or "").strip().lower()
    structure_role = str(metadata.get("structure_role", "") or "").strip().lower()
    tags = {str(tag or "").strip().lower() for tag in metadata.get("tags", []) if str(tag or "").strip()}
    return (
        normalized_sub_type in {"title", "heading"}
        or structure_role in {"title", "heading", "section_heading"}
        or bool(tags & {"title", "heading"})
    )


def resolve_font_weight(item: dict) -> str:
    return "bold" if is_title_like_block(item) else "regular"


def resolve_title_fill_max_font_size_pt(item: dict, base_font_size_pt: float) -> float:
    if not is_title_like_block(item):
        return round(base_font_size_pt, 2)
    scaled_cap = max(base_font_size_pt, base_font_size_pt * TITLE_FILL_MAX_FONT_SCALE)
    inner = inner_bbox(item)
    if len(inner) != 4:
        return round(
            min(
                TITLE_FILL_MAX_FONT_SIZE_PT,
                scaled_cap,
                base_font_size_pt,
            ),
            2,
        )
    height_pt = max(8.0, inner[3] - inner[1])
    height_cap = height_pt * TITLE_FILL_HEIGHT_TO_FONT_RATIO
    optimistic = min(
        TITLE_FILL_MAX_FONT_SIZE_PT,
        scaled_cap,
        max(base_font_size_pt, min(base_font_size_pt * TITLE_FILL_GROW_SCALE, height_cap)),
    )
    return round(max(base_font_size_pt, optimistic), 2)


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


def estimate_font_size_pt(
    item: dict,
    page_font_size: float,
    page_line_pitch: float,
    page_line_height: float,
    density_baseline: float,
) -> float:
    del density_baseline
    if not _is_local_textual_item(item):
        return fonts.DEFAULT_FONT_SIZE
    local_font = local_font_size_pt(item)
    if not item.get("_is_body_text_candidate", False):
        return local_font

    block_scale = 1.0
    block_line_pitch = local_line_pitch(item) or median_line_pitch(item)
    block_line_height = median_line_height(item)
    if page_line_pitch > 0 and block_line_pitch > 0:
        block_scale = clamp(block_line_pitch / page_line_pitch, LOCAL_BLOCK_SCALE_MIN, LOCAL_BLOCK_SCALE_MAX)
    elif page_line_height > 0 and block_line_height > 0:
        block_scale = clamp(block_line_height / page_line_height, LOCAL_BLOCK_SCALE_MIN, LOCAL_BLOCK_SCALE_MAX)

    compactness = source_compactness_score(item)
    wide_aspect_body_text = bool(item.get("_wide_aspect_body_text", False))
    page_estimate = page_font_size * block_scale * layout.BODY_FONT_SIZE_FACTOR if page_font_size > 0 else local_font
    page_weight = max(BODY_PAGE_BLEND_MIN, BODY_PAGE_BLEND_BASE - compactness * 0.18)
    if wide_aspect_body_text:
        page_weight = max(BODY_PAGE_BLEND_MIN - 0.1, page_weight - WIDE_ASPECT_PAGE_BLEND_REDUCTION)
    local_weight = 1.0 - page_weight
    blended = (page_estimate * page_weight) + (local_font * local_weight)
    if compactness > 0:
        compact_scale_max = WIDE_ASPECT_COMPACT_FONT_SCALE_MAX if wide_aspect_body_text else BODY_COMPACT_FONT_SCALE_MAX
        blended *= 1.0 - min(compact_scale_max, compactness * 0.055)
    if _is_caption_like(item):
        blended = min(blended * CAPTION_FONT_SCALE, CAPTION_MAX_FONT_SIZE_PT)
    return round(clamp(blended, MIN_FONT_SIZE_PT, MAX_FONT_SIZE_PT), 2)


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
