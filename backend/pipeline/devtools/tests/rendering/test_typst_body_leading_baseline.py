import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.render.layout.payload.body_pipeline import apply_body_payload_pipeline


def test_page_leading_baseline_only_weakly_dampens_normal_body_leading_jumps() -> None:
    def make_payload(height: float, source_lines: int) -> dict:
        return {
            "inner_bbox": [10.0, 0.0, 260.0, height],
            "translated_text": "普通正文段落用于测试页面行距基准。" * 2,
            "formula_map": [],
            "font_size_pt": 10.2,
            "leading_em": 0.54,
            "dense_small_box": False,
            "heavy_dense_small_box": False,
            "is_body": True,
            "render_kind": "markdown",
            "prefer_typst_fit": False,
            "item": {
                "source_text": "normal body words enough",
                "lines": [
                    {"bbox": [10.0, index * 10.0, 260.0, index * 10.0 + 8.0]}
                    for index in range(source_lines)
                ],
            },
        }

    compact = make_payload(90.0, 4)
    loose = make_payload(180.0, 7)

    apply_body_payload_pipeline([compact, loose], page_text_width_med=220.0)

    assert loose["leading_em"] >= compact["leading_em"]
    assert loose["leading_em"] - compact["leading_em"] <= 0.32


def test_loose_source_pitch_can_override_page_leading_baseline() -> None:
    def make_payload(height: float, source_lines: int, pitch: float) -> dict:
        return {
            "inner_bbox": [10.0, 0.0, 260.0, height],
            "translated_text": "普通正文段落用于测试很宽松英文原文对应的动态行距。" * 2,
            "formula_map": [],
            "font_size_pt": 10.2,
            "leading_em": 0.54,
            "dense_small_box": False,
            "heavy_dense_small_box": False,
            "is_body": True,
            "render_kind": "markdown",
            "prefer_typst_fit": False,
            "item": {
                "source_text": "normal body words enough",
                "lines": [
                    {"bbox": [10.0, index * pitch, 260.0, index * pitch + 8.0]}
                    for index in range(source_lines)
                ],
            },
        }

    compact = make_payload(90.0, 4, 10.0)
    loose = make_payload(210.0, 11, 18.0)

    apply_body_payload_pipeline([compact, loose], page_text_width_med=220.0)

    assert loose["leading_em"] >= compact["leading_em"] + 0.20
    assert loose["leading_em"] <= 1.02
