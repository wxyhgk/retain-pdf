from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.layout.payload.capacity import estimated_render_height_pt
from services.rendering.layout.payload.capacity import formula_estimate_discount


def test_formula_estimate_discount_keeps_plain_text_unchanged() -> None:
    assert formula_estimate_discount("这是一段普通正文。", []) == 1.0


def test_formula_estimate_discount_is_continuous_and_bounded() -> None:
    formula_map = [
        {"placeholder": "[[FORMULA_1]]", "formula_text": r"x_1"},
        {"placeholder": "[[FORMULA_2]]", "formula_text": r"\\frac{\\partial E}{\\partial R}"},
        {"placeholder": "[[FORMULA_3]]", "formula_text": r"\\sqrt{\\delta R}"},
    ]

    discount = formula_estimate_discount(
        "[[FORMULA_1]] 与 [[FORMULA_2]] 以及 [[FORMULA_3]] 共同决定结果。",
        formula_map,
    )

    assert 0.86 <= discount < 1.0


def test_dollar_inline_math_contributes_to_formula_discount() -> None:
    discount = formula_estimate_discount(
        r"沿 $g-h(\mathbf{R}_x)$ 和 $\\frac{\\partial E}{\\partial R}$ 路径变化。",
        [],
    )

    assert 0.86 <= discount < 1.0


def test_formula_heavy_height_estimate_is_less_aggressive_than_plain_line_count() -> None:
    inner = [0.0, 0.0, 120.0, 30.0]
    formula_map = [
        {"placeholder": "[[FORMULA_1]]", "formula_text": r"x_1"},
        {"placeholder": "[[FORMULA_2]]", "formula_text": r"\\frac{\\partial E}{\\partial R}"},
        {"placeholder": "[[FORMULA_3]]", "formula_text": r"\\sqrt{\\delta R}"},
    ]
    formula_text = "[[FORMULA_1]] 与 [[FORMULA_2]] 以及 [[FORMULA_3]] 共同决定结果。"
    plain_text = "变量一与偏导能量以及平方根扰动共同决定结果。"

    formula_height = estimated_render_height_pt(inner, formula_text, formula_map, 10.4, 0.6)
    plain_height = estimated_render_height_pt(inner, plain_text, [], 10.4, 0.6)

    assert formula_height < plain_height * 1.35
