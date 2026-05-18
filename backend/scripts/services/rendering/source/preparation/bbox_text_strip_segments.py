from __future__ import annotations

import fitz

from services.rendering.source.preparation.bbox_text_strip_constants import FORMULA_SPLIT_SEGMENT_PAD_X_PT
from services.rendering.source.preparation.bbox_text_strip_constants import FORMULA_SPLIT_SEGMENT_PAD_Y_PT
from services.rendering.source.preparation.bbox_text_strip_constants import STRIP_SEGMENT_PAD_X_PT
from services.rendering.source.preparation.bbox_text_strip_constants import STRIP_SEGMENT_PAD_Y_PT
from services.rendering.source.preparation.bbox_text_strip_geometry import split_rect_away_from_formulas


def strip_segments_for_text_rect(text_rect: fitz.Rect, formula_rects: list[fitz.Rect]) -> list[fitz.Rect]:
    segments = split_rect_away_from_formulas(text_rect, formula_rects)
    was_split_for_formula = len(segments) != 1 or (segments and segments[0] != text_rect)
    padded_segments: list[fitz.Rect] = []
    for segment in segments:
        if segment.is_empty:
            continue
        if was_split_for_formula:
            padded_segments.append(
                segment
                + (
                    -FORMULA_SPLIT_SEGMENT_PAD_X_PT,
                    -FORMULA_SPLIT_SEGMENT_PAD_Y_PT,
                    FORMULA_SPLIT_SEGMENT_PAD_X_PT,
                    FORMULA_SPLIT_SEGMENT_PAD_Y_PT,
                )
            )
        else:
            padded_segments.append(
                segment
                + (
                    -STRIP_SEGMENT_PAD_X_PT,
                    -STRIP_SEGMENT_PAD_Y_PT,
                    STRIP_SEGMENT_PAD_X_PT,
                    STRIP_SEGMENT_PAD_Y_PT,
                )
            )
    return padded_segments
