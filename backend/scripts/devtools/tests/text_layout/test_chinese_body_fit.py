from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.layout.chinese_body_fit import estimate_chinese_body_height_pt
from services.rendering.layout.chinese_body_fit import estimate_chinese_body_lines
from services.rendering.layout.chinese_body_fit import formula_unit_ratio
from services.rendering.layout.chinese_body_fit import solve_chinese_body_font_size_pt
from services.rendering.layout.chinese_body_fit import tokenize_chinese_body_text


def test_chinese_body_line_count_uses_bbox_width() -> None:
    text = "这是一个用于测试中文正文宽度估算的段落，宽度越窄换行越多。"

    wide_lines, _ = estimate_chinese_body_lines(240.0, text, [], 10.0)
    narrow_lines, _ = estimate_chinese_body_lines(80.0, text, [], 10.0)

    assert narrow_lines > wide_lines


def test_chinese_body_solver_reduces_font_when_height_is_tight() -> None:
    text = "这是一个较长的中文正文段落，需要根据 bbox 宽度估算换行数，再根据高度反推出可用字号。"

    loose = solve_chinese_body_font_size_pt(
        180.0,
        90.0,
        text,
        [],
        leading_em=0.6,
        min_font_size_pt=8.0,
        max_font_size_pt=11.0,
    )
    tight = solve_chinese_body_font_size_pt(
        180.0,
        42.0,
        text,
        [],
        leading_em=0.6,
        min_font_size_pt=8.0,
        max_font_size_pt=11.0,
    )

    assert loose.font_size_pt > tight.font_size_pt
    assert tight.estimated_height_pt <= 42.0


def test_formula_lines_add_height_pressure() -> None:
    text = "其中 __FORMULA_1__ 表示能量差，后续正文继续解释该条件。"
    formula_map = [{"placeholder": "__FORMULA_1__", "formula_text": r"\\Delta E_{IJ}(\\mathbf{R}) = 0"}]

    without_formula = estimate_chinese_body_height_pt(160.0, text.replace("__FORMULA_1__", "能量差"), [], 10.0, 0.6)
    with_formula = estimate_chinese_body_height_pt(160.0, text, formula_map, 10.0, 0.6)

    assert with_formula.estimated_height_pt > without_formula.estimated_height_pt
    assert with_formula.formula_ratio > 0


def test_tokenizer_distinguishes_chinese_ascii_punctuation_and_formula() -> None:
    tokens = tokenize_chinese_body_text("图3. g-h 平面 __FORMULA_1__", [{"placeholder": "__FORMULA_1__", "formula_text": "g-h"}])

    assert any(token.formula for token in tokens)
    assert any(token.text == "图" for token in tokens)
    assert any(token.text == "g-h" for token in tokens)


def test_tokenizer_treats_dollar_inline_math_as_formula() -> None:
    tokens = tokenize_chinese_body_text(r"沿 $g-h(\mathbf{R}_x)$ 路径变化。", [])

    formula_tokens = [token for token in tokens if token.formula]
    assert len(formula_tokens) == 1
    assert formula_tokens[0].text == r"$g-h(\mathbf{R}_x)$"


def test_formula_heavy_text_lowers_fit_confidence() -> None:
    text = "__FORMULA_1__ 与 __FORMULA_2__ 决定 __FORMULA_3__ 的变化。"
    formula_map = [
        {"placeholder": "__FORMULA_1__", "formula_text": r"g^{IJ}(R_x)"},
        {"placeholder": "__FORMULA_2__", "formula_text": r"h^{IJ}(R_x)"},
        {"placeholder": "__FORMULA_3__", "formula_text": r"\\delta\\mathbf{R}"},
    ]

    result = estimate_chinese_body_height_pt(160.0, text, formula_map, 10.0, 0.6)

    assert formula_unit_ratio(text, formula_map) > 0.35
    assert result.confidence < 0.5
    assert result.max_safe_shrink_pt <= 0.2
