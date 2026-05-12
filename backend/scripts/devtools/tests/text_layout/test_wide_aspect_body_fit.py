import sys
import unittest
from pathlib import Path


REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from services.rendering.layout.font_fit import estimate_font_size_pt
from services.rendering.layout.font_fit import estimate_leading_em
from services.rendering.layout.font_fit import local_font_size_pt
from services.rendering.layout.payload.blocks import build_render_blocks
from services.rendering.layout.payload.block_seed import _relax_wide_aspect_body_leading
from services.rendering.layout.typography.measurement import source_visual_line_count
from services.rendering.layout.typography.measurement import visual_line_count


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


class WideAspectBodyFitTests(unittest.TestCase):
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
        self.assertEqual(narrow_block.cover_bbox, [40, 240, 250, 255])

    def test_wide_aspect_body_preserves_more_ocr_line_pitch_signal(self):
        base_item = _sample_item(wide_aspect=False)
        wide_item = _sample_item(wide_aspect=True)

        base_leading = estimate_leading_em(base_item, 14.0, 10.8)
        wide_leading = estimate_leading_em(wide_item, 14.0, 10.8)

        self.assertLessEqual(wide_leading, base_leading)
        self.assertGreaterEqual(wide_leading, 0.54)

    def test_wide_aspect_body_relaxes_leading_when_vertical_slack_exists(self):
        text = (
            "本文件提出了产业政策议程的初步构想，旨在确保向超级智能过渡的过程中以人为本。"
            "内容分为两部分：一是构建一个具有广泛参与、参与和共享繁荣的开放经济；"
            "二是通过问责、对齐和前沿风险管理来建设一个具有韧性的社会。"
        )
        relaxed = _relax_wide_aspect_body_leading(
            [82.0, 337.0, 530.0, 436.0],
            text,
            [],
            11.32,
            0.60,
        )
        self.assertGreater(relaxed, 0.60)

    def test_wide_aspect_body_keeps_leading_when_height_is_tight(self):
        text = (
            "然而，正是这些推动进步的能力，也将以前所未有的速度和规模重塑整个产业。"
            "部分工作岗位将消失，另一些将演变，而随着各组织学会如何部署先进人工智能，"
            "全新的工作形态也将应运而生。"
        )
        relaxed = _relax_wide_aspect_body_leading(
            [82.0, 454.0, 530.0, 493.0],
            text,
            [],
            11.32,
            0.60,
        )
        self.assertEqual(relaxed, 0.60)


if __name__ == "__main__":
    unittest.main()
