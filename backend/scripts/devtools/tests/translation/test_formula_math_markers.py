import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from services.rendering.formula.math_utils import build_markdown_from_parts
from services.rendering.formula.normalizer import normalize_formula_for_latex_math
from services.translation.payload.formula_protection import re_protect_restored_formulas
from services.translation.payload.formula_protection import restore_protected_tokens


def test_restored_formula_tokens_are_wrapped_as_inline_math() -> None:
    formula_map = [
        {
            "token_tag": "<f1-17a/>",
            "placeholder": "<f1-17a/>",
            "token_type": "formula",
            "formula_text": r"(\mathrm{CaO}_2)",
        }
    ]
    restored = restore_protected_tokens("过氧化钙<f1-17a/>释放", formula_map)
    assert restored == r"过氧化钙$(\mathrm{CaO}_2)$释放"


def test_reprotect_restored_formula_accepts_inline_math_marker() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"(\mathrm{CaO}_2)"}]
    protected = re_protect_restored_formulas(r"过氧化钙$(\mathrm{CaO}_2)$释放", formula_map)
    assert protected == "过氧化钙<f1-17a/>释放"


def test_reprotect_restored_formula_does_not_mutate_existing_typed_tokens() -> None:
    formula_map = [
        {"placeholder": "<f1-9a9/>", "formula_text": r"^ { \cdot } d"},
        {"placeholder": "<f2-797/>", "formula_text": "f"},
    ]
    protected = re_protect_restored_formulas(
        "然而，研究表明这些传统方法不适用于表征具有局域电子态的半导体<f1-9a9/>或<f2-797/>轨道）。",
        formula_map,
    )
    assert protected == "然而，研究表明这些传统方法不适用于表征具有局域电子态的半导体<f1-9a9/>或<f2-797/>轨道）。"


def test_reprotect_restored_formula_does_not_replace_plain_identifier_in_prose() -> None:
    formula_map = [{"placeholder": "<f1-797/>", "formula_text": "f"}]
    protected = re_protect_restored_formulas("Heyd-Scuseria-Ernzerhof（HSE）", formula_map)
    assert protected == "Heyd-Scuseria-Ernzerhof（HSE）"


def test_typst_markdown_supports_typed_formula_placeholders() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"(\mathrm{CaO}_2)"}]
    markdown = build_markdown_from_parts("过氧化钙<f1-17a/>释放", formula_map)
    assert markdown == r"过氧化钙 $(\mathrm{CaO}_2)$ 释放"


def test_typst_markdown_keeps_spaces_around_inline_math() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"\pi"}]
    markdown = build_markdown_from_parts("你好<f1-17a/>，下一步", formula_map)
    assert markdown == r"你好 $\pi$ ，下一步"


def test_typst_markdown_renders_superscript_citation_as_text() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"^{6c}"}]
    markdown = build_markdown_from_parts("方法<f1-17a/>促使", formula_map)
    assert markdown == "方法⁶ᶜ促使"


def test_typst_markdown_compacts_bracket_citation_text() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"[35, 36]"}]
    markdown = build_markdown_from_parts("见<f1-17a/>下一步", formula_map)
    assert markdown == "见[35,36]下一步"


def test_formula_normalizer_repairs_low_risk_ocr_noise() -> None:
    assert normalize_formula_for_latex_math(r"\mathrm { C 0 0 H ^ { * } } ]") == r"\mathrm{COOH^{*}} ]"
    assert normalize_formula_for_latex_math(r"1 . 2 7 ~ \mathrm { e V } .") == r"1.27 \mathrm{eV}"
    assert normalize_formula_for_latex_math(r"\mathrm { C H } _ { 4 } ,") == r"\mathrm{CH} _ { 4 }"


def test_formula_normalizer_drops_style_noise_without_guessing_structure() -> None:
    assert normalize_formula_for_latex_math(r"\bf { g } { - } \vec { C } 3 N _ { 4 }") == r"g { - } C 3 N _ { 4 }"
