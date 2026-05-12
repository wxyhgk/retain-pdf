from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.layout.fit_decision import plan_chinese_body_fit


def test_formula_heavy_text_limits_chinese_body_shrink() -> None:
    text = "__FORMULA_1__ 与 __FORMULA_2__ 决定 __FORMULA_3__ 的变化。"
    formula_map = [
        {"placeholder": "__FORMULA_1__", "formula_text": r"g^{IJ}(R_x)"},
        {"placeholder": "__FORMULA_2__", "formula_text": r"h^{IJ}(R_x)"},
        {"placeholder": "__FORMULA_3__", "formula_text": r"\\delta\\mathbf{R}"},
    ]

    decision = plan_chinese_body_fit(
        bbox_width_pt=100.0,
        bbox_height_pt=24.0,
        text=text,
        formula_map=formula_map,
        font_size_pt=10.4,
        leading_em=0.6,
    )

    assert decision.font_size_pt >= 10.2
    assert "formula_weighted" in decision.reason_codes
    assert "formula_complexity" in decision.reason_codes


def test_plain_chinese_height_pressure_can_shrink_safely() -> None:
    text = "这是一个较长的中文正文段落，需要根据宽度估算换行，并在高度不足时只做轻微字号调整。"

    decision = plan_chinese_body_fit(
        bbox_width_pt=120.0,
        bbox_height_pt=65.0,
        text=text,
        formula_map=[],
        font_size_pt=10.6,
        leading_em=0.6,
    )

    assert decision.font_size_pt < 10.6
    assert decision.font_size_pt >= 10.0
    assert decision.shrink_pt > 0
    assert decision.mode == "continuous_fit"


def test_underfill_growth_is_gradual() -> None:
    text = "这是较短的正文。"

    low_fill = plan_chinese_body_fit(
        bbox_width_pt=180.0,
        bbox_height_pt=90.0,
        text=text,
        formula_map=[],
        font_size_pt=10.0,
        leading_em=0.6,
        max_growth_font_size_pt=10.35,
    )
    medium_fill = plan_chinese_body_fit(
        bbox_width_pt=180.0,
        bbox_height_pt=52.0,
        text=text,
        formula_map=[],
        font_size_pt=10.0,
        leading_em=0.6,
        max_growth_font_size_pt=10.35,
    )

    assert low_fill.growth_pt > medium_fill.growth_pt
    assert 0.0 < medium_fill.growth_pt < 0.35
    assert low_fill.font_size_pt <= 10.35


def test_formula_ratio_reduces_underfill_growth() -> None:
    plain = plan_chinese_body_fit(
        bbox_width_pt=180.0,
        bbox_height_pt=90.0,
        text="这是较短的正文。",
        formula_map=[],
        font_size_pt=10.0,
        leading_em=0.6,
        max_growth_font_size_pt=10.35,
    )
    formula = plan_chinese_body_fit(
        bbox_width_pt=180.0,
        bbox_height_pt=90.0,
        text="__FORMULA_1__ 决定 __FORMULA_2__。",
        formula_map=[
            {"placeholder": "__FORMULA_1__", "formula_text": r"g^{IJ}(R_x)"},
            {"placeholder": "__FORMULA_2__", "formula_text": r"h^{IJ}(R_x)"},
        ],
        font_size_pt=10.0,
        leading_em=0.6,
        max_growth_font_size_pt=10.35,
    )

    assert formula.growth_pt < plain.growth_pt


def test_many_simple_inline_formulas_do_not_shrink_aggressively() -> None:
    text = "__FORMULA_1__、__FORMULA_2__、__FORMULA_3__ 与 __FORMULA_4__ 描述了势能面。"
    formula_map = [
        {"placeholder": "__FORMULA_1__", "formula_text": r"x_1"},
        {"placeholder": "__FORMULA_2__", "formula_text": r"x_2"},
        {"placeholder": "__FORMULA_3__", "formula_text": r"E_1"},
        {"placeholder": "__FORMULA_4__", "formula_text": r"E_2"},
    ]

    decision = plan_chinese_body_fit(
        bbox_width_pt=112.0,
        bbox_height_pt=24.0,
        text=text,
        formula_map=formula_map,
        font_size_pt=10.4,
        leading_em=0.6,
    )

    assert decision.font_size_pt >= 10.1
    assert "formula_count_weighted" in decision.reason_codes


def test_complex_formula_count_reduces_estimate_trust_more_than_simple_count() -> None:
    simple = plan_chinese_body_fit(
        bbox_width_pt=180.0,
        bbox_height_pt=90.0,
        text="__FORMULA_1__ 决定 __FORMULA_2__。",
        formula_map=[
            {"placeholder": "__FORMULA_1__", "formula_text": r"x_1"},
            {"placeholder": "__FORMULA_2__", "formula_text": r"x_2"},
        ],
        font_size_pt=10.0,
        leading_em=0.6,
        max_growth_font_size_pt=10.35,
    )
    complex_formula = plan_chinese_body_fit(
        bbox_width_pt=180.0,
        bbox_height_pt=90.0,
        text="__FORMULA_1__ 决定 __FORMULA_2__。",
        formula_map=[
            {"placeholder": "__FORMULA_1__", "formula_text": r"\\frac{\\partial E}{\\partial R}"},
            {"placeholder": "__FORMULA_2__", "formula_text": r"\\sqrt{\\delta\\mathbf{R}^{IJ}}"},
        ],
        font_size_pt=10.0,
        leading_em=0.6,
        max_growth_font_size_pt=10.35,
    )

    assert complex_formula.confidence < simple.confidence
    assert complex_formula.growth_pt < simple.growth_pt
