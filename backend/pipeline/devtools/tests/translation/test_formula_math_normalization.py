import sys
from pathlib import Path

import pytest

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.render.layout.inline_content.fallback.latex_normalizer import normalize_formula_for_latex_math
from retainpdf_pipeline.render.layout.inline_content.fallback.png_renderer import compile_formula_png
from retainpdf_pipeline.render.layout.inline_content.fallback.png_renderer import convert_latexish_to_typst


MATH_NORMALIZATION_CASES = [
    {
        "name": "spaced_mathrm_unit",
        "source": r"\lambda = 1 2 2 \mathrm { n m }",
        "expected_normalized": r"\lambda = 122 \mathrm{nm}",
    },
    {
        "name": "nested_spaced_mathrm_unit",
        "source": r"\lambda = 9 1 \mathrm { { n m } }",
        "expected_normalized": r"\lambda = 91 \mathrm{nm}",
    },
    {
        "name": "legacy_bf_letter_group",
        "source": r"{ \bf R }",
        "expected_normalized": r"R",
    },
    {
        "name": "legacy_bf_symbol_group",
        "source": r"{ \bf \omega }",
        "expected_normalized": r"\omega",
    },
    {
        "name": "legacy_bf_direct_group",
        "source": r"\bf{a}",
        "expected_normalized": r"a",
    },
    {
        "name": "legacy_rm_direct_group",
        "source": r"\rm{nm}",
        "expected_normalized": r"nm",
    },
    {
        "name": "modern_mathrm_direct_group",
        "source": r"\mathrm{Fe}",
        "expected_normalized": r"\mathrm{Fe}",
    },
    {
        "name": "modern_mathbf_direct_symbol",
        "source": r"\mathbf{\omega}",
        "expected_normalized": r"\mathbf{\omega}",
    },
    {
        "name": "trailing_dot_ocr_noise",
        "source": r"1 / n ^ { \prime 2 } \approx 0 \dot )",
        "expected_normalized": r"1 / n^{\prime 2} \approx 0.)",
    },
]


def test_formula_normalizer_repairs_low_risk_ocr_noise() -> None:
    assert normalize_formula_for_latex_math(r"\mathrm { C 0 0 H ^ { * } } ]") == r"\mathrm{COOH^{*}} ]"
    assert normalize_formula_for_latex_math(r"1 . 2 7 ~ \mathrm { e V } .") == r"1.27 \mathrm{eV}"
    assert normalize_formula_for_latex_math(r"\mathrm { C H } _ { 4 } ,") == r"\mathrm{CH}_{4}"
    assert normalize_formula_for_latex_math(r"\langle A \rrangle") == r"\langle A \rangle"
    assert normalize_formula_for_latex_math(r"\circled{\times}") == r"\otimes"
    assert normalize_formula_for_latex_math(r"\circled{A}") == "A"


def test_formula_normalizer_drops_style_noise_without_guessing_structure() -> None:
    assert normalize_formula_for_latex_math(r"\bf { g } { - } \vec { C } 3 N _ { 4 }") == r"g { - } C 3 N_{4}"


def test_formula_normalizer_preserves_hyphenated_letter_connectors() -> None:
    assert normalize_formula_for_latex_math(r"a-b") == r"a-b"
    assert normalize_formula_for_latex_math(r"i-Pr") == r"i-Pr"
    assert normalize_formula_for_latex_math(r"Ph(i- PrO)") == r"Ph(i-PrO)"


def test_formula_normalizer_unwraps_nested_text_style_macros_in_scripts() -> None:
    assert normalize_formula_for_latex_math(r"_ { \textbf { \em x } }") == r"{} _{{x}}"


def test_formula_normalizer_compacts_subscript_and_superscript_groups() -> None:
    assert normalize_formula_for_latex_math(r"x _ { i , j }") == r"x_{i , j}"
    assert normalize_formula_for_latex_math(r"E _ { g } ^ { dir }") == r"E_{g}^{dir}"
    assert normalize_formula_for_latex_math(r"\Delta G _ { H ^ * }") == r"\Delta G_{H^*}"
    assert normalize_formula_for_latex_math(r"H^{+}") == r"H^{+}"
    assert normalize_formula_for_latex_math(r"COOH^{*}") == r"COOH^{*}"
    assert normalize_formula_for_latex_math(r"m ^ \top") == r"m^\top"


def test_typst_formula_converter_preserves_subscript_structure() -> None:
    assert convert_latexish_to_typst(r"\mathrm{CaO}_2") == "CaO_(2)"
    assert convert_latexish_to_typst(r"C_3N_4") == "C_(3)N_(4)"
    assert convert_latexish_to_typst(r"x_{i,j}") == "x_(i , j)"
    assert convert_latexish_to_typst(r"a-b") == "a-b"
    assert convert_latexish_to_typst(r"i-Pr") == "i-Pr"
    assert convert_latexish_to_typst(r"E_{g}^{dir}") == "E_(g)^(dir)"
    assert convert_latexish_to_typst(r"\Delta G_{H^*}") == "Δ G_(H^(*))"
    assert convert_latexish_to_typst(r"\alpha _ { t } ^ { \prime }") == "α_(t)^(prime)"
    assert convert_latexish_to_typst(r"m^\top") == "m^⊤"
    assert convert_latexish_to_typst(r"\frac { - \alpha _ { t } ^ { \prime } } { 1 - \alpha _ { t } }") == "frac(- α_(t)^(prime), 1 - α_(t))"
    assert convert_latexish_to_typst(r"\mathbf { \Delta } _ { \mathbf { \mathcal { X } } _ { t } }") == "bold(Δ)_(bold(X)_(t))"


def test_formula_normalizer_preserves_structural_commands() -> None:
    assert normalize_formula_for_latex_math(r"\frac { a _ { i } } { b ^ 2 }") == r"\frac { a_{i} } { b^2 }"
    assert normalize_formula_for_latex_math(r"\sqrt { x _ { i , j } }") == r"\sqrt { x_{i , j} }"
    assert normalize_formula_for_latex_math(r"\left ( x _ { i } + y ^ 2 \right )") == r"\left ( x_{i} + y^2 \right )"


@pytest.mark.parametrize(
    ("source", "expected_normalized"),
    [(case["source"], case["expected_normalized"]) for case in MATH_NORMALIZATION_CASES],
)
def test_formula_normalization_casebook_regressions(source: str, expected_normalized: str) -> None:
    assert normalize_formula_for_latex_math(source) == expected_normalized


def test_typst_formula_compilation_handles_prime_and_mathcal_scripts() -> None:
    for formula in (
        r"\alpha _ { t } ^ { \prime }",
        r"\frac { - \alpha _ { t } ^ { \prime } } { 1 - \alpha _ { t } }",
        r"\mathbf { \Delta } _ { \mathbf { \mathcal { X } } _ { t } }",
    ):
        path, size = compile_formula_png(formula)
        assert path.exists()
        assert size[0] > 0 and size[1] > 0
