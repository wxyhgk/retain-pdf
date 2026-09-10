import sys
import unittest
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.render.layout.font_fit import estimate_font_size_pt
from retainpdf_pipeline.render.layout.font_fit import estimate_leading_em
from retainpdf_pipeline.render.layout.font_fit import is_body_text_candidate
from retainpdf_pipeline.render.layout.font_fit import local_font_size_pt
from retainpdf_pipeline.render.layout.font_fit import normalize_leading_em_for_font_size
from retainpdf_pipeline.render.layout.font_fit import BODY_LEADING_MAX
from retainpdf_pipeline.render.layout.font_fit import BODY_LEADING_MIN
from retainpdf_pipeline.render.layout.payload.block_seed_body_policy import is_dense_small_box
from retainpdf_pipeline.render.layout.payload.block_seed_body_policy import is_heavy_dense_small_box
from retainpdf_pipeline.render.layout.payload.blocks import build_render_blocks
from retainpdf_pipeline.render.layout.payload.block_seed import _relax_wide_aspect_body_leading
from retainpdf_pipeline.render.layout.payload.fit import fit_translated_block_metrics
from retainpdf_pipeline.render.layout.typography.measurement import source_visual_line_count
from retainpdf_pipeline.render.layout.typography.measurement import visual_line_count


def _sample_item(*, wide_aspect: bool) -> dict:
    return {
        "block_type": "text",
        "source_text": (
            "This document offers initial ideas for an industrial policy agenda to keep people first "
            "during the transition to superintelligence."
        ),
        "bbox": [40, 100, 512, 205],
        "lines": [
            {"bbox": [40, 100, 505, 113], "spans": [{"type": "text", "content": "This document offers initial ideas"}]},
            {"bbox": [40, 115, 503, 128], "spans": [{"type": "text", "content": "for an industrial policy agenda"}]},
            {"bbox": [40, 130, 506, 143], "spans": [{"type": "text", "content": "to keep people first during"}]},
            {"bbox": [40, 145, 504, 158], "spans": [{"type": "text", "content": "the transition to"}]},
            {"bbox": [40, 160, 500, 173], "spans": [{"type": "text", "content": "superintelligence."}]},
        ],
        "_is_body_text_candidate": True,
        "_wide_aspect_body_text": wide_aspect,
    }

class BodyFontEstimationTests(unittest.TestCase):
    def test_local_font_size_uses_glyph_height_not_loose_line_pitch(self):
        item = {
            "block_type": "text",
            "source_text": "Line one with normal glyphs. Line two has very loose leading.",
            "bbox": [40, 100, 420, 160],
            "lines": [
                {"bbox": [40, 100, 410, 112], "spans": [{"type": "text", "content": "Line one with normal glyphs."}]},
                {"bbox": [40, 140, 410, 152], "spans": [{"type": "text", "content": "Line two has very loose leading."}]},
            ],
        }

        self.assertLess(local_font_size_pt(item), 12.0)

    def test_local_font_size_can_grow_for_large_source_glyphs(self):
        item = {
            "block_type": "text",
            "source_text": "Large source text should not be capped at small body defaults.",
            "bbox": [40, 100, 420, 150],
            "lines": [
                {"bbox": [40, 100, 410, 116], "spans": [{"type": "text", "content": "Large source text should not"}]},
                {"bbox": [40, 124, 410, 140], "spans": [{"type": "text", "content": "be capped at small body defaults."}]},
            ],
        }

        self.assertGreater(local_font_size_pt(item), 12.0)

    def test_wide_aspect_body_keeps_font_closer_to_local_ocr(self):
        base_item = _sample_item(wide_aspect=False)
        wide_item = _sample_item(wide_aspect=True)
        page_font_size = 11.6
        page_line_pitch = 14.0
        page_line_height = 12.6
        density_baseline = 28.0

        base_font = estimate_font_size_pt(base_item, page_font_size, page_line_pitch, page_line_height, density_baseline)
        wide_font = estimate_font_size_pt(wide_item, page_font_size, page_line_pitch, page_line_height, density_baseline)

        self.assertGreater(wide_font, base_font)

    def test_body_font_estimate_does_not_apply_page_factor_twice(self):
        item = _sample_item(wide_aspect=False)
        page_font_size = 11.0
        page_line_pitch = 15.0
        page_line_height = 13.0
        density_baseline = 28.0

        font = estimate_font_size_pt(item, page_font_size, page_line_pitch, page_line_height, density_baseline)

        self.assertGreaterEqual(font, 10.5)

    def test_caption_font_is_visibly_smaller_than_body_font(self):
        body = _sample_item(wide_aspect=False)
        caption = {
            "block_kind": "text",
            "raw_block_type": "figure_title",
            "layout_role": "caption",
            "semantic_role": "metadata",
            "structure_role": "figure_caption",
            "normalized_sub_type": "figure_caption",
            "source_text": "FIG. 1. Cross sections of surfaces of revolution.",
            "bbox": [311.5, 529.5, 562.0, 587.0],
            "lines": [
                {
                    "bbox": [311.5, 529.5, 562.0, 541.5],
                    "spans": [{"type": "text", "content": "FIG. 1. Cross sections of surfaces"}],
                },
                {
                    "bbox": [311.5, 545.5, 562.0, 557.5],
                    "spans": [{"type": "text", "content": "of revolution."}],
                },
            ],
        }
        page_font_size = 10.8
        page_line_pitch = 14.0
        page_line_height = 12.0
        density_baseline = 28.0

        body_font = estimate_font_size_pt(body, page_font_size, page_line_pitch, page_line_height, density_baseline)
        caption_font = estimate_font_size_pt(caption, page_font_size, page_line_pitch, page_line_height, density_baseline)

        self.assertLessEqual(caption_font, 9.8)
        self.assertLess(caption_font, body_font - 0.5)

    def test_vision_footnote_font_is_annotation_sized(self):
        body = _sample_item(wide_aspect=False)
        footnote = {
            "block_type": "text",
            "block_kind": "text",
            "raw_block_type": "vision_footnote",
            "layout_role": "footnote",
            "semantic_role": "unknown",
            "structure_role": "footnote",
            "normalized_sub_type": "footnote",
            "tags": ["footnote"],
            "source_text": "a P < 0.05; b adjusted confidence interval.",
            "bbox": [58.0, 720.0, 520.0, 742.0],
            "lines": [
                {
                    "bbox": [58.0, 720.0, 520.0, 731.0],
                    "spans": [{"type": "text", "content": "a P < 0.05; b adjusted confidence interval."}],
                }
            ],
        }
        page_font_size = 10.8
        page_line_pitch = 14.0
        page_line_height = 12.0
        density_baseline = 28.0

        body_font = estimate_font_size_pt(body, page_font_size, page_line_pitch, page_line_height, density_baseline)
        footnote_font = estimate_font_size_pt(footnote, page_font_size, page_line_pitch, page_line_height, density_baseline)

        self.assertLessEqual(footnote_font, 8.8)
        self.assertLess(footnote_font, body_font - 1.0)
        self.assertFalse(is_body_text_candidate(footnote, page_text_width_med=300.0))

