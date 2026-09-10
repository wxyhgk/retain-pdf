import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.core.ocr.models import TextItem
from retainpdf_pipeline.translate.core.payload.formula_protection import formula_map_from_protected_map
from retainpdf_pipeline.translate.core.payload.formula_protection import protect_inline_content
from retainpdf_pipeline.translate.core.payload.formula_protection import protect_inline_formulas_in_segments
from retainpdf_pipeline.translate.core.payload.formula_protection import re_protect_restored_formulas
from retainpdf_pipeline.translate.core.payload.formula_protection import restore_protected_tokens
from retainpdf_pipeline.translate.core.payload.translations import export_translation_template


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


def test_formula_map_can_be_recovered_from_protected_map() -> None:
    protected_map = [
        {
            "token_tag": "<f1-8f1/>",
            "token_type": "formula",
            "restore_text": "Q _ { t }",
        }
    ]
    formula_map = formula_map_from_protected_map(protected_map)
    assert formula_map == [{"placeholder": "<f1-8f1/>", "token_tag": "<f1-8f1/>", "formula_text": "Q _ { t }"}]


def test_formula_protection_skips_standalone_greek_and_short_bond_tokens() -> None:
    protected_text, protected_map = protect_inline_content(
        r"The analogous structure for metal hydride \beta-diketonate 30 would involve \mathrm { C - H } tautomer and \mathrm { O - H } tautomer."
    )

    assert r"\beta" in protected_text
    assert r"\mathrm { C - H }" in protected_text
    assert r"\mathrm { O - H }" in protected_text
    assert formula_map_from_protected_map(protected_map) == []


def test_formula_protection_skips_citationish_pseudo_formula_runs() -> None:
    protected_text, protected_map = protect_inline_content(
        r"Only Herzon has 2 \mathrm { e } , \mathrm { f } , 3 \mathrm { e } , 4 \mathrm { a } , 6 \mathrm { b } explored the pathway."
    )

    assert "<f" not in protected_text
    assert formula_map_from_protected_map(protected_map) == []


def test_segment_formula_protection_skips_pseudo_inline_equations() -> None:
    protected_text, formula_map, protected_map = protect_inline_formulas_in_segments(
        [
            {"type": "text", "content": "Only Herzon has"},
            {"type": "inline_equation", "content": r"2 \mathrm { e } , \mathrm { f } , 3 \mathrm { e } , 4 \mathrm { a }"},
            {"type": "text", "content": "explored the pathway."},
        ]
    )

    assert "<f" not in protected_text
    assert formula_map == []
    assert protected_map == []


def test_segment_formula_protection_degrades_merged_left_fragment_to_plain_text() -> None:
    protected_text, formula_map, protected_map = protect_inline_formulas_in_segments(
        [
            {"type": "text", "content": "converted to"},
            {"type": "text", "content": "Ph(i-"},
            {"type": "inline_equation", "content": r"\mathrm { P r O } ) _ { 2 } S _ { \mathrm { i } } ^ { \mathrm { i } } \mathrm { H }"},
            {"type": "text", "content": "(11), traces of"},
        ]
    )

    assert protected_text == (
        r"converted to Ph(i- \mathrm { P r O } ) _ { 2 } S _ { \mathrm { i } } ^ { \mathrm { i } } \mathrm { H } (11), traces of"
    )
    assert formula_map == []
    assert protected_map == []


def test_segment_formula_protection_keeps_left_right_latex_structures_protected() -> None:
    protected_text, formula_map, _ = protect_inline_formulas_in_segments(
        [
            {"type": "text", "content": "The dimer was observed as"},
            {
                "type": "inline_equation",
                "content": r"\left( \mathrm { P h } \left( i \mathrm { - } \mathrm { P r O } \right) _ { 2 } \mathrm { S i } \right) _ { 2 } \mathrm { O }",
            },
            {"type": "text", "content": "in solution."},
        ]
    )

    assert protected_text.startswith("The dimer was observed as <f1-")
    assert protected_text.endswith("/> in solution.")
    assert len(formula_map) == 1
    assert r"\left( \mathrm { P h }" in formula_map[0]["formula_text"]


def test_export_translation_template_direct_typst_keeps_raw_source_text() -> None:
    item = TextItem(
        item_id="p001-b001",
        page_idx=0,
        block_idx=0,
        block_type="text",
        bbox=[0.0, 0.0, 100.0, 20.0],
        text=r"鉴于上述考量，CBFZ(\mathrm{CaO}_2) 被用于实验。",
        segments=[
            {"type": "text", "content": "鉴于上述考量，CBFZ"},
            {"type": "inline_equation", "content": r"(\mathrm{CaO}_2)"},
            {"type": "text", "content": " 被用于实验。"},
        ],
        lines=[],
        metadata={"structure_role": "body"},
    )
    from tempfile import TemporaryDirectory
    import json

    with TemporaryDirectory() as tmp:
        path = Path(tmp) / "page-001-deepseek.json"
        export_translation_template([item], path, page_idx=0, math_mode="direct_typst")
        payload = json.loads(path.read_text(encoding="utf-8"))

    assert payload[0]["math_mode"] == "direct_typst"
    assert payload[0]["protected_source_text"] == item.text
    assert payload[0]["formula_map"] == []
    assert payload[0]["translation_unit_formula_map"] == []
