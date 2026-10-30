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
