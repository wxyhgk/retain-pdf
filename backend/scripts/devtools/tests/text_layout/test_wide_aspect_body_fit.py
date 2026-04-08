import sys
import unittest
from pathlib import Path


REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from services.rendering.layout.font_fit import estimate_font_size_pt
from services.rendering.layout.font_fit import estimate_leading_em
from services.rendering.layout.payload.block_seed import _relax_wide_aspect_body_leading


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
