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

class BodyLineCountAndSingleLineTests(unittest.TestCase):
    def test_source_visual_line_count_uses_observed_ocr_lines_not_text_length(self):
        item = {
            "block_type": "text",
            "source_text": (
                "This is a very long OCR line that would normally wrap by text-length prediction, "
                "but the source line count should still reflect the observed OCR line geometry only."
            ),
            "bbox": [40, 100, 220, 145],
            "lines": [
                {
                    "bbox": [40, 100, 220, 112],
                    "spans": [{"type": "text", "content": "This is a very long OCR line"}],
                }
            ],
        }

        self.assertEqual(source_visual_line_count(item), 1)
        self.assertGreater(visual_line_count(item), 1)

    def test_small_single_line_body_uses_original_bbox(self):
        items = [
            _sample_item(wide_aspect=False),
            {
                "item_id": "small-line",
                "block_type": "text",
                "source_text": "This is a body continuation line whose OCR bbox is too short for the real font size.",
                "bbox": [40, 220, 512, 228],
                "lines": [
                    {
                        "bbox": [40, 220, 510, 228],
                        "spans": [
                            {
                                "type": "text",
                                "content": "This is a body continuation line whose OCR bbox is too short.",
                            }
                        ],
                    }
                ],
                "protected_translated_text": "这是正文中的一行续写，OCR 给出的高度偏小，但字号应当跟随本页正文。",
            },
        ]

        blocks = build_render_blocks(items, page_width=612.0, page_height=792.0)
        body_block = next(block for block in blocks if block.block_id == "item-1")

        self.assertEqual(body_block.inner_bbox, items[1]["bbox"])

    def test_narrow_single_line_body_uses_original_bbox(self):
        items = [
            _sample_item(wide_aspect=False),
            {
                "item_id": "line-1",
                "block_type": "text",
                "source_text": "This normal body line provides the page body width reference for rendering.",
                "bbox": [40, 220, 512, 235],
                "lines": [
                    {
                        "bbox": [40, 220, 510, 235],
                        "spans": [{"type": "text", "content": "This normal body line provides the reference."}],
                    }
                ],
                "protected_translated_text": "这是正常宽度的正文行，用来提供页面正文宽度基准。",
            },
            {
                "item_id": "line-2",
                "block_type": "text",
                "source_text": "This middle body line has a clipped OCR bbox but should render at normal width.",
                "bbox": [40, 240, 250, 255],
                "lines": [
                    {
                        "bbox": [40, 240, 250, 255],
                        "spans": [{"type": "text", "content": "This middle body line has a clipped OCR bbox."}],
                    }
                ],
                "protected_translated_text": "这是中间一行正文，OCR 给出的宽度偏短，但排版不应该因此强制换行。",
            },
            {
                "item_id": "line-3",
                "block_type": "text",
                "source_text": "This following body line also keeps the normal page body text width.",
                "bbox": [40, 260, 512, 275],
                "lines": [
                    {
                        "bbox": [40, 260, 510, 275],
                        "spans": [{"type": "text", "content": "This following body line keeps normal width."}],
                    }
                ],
                "protected_translated_text": "这是后续正常宽度的正文行。",
            },
        ]

        blocks = build_render_blocks(items, page_width=612.0, page_height=792.0)
        narrow_block = next(block for block in blocks if block.block_id == "item-2")

        self.assertEqual(narrow_block.inner_bbox, items[2]["bbox"])
        self.assertLess(narrow_block.cover_bbox[0], 40)
        self.assertLess(narrow_block.cover_bbox[1], 240)
        self.assertGreater(narrow_block.cover_bbox[2], 250)
        self.assertGreater(narrow_block.cover_bbox[3], 255)

