from __future__ import annotations

from services.rendering.layout.typography.baseline import candidate_text_items
from services.rendering.layout.typography.baseline import page_baseline_font_size
from services.rendering.layout.typography.compactness import line_widths
from services.rendering.layout.typography.compactness import occupied_ratio
from services.rendering.layout.typography.compactness import occupied_ratio_x
from services.rendering.layout.typography.compactness import source_compactness_score
from services.rendering.layout.typography.constants import APPROX_TEXT_CHAR_WIDTH_PT
from services.rendering.layout.typography.constants import BODY_FORMULA_RATIO_MAX
from services.rendering.layout.typography.constants import FORMULA_CHARS_PER_LINE_PENALTY
from services.rendering.layout.typography.constants import LINE_COUNT_GROW_THRESHOLD
from services.rendering.layout.typography.constants import LINE_COUNT_PREDICT_TRIGGER_CHARS
from services.rendering.layout.typography.constants import LINE_HEIGHT_TO_FONT_SCALE
from services.rendering.layout.typography.constants import LINE_PITCH_TO_FONT_SCALE
from services.rendering.layout.typography.constants import LOOSE_LINE_PITCH_RATIO
from services.rendering.layout.typography.constants import MAX_FONT_SIZE_PT
from services.rendering.layout.typography.constants import MAX_LOCAL_FONT_SIZE_PT
from services.rendering.layout.typography.constants import MIN_FONT_SIZE_PT
from services.rendering.layout.typography.constants import MIN_TEXT_LINE_PITCH_PT
from services.rendering.layout.typography.constants import PAGE_BASELINE_PERCENTILE
from services.rendering.layout.typography.constants import SINGLE_LINE_GLUE_HEIGHT_TRIGGER_LINES
from services.rendering.layout.typography.constants import SINGLE_LINE_GLUE_WIDTH_CHAR_RATIO
from services.rendering.layout.typography.constants import SOURCE_COMPACTNESS_LINE_TRIGGER
from services.rendering.layout.typography.constants import SOURCE_COMPACTNESS_MAX
from services.rendering.layout.typography.constants import SOURCE_COMPACTNESS_TEXT_TRIGGER
from services.rendering.layout.typography.constants import SOURCE_COMPACTNESS_X_TRIGGER
from services.rendering.layout.typography.constants import SOURCE_COMPACTNESS_Y_TRIGGER
from services.rendering.layout.typography.constants import SOURCE_HEIGHT_LIMIT_MIN_PT
from services.rendering.layout.typography.constants import SOURCE_HEIGHT_LIMIT_RATIO
from services.rendering.layout.typography.constants import TEXT_HEIGHT_PADDING_MAX_PT
from services.rendering.layout.typography.constants import TEXT_HEIGHT_PADDING_RATIO
from services.rendering.layout.typography.constants import VISUAL_LINE_COUNT_MAX
from services.rendering.layout.typography.constants import ZH_FONT_SCALE
from services.rendering.layout.typography.content import formula_ratio
from services.rendering.layout.typography.content import plain_text_chars_per_line
from services.rendering.layout.typography.line_count import is_tall_single_line_glue
from services.rendering.layout.typography.line_count import source_visual_line_count
from services.rendering.layout.typography.line_count import visual_line_count
from services.rendering.layout.typography.line_metrics import bbox_height
from services.rendering.layout.typography.line_metrics import bbox_width
from services.rendering.layout.typography.line_metrics import effective_text_height
from services.rendering.layout.typography.line_metrics import line_centers
from services.rendering.layout.typography.line_metrics import line_height
from services.rendering.layout.typography.line_metrics import local_font_metric
from services.rendering.layout.typography.line_metrics import local_glyph_height
from services.rendering.layout.typography.line_metrics import local_line_pitch
from services.rendering.layout.typography.line_metrics import median_line_height
from services.rendering.layout.typography.line_metrics import median_line_pitch
from services.rendering.layout.typography.line_metrics import source_text_height_limit_pt
from services.rendering.layout.typography.scalars import clamp
from services.rendering.layout.typography.scalars import percentile_value


__all__ = [
    "APPROX_TEXT_CHAR_WIDTH_PT",
    "BODY_FORMULA_RATIO_MAX",
    "FORMULA_CHARS_PER_LINE_PENALTY",
    "LINE_COUNT_GROW_THRESHOLD",
    "LINE_COUNT_PREDICT_TRIGGER_CHARS",
    "LINE_HEIGHT_TO_FONT_SCALE",
    "LINE_PITCH_TO_FONT_SCALE",
    "LOOSE_LINE_PITCH_RATIO",
    "MAX_FONT_SIZE_PT",
    "MAX_LOCAL_FONT_SIZE_PT",
    "MIN_FONT_SIZE_PT",
    "MIN_TEXT_LINE_PITCH_PT",
    "PAGE_BASELINE_PERCENTILE",
    "SINGLE_LINE_GLUE_HEIGHT_TRIGGER_LINES",
    "SINGLE_LINE_GLUE_WIDTH_CHAR_RATIO",
    "SOURCE_COMPACTNESS_LINE_TRIGGER",
    "SOURCE_COMPACTNESS_MAX",
    "SOURCE_COMPACTNESS_TEXT_TRIGGER",
    "SOURCE_COMPACTNESS_X_TRIGGER",
    "SOURCE_COMPACTNESS_Y_TRIGGER",
    "SOURCE_HEIGHT_LIMIT_MIN_PT",
    "SOURCE_HEIGHT_LIMIT_RATIO",
    "TEXT_HEIGHT_PADDING_MAX_PT",
    "TEXT_HEIGHT_PADDING_RATIO",
    "VISUAL_LINE_COUNT_MAX",
    "ZH_FONT_SCALE",
    "bbox_height",
    "bbox_width",
    "candidate_text_items",
    "clamp",
    "effective_text_height",
    "formula_ratio",
    "is_tall_single_line_glue",
    "line_centers",
    "line_height",
    "line_widths",
    "local_font_metric",
    "local_glyph_height",
    "local_line_pitch",
    "median_line_height",
    "median_line_pitch",
    "occupied_ratio",
    "occupied_ratio_x",
    "page_baseline_font_size",
    "percentile_value",
    "plain_text_chars_per_line",
    "source_compactness_score",
    "source_text_height_limit_pt",
    "source_visual_line_count",
    "visual_line_count",
]
