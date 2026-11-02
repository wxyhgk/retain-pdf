"""render_prep：交给渲染器之前对单个公式的改写（原 inline_math 里的内嵌函数，行为不变）。"""

import pytest

from retainpdf_math.render_prep import normalize_angstrom_in_text
from retainpdf_math.render_prep import prepare_formula_for_render


@pytest.mark.parametrize(
    ("tex", "display", "expected"),
    [
        (r"R_e/\AA=1.25", False, ("R_e/Å=1.25", True)),
        (r"\text{1 \AA}", False, (r"\text{1 Å}", True)),
        (r"\text{\mathring{A}}", False, (r"\text{Å}", True)),
        (r"\mathring{A}", False, (r"\mathring{A}", True)),  # 数学模式里常是「A 的内部」，不改
        (r"\circled{R}", False, ("R", True)),
        (r"\circled{\times}", False, (r"\otimes", True)),
        (r"^®", False, ("®", False)),
        (r"\A\12", False, ("A12", False)),  # 表格单元格名
        (r"\langlen|", False, (r"\langle n|", True)),
        (r"\angleABC", False, (r"\angle ABC", True)),
        # OCR 拍平的上下标：同一个底数两个下标 / 两个上标，MathJax 整个公式报错，补一个空底数
        (r"\mathbf{F}_1_* = -\mathbf{g}(\mathbf{x}_l^{1*})", False, (r"\mathbf{F}_1{}_* = -\mathbf{g}(\mathbf{x}_l^{1*})", True)),
        (r"x^2^3", False, (r"x^2{}^3", True)),
        (r"x_{a}_{b}", False, (r"x_{a}{}_{b}", True)),
        (r"x_1^2_3", False, (r"x_1^2{}_3", True)),
    ],
)
def test_formula_rewrites(tex, display, expected):
    assert prepare_formula_for_render(tex, display=display) == expected


def test_matrix_line_breaks_survive():
    prepared, still_math = prepare_formula_for_render(r"\begin{cases} a \\ b \end{cases}", display=True)
    assert still_math and r"\\" in prepared


def test_angstrom_in_prose_only_touches_the_command():
    assert normalize_angstrom_in_text(r"1 \AA thick, path \r\n") == r"1 Å thick, path \r\n"


@pytest.mark.parametrize(
    "tex",
    [
        r"x_1^2",
        r"\sum_{i=1}^{n} a_i b_i",
        r"\sum\limits_{i}^{n} x",
        r"\mathbf{F}_1^* - \mathbf{F}_2^*",
        r"{x_a}_b",
        r"e^{x^2}",
        r"\begin{cases} a_1 & b_2 \\ c_3 & d_4 \end{cases}",
    ],
)
def test_single_scripts_are_left_alone(tex):
    assert prepare_formula_for_render(tex, display=False) == (tex, True)


# ---- 2026-11-02：渲染后查出来、原样印成源码的几种公式 ----

from retainpdf_math.direct_typst import close_trailing_inline_math
from retainpdf_math.normalize import normalize_formula_for_latex_math
from retainpdf_math.source_repair import balance_left_right


def test_array_is_kept_for_matrices():
    # 删了 array 只剩 `&`、`\\`：MathJax 报 Misplaced &，mitex 排成一行（一份电子版第 24 页的矩阵）
    tex = r"\mathbf {A} = \left( \begin{array}{c c} 3 & 2 i \\ - 2 i & 0 \end{array} \right)"
    assert r"\begin{array}{c c}" in normalize_formula_for_latex_math(tex)
    rendered, still_math = prepare_formula_for_render(tex, display=True)
    assert still_math and r"\begin{array}{c c}" in rendered and r"\end{array}" in rendered


@pytest.mark.parametrize(
    ("tex", "expected"),
    [
        # OCR 把中间的竖线写成 \left|：多一个 \left
        (r"S_{ij}\equiv \left\langle \Phi_{i}\left| \Phi_{j}\right\rangle.", r"S_{ij}\equiv \left\langle \Phi_{i}\left| \Phi_{j}\right\rangle. \right."),
        (r"x \right) + 1", r"\left. x \right) + 1"),
        (r"\left( a \right) \leftarrow \rightarrow", r"\left( a \right) \leftarrow \rightarrow"),  # 箭头不是定界符
        (r"\left\langle a \middle| b \right\rangle", r"\left\langle a \middle| b \right\rangle"),
    ],
)
def test_unpaired_left_right_get_an_invisible_partner(tex, expected):
    assert balance_left_right(tex) == expected


def test_render_prep_balances_left_right():
    rendered, _ = prepare_formula_for_render(r"\left\langle a \left| b \right\rangle", display=False)
    assert rendered.count(r"\left") == rendered.count(r"\right")


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        # GLM 截断了最后一个公式的收尾 `$`（一页 Goldstone 图表）
        (r"4 $s$ $(-)^{3+2} \sum_{abc}$ 5 $r$ $(-)^{3+3} \sum_{abcrst} \frac{a}{b}", r"4 $s$ $(-)^{3+2} \sum_{abc}$ 5 $r$ $(-)^{3+3} \sum_{abcrst} \frac{a}{b}$"),
        (r"价格是 $5 美元", r"价格是 $5 美元"),  # 看不出是 LaTeX
        (r"price $5 each", r"price $5 each"),
        (r"$a$ 和 $\frac{1}{2} 之后", r"$a$ 和 $\frac{1}{2} 之后"),  # 后面有中文：不知道公式到哪结束
        ("$x$ and $\\frac{1}{2}\nnext line", "$x$ and $\\frac{1}{2}\nnext line"),
        (r"$x$ and $y$", r"$x$ and $y$"),
        (r"$$\frac{a}{b}$$ then $\alpha_{1}", r"$$\frac{a}{b}$$ then $\alpha_{1}$"),
        (r"cost \$5 and $x^{2}", r"cost \$5 and $x^{2}$"),
    ],
)
def test_a_trailing_formula_missing_its_closing_dollar_is_closed(text, expected):
    assert close_trailing_inline_math(text) == expected
