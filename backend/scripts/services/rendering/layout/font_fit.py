from __future__ import annotations

from services.rendering.layout.font_roles import is_body_text_candidate
from services.rendering.layout.font_roles import is_default_text_block
from services.rendering.layout.font_roles import is_title_like_block
from services.rendering.layout.font_roles import resolve_font_weight
from services.rendering.layout.font_size_fit import BODY_COMPACT_FONT_SCALE_MAX
from services.rendering.layout.font_size_fit import BODY_PAGE_BLEND_BASE
from services.rendering.layout.font_size_fit import BODY_PAGE_BLEND_MIN
from services.rendering.layout.font_size_fit import CAPTION_FONT_SCALE
from services.rendering.layout.font_size_fit import FOOTNOTE_FONT_SCALE
from services.rendering.layout.font_size_fit import FOOTNOTE_MIN_FONT_SIZE_PT
from services.rendering.layout.font_size_fit import LOCAL_BLOCK_SCALE_MAX
from services.rendering.layout.font_size_fit import LOCAL_BLOCK_SCALE_MIN
from services.rendering.layout.font_size_fit import MAX_FONT_SIZE_PT
from services.rendering.layout.font_size_fit import MAX_LOCAL_FONT_SIZE_PT
from services.rendering.layout.font_size_fit import MIN_FONT_SIZE_PT
from services.rendering.layout.font_size_fit import WIDE_ASPECT_COMPACT_FONT_SCALE_MAX
from services.rendering.layout.font_size_fit import WIDE_ASPECT_PAGE_BLEND_REDUCTION
from services.rendering.layout.font_size_fit import estimate_font_size_pt
from services.rendering.layout.font_size_fit import local_font_size_pt
from services.rendering.layout.leading_fit import BODY_LEADING_FLOOR_MIN
from services.rendering.layout.leading_fit import BODY_LEADING_MAX
from services.rendering.layout.leading_fit import BODY_LEADING_MIN
from services.rendering.layout.leading_fit import BODY_LEADING_SIZE_ADJUST
from services.rendering.layout.leading_fit import NON_BODY_LEADING_FLOOR_MIN
from services.rendering.layout.leading_fit import NON_BODY_LEADING_MAX
from services.rendering.layout.leading_fit import NON_BODY_LEADING_MIN
from services.rendering.layout.leading_fit import NON_BODY_LEADING_SIZE_ADJUST
from services.rendering.layout.leading_fit import estimate_leading_em
from services.rendering.layout.leading_fit import normalize_leading_em_for_font_size
from services.rendering.layout.title_fit_limits import resolve_title_fill_max_font_size_pt
from services.rendering.layout.typography.geometry import cover_bbox
from services.rendering.layout.typography.measurement import candidate_text_items
from services.rendering.layout.typography.measurement import local_line_pitch
from services.rendering.layout.typography.measurement import median_line_height
from services.rendering.layout.typography.measurement import median_line_pitch
from services.rendering.layout.typography.measurement import page_baseline_font_size
from services.rendering.layout.typography.measurement import percentile_value
from services.rendering.layout.typography.measurement import source_compactness_score
from services.rendering.layout.typography.measurement import source_text_height_limit_pt
from services.rendering.layout.typography.measurement import visual_line_count


ZH_FONT_SCALE = 0.91
PAGE_BASELINE_PERCENTILE = 0.42
BLOCK_SCALE_MIN = 0.985
BLOCK_SCALE_MAX = 1.015
LEADING_SIZE_DELTA_LIMIT = 0.18
