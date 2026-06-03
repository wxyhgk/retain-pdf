from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RenderRiskThresholds:
    height_ratio_warn: float = 1.10
    height_ratio_high: float = 1.25
    height_ratio_hard: float = 1.50
    text_text_overlap_high: float = 0.02
    text_text_overlap_hard: float = 0.05
    text_formula_overlap_hard_area_pt: float = 0.5
    text_nontext_overlap_high_ratio: float = 0.002
    text_nontext_overlap_hard_ratio: float = 0.01
    min_body_font_pt: float = 8.5
    min_table_font_pt: float = 7.5
    min_reference_font_pt: float = 6.5
    garbled_chars_high: int = 3
    garbled_chars_hard_per_block: int = 2
    max_text_blocks_high: int = 45
    max_formula_blocks_high: int = 8
    max_image_or_table_blocks_high: int = 3
    occupied_area_warn: float = 0.70
    occupied_area_high: float = 0.82
    overlay_max_score: int = 4
    partial_reflow_max_score: int = 10
    full_rebuild_max_score: int = 18


DEFAULT_RENDER_RISK_THRESHOLDS = RenderRiskThresholds()
