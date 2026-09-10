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

class DenseBodyFitPolicyTests(unittest.TestCase):
    def test_dense_small_box_requires_geometry_density(self):
        self.assertFalse(
            is_dense_small_box(
                density_ratio=1.4,
                layout_density=0.55,
                page_box_area_ratio=0.03,
            )
        )
        self.assertFalse(
            is_heavy_dense_small_box(
                density_ratio=1.4,
                layout_density=0.55,
                page_box_area_ratio=0.03,
                heavy_compact_ratio=1.0,
            )
        )

    def test_dense_small_box_uses_geometry_as_primary_signal(self):
        self.assertTrue(
            is_dense_small_box(
                density_ratio=0.5,
                layout_density=0.9,
                page_box_area_ratio=0.03,
            )
        )
        self.assertTrue(
            is_heavy_dense_small_box(
                density_ratio=0.5,
                layout_density=1.02,
                page_box_area_ratio=0.03,
                heavy_compact_ratio=1.0,
            )
        )

    def test_short_body_context_height_can_relax_fit_budget(self):
        items = [
            {
                "item_id": "body-anchor-1",
                "block_type": "text",
                "source_text": "A normal paragraph establishes column body geometry.",
                "bbox": [44, 100, 382, 150],
                "lines": [
                    {"bbox": [44, 100, 380, 112], "spans": [{"type": "text", "content": "A normal paragraph"}]},
                    {"bbox": [44, 116, 380, 128], "spans": [{"type": "text", "content": "establishes geometry."}]},
                ],
                "protected_translated_text": "这是一个普通正文段落，用来建立同栏正文几何。",
            },
            {
                "item_id": "body-anchor-2",
                "block_type": "text",
                "source_text": "Another normal paragraph establishes column body geometry.",
                "bbox": [44, 170, 382, 222],
                "lines": [
                    {"bbox": [44, 170, 380, 183], "spans": [{"type": "text", "content": "Another normal paragraph"}]},
                    {"bbox": [44, 186, 380, 199], "spans": [{"type": "text", "content": "establishes geometry."}]},
                ],
                "protected_translated_text": "这是另一个普通正文段落，用来建立同栏正文几何。",
            },
            {
                "item_id": "short-body",
                "block_type": "text",
                "source_text": "Short OCR bbox should not be a hard height limit.",
                "bbox": [44, 250, 288, 262],
                "lines": [
                    {
                        "bbox": [44, 250, 288, 262],
                        "spans": [{"type": "text", "content": "Short OCR bbox should not be a hard height limit."}],
                    }
                ],
                "protected_translated_text": "短 OCR 框不应成为正文高度硬限制。",
            },
        ]

        blocks = build_render_blocks(items, page_width=430.0, page_height=655.0)
        short_block = next(block for block in blocks if block.source_item_id == "short-body")

        self.assertGreater(short_block.inner_bbox[2] - short_block.inner_bbox[0], 244.0)
        self.assertGreaterEqual(short_block.font_size_pt, 11.0)

    def test_wide_aspect_body_preserves_more_ocr_line_pitch_signal(self):
        base_item = _sample_item(wide_aspect=False)
        wide_item = _sample_item(wide_aspect=True)

        base_leading = estimate_leading_em(base_item, 14.0, 10.8)
        wide_leading = estimate_leading_em(wide_item, 14.0, 10.8)

        self.assertLessEqual(wide_leading, base_leading)
        self.assertGreaterEqual(wide_leading, 0.34)

    def test_large_body_font_does_not_force_tight_leading(self):
        leading = normalize_leading_em_for_font_size(
            11.8,
            0.52,
            reference_font_size_pt=10.6,
            min_leading_em=BODY_LEADING_MIN,
            max_leading_em=BODY_LEADING_MAX,
            strength=1.0,
        )

        self.assertGreaterEqual(leading, 0.52)

    def test_dense_body_fit_prefers_font_shrink_over_cramped_leading(self):
        item = {
            "block_type": "text",
            "source_text": "Dense body paragraph.",
            "bbox": [40, 100, 220, 148],
            "_render_inner_bbox": [40, 100, 220, 148],
            "_is_body_text_candidate": True,
            "_dense_small_box": True,
            "_heavy_dense_small_box": False,
        }
        text = "这是一个非常密集的正文段落，需要在有限高度内优先缩小字号，而不是把行距压得过低。" * 4

        font_size, leading = fit_translated_block_metrics(
            item,
            text,
            [],
            10.8,
            0.58,
            page_body_font_size_pt=10.8,
        )

        self.assertLess(font_size, 10.4)
        self.assertGreaterEqual(leading, 0.54)
