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

class BodyFontInheritanceTests(unittest.TestCase):
    def test_short_body_line_inherits_same_column_font_floor(self):
        items = [
            {
                "item_id": "body-anchor-1",
                "block_type": "text",
                "source_text": "A normal body paragraph establishes the same-column font.",
                "bbox": [44, 100, 382, 150],
                "lines": [
                    {"bbox": [44, 100, 380, 112], "spans": [{"type": "text", "content": "A normal body paragraph"}]},
                    {"bbox": [44, 116, 380, 128], "spans": [{"type": "text", "content": "establishes the same-column font."}]},
                ],
                "protected_translated_text": "这是一个普通正文段落，用来建立本栏的正文字号。",
            },
            {
                "item_id": "body-anchor-2",
                "block_type": "text",
                "source_text": "Another normal paragraph in the same column.",
                "bbox": [44, 170, 382, 220],
                "lines": [
                    {"bbox": [44, 170, 380, 182], "spans": [{"type": "text", "content": "Another normal paragraph"}]},
                    {"bbox": [44, 186, 380, 198], "spans": [{"type": "text", "content": "in the same column."}]},
                ],
                "protected_translated_text": "这是同一栏里的另一个普通正文段落。",
            },
            {
                "item_id": "body-anchor-3",
                "block_type": "text",
                "source_text": "A third paragraph makes the column signal stable.",
                "bbox": [44, 240, 382, 290],
                "lines": [
                    {"bbox": [44, 240, 380, 252], "spans": [{"type": "text", "content": "A third paragraph"}]},
                    {"bbox": [44, 256, 380, 268], "spans": [{"type": "text", "content": "makes the signal stable."}]},
                ],
                "protected_translated_text": "第三个段落让同栏正文字号信号更加稳定。",
            },
            {
                "item_id": "short-body-line",
                "block_type": "text",
                "source_text": "Remember that we are still dealing with spin-orbitals.",
                "bbox": [44, 320, 288, 332],
                "lines": [
                    {
                        "bbox": [44, 320, 288, 332],
                        "spans": [{"type": "text", "content": "Remember that we are still dealing with spin-orbitals."}],
                    }
                ],
                "protected_translated_text": "请记住仍在处理自旋轨道。",
            },
            {
                "item_id": "next-tight-line",
                "block_type": "text",
                "source_text": "A following line sits close enough to trigger collision fit.",
                "bbox": [44, 333, 382, 345],
                "lines": [
                    {
                        "bbox": [44, 333, 382, 345],
                        "spans": [{"type": "text", "content": "A following line sits close."}],
                    }
                ],
                "protected_translated_text": "下一行很近，会触发相邻碰撞压缩。",
            },
        ]

        blocks = build_render_blocks(items, page_width=430.0, page_height=655.0)
        short_block = next(block for block in blocks if block.source_item_id == "short-body-line")
        anchor_fonts = [
            block.font_size_pt
            for block in blocks
            if block.source_item_id in {"body-anchor-1", "body-anchor-2", "body-anchor-3"}
        ]

        self.assertGreaterEqual(short_block.font_size_pt, min(anchor_fonts) - 0.9)
        self.assertGreaterEqual(short_block.fit_min_font_size_pt, min(anchor_fonts) - 1.1)

    def test_similar_body_fonts_unify_before_underfill_growth(self):
        items = [
            {
                "item_id": "body-1",
                "block_type": "text",
                "source_text": "Normal body paragraph one establishes the first paragraph in the same column.",
                "bbox": [44, 100, 382, 150],
                "lines": [
                    {"bbox": [44, 100, 380, 112], "spans": [{"type": "text", "content": "Normal body paragraph one"}]},
                    {"bbox": [44, 116, 380, 128], "spans": [{"type": "text", "content": "establishes the first paragraph."}]},
                ],
                "protected_translated_text": "这是同一栏中的第一段正文。",
            },
            {
                "item_id": "body-2",
                "block_type": "text",
                "source_text": "Normal body paragraph two with similar size.",
                "bbox": [44, 170, 382, 222],
                "lines": [
                    {"bbox": [44, 170, 380, 183], "spans": [{"type": "text", "content": "Normal body paragraph two."}]},
                    {"bbox": [44, 186, 380, 199], "spans": [{"type": "text", "content": "with similar size."}]},
                ],
                "protected_translated_text": "这是第二段正文，字号应当与第一段统一。",
            },
            {
                "item_id": "body-3",
                "block_type": "text",
                "source_text": "Normal body paragraph three with similar size.",
                "bbox": [44, 242, 382, 294],
                "lines": [
                    {"bbox": [44, 242, 380, 256], "spans": [{"type": "text", "content": "Normal body paragraph three."}]},
                    {"bbox": [44, 259, 380, 273], "spans": [{"type": "text", "content": "with similar size."}]},
                ],
                "protected_translated_text": "这是第三段正文，字号也应当统一。",
            },
        ]

        blocks = build_render_blocks(items, page_width=430.0, page_height=655.0)
        fonts = [block.font_size_pt for block in blocks]

        self.assertLess(max(fonts) / min(fonts), 1.06)
        self.assertLessEqual(max(fonts) - min(fonts), 0.7)

    def test_low_height_body_inherits_tall_same_column_font(self):
        items = [
            {
                "item_id": "tall-body-1",
                "block_type": "text",
                "source_text": "A tall paragraph establishes the same-column font.",
                "bbox": [44, 80, 382, 150],
                "lines": [
                    {"bbox": [44, 80, 380, 94], "spans": [{"type": "text", "content": "A tall paragraph establishes"}]},
                    {"bbox": [44, 100, 380, 114], "spans": [{"type": "text", "content": "the same-column font."}]},
                ],
                "protected_translated_text": "这是一个较高的正文段落，用来建立同栏正文字号。",
            },
            {
                "item_id": "low-body",
                "block_type": "text",
                "source_text": "A lower-height paragraph in the same body column should not stay tiny.",
                "bbox": [44, 170, 382, 202],
                "lines": [
                    {"bbox": [44, 170, 380, 183], "spans": [{"type": "text", "content": "A lower-height paragraph"}]},
                    {"bbox": [44, 187, 380, 200], "spans": [{"type": "text", "content": "in the same body column."}]},
                ],
                "protected_translated_text": "这是同栏中高度较低的正文段落，字号应当向较高正文框看齐。",
            },
            {
                "item_id": "tall-body-2",
                "block_type": "text",
                "source_text": "Another tall paragraph stabilizes the same-column font.",
                "bbox": [44, 230, 382, 302],
                "lines": [
                    {"bbox": [44, 230, 380, 244], "spans": [{"type": "text", "content": "Another tall paragraph"}]},
                    {"bbox": [44, 250, 380, 264], "spans": [{"type": "text", "content": "stabilizes the same-column font."}]},
                ],
                "protected_translated_text": "另一个较高的正文段落让同栏字号信号更稳定。",
            },
        ]

        blocks = build_render_blocks(items, page_width=430.0, page_height=655.0)
        low_block = next(block for block in blocks if block.source_item_id == "low-body")
        tall_fonts = [
            block.font_size_pt
            for block in blocks
            if block.source_item_id in {"tall-body-1", "tall-body-2"}
        ]

        self.assertGreaterEqual(low_block.font_size_pt, min(tall_fonts) - 0.35)
