import sys
from pathlib import Path
import pytest

REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from services.rendering.layout.inline_content.core.markdown import build_markdown_from_direct_text
from services.rendering.layout.inline_content.core.markdown import build_direct_typst_passthrough_text
from services.rendering.layout.inline_content.core.markdown import promote_inline_math_like_text
from services.rendering.layout.inline_content.fallback.placeholder_markdown import build_markdown_from_parts
from services.rendering.layout.inline_content.fallback.placeholder_markdown import formula_map_lookup
from services.rendering.layout.inline_content.fallback.placeholder_markdown import split_protected_text
from services.rendering.layout.inline_content.core.inline_math import build_direct_typst_passthrough_markdown
from services.rendering.layout.inline_content.core.inline_math import sanitize_direct_typst_inline_math
from services.rendering.layout.inline_content.mode_router import build_item_render_markdown
from services.rendering.layout.inline_content.mode_router import build_render_markdown
from services.rendering.layout.inline_content.mode_router import is_direct_typst_math_mode
from services.rendering.layout.inline_content.mode_router import item_render_math_mode
from services.rendering.layout.inline_content.fallback.latex_normalizer import normalize_formula_for_latex_math
from services.rendering.layout.inline_content.fallback.png_renderer import convert_latexish_to_typst
from services.rendering.layout.inline_content.fallback.png_renderer import compile_formula_png
from services.rendering.layout.inline_content.fallback.png_renderer import convert_latexish_to_typst
from services.translation.payload.translations import export_translation_template
from services.translation.payload.formula_protection import formula_map_from_protected_map
from services.translation.payload.formula_protection import protect_inline_content
from services.translation.payload.formula_protection import protect_inline_formulas
from services.translation.payload.formula_protection import protect_inline_formulas_in_segments
from services.translation.payload.formula_protection import re_protect_restored_formulas
from services.translation.payload.formula_protection import restore_protected_tokens
from services.translation.ocr.models import TextItem


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


def test_typst_markdown_supports_direct_math_text_without_formula_map() -> None:
    markdown = build_markdown_from_direct_text(r"转移矩阵Q_t表明，且x_t∈{0,1}^K。")
    assert "$Q_t$" in markdown
    assert "$x_t$" in markdown


def test_render_markdown_defaults_to_placeholder_mode() -> None:
    assert item_render_math_mode({}) == "placeholder"
    assert not is_direct_typst_math_mode({})


def test_render_markdown_uses_direct_typst_path_for_item() -> None:
    item = {"math_mode": "direct_typst"}
    markdown = build_item_render_markdown(item, r"积分$\int f(x) dx$值", [])
    assert markdown == r"积分 $\int f(x) dx$ 值"


def test_direct_typst_render_markdown_normalizes_latex_cite_commands() -> None:
    item = {"math_mode": "direct_typst"}
    markdown = build_item_render_markdown(
        item,
        r"ACONF\cite{124}、PCONF21\cite{117,126,127} 和 GMTKN55 \citep{117}",
        [],
    )
    assert r"\cite" not in markdown
    assert r"\citep" not in markdown
    assert "ACONF¹²⁴" in markdown
    assert "PCONF21¹¹⁷,¹²⁶,¹²⁷" in markdown
    assert "GMTKN55 ¹¹⁷" in markdown


def test_render_markdown_uses_formula_map_for_placeholder_mode() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"\pi"}]
    markdown = build_render_markdown("你好<f1-17a/>，下一步", formula_map, math_mode="placeholder")
    assert markdown == r"你好 $\pi$，下一步"


def test_placeholder_boundary_helpers_preserve_token_splitting_and_lookup() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"\pi"}]
    assert formula_map_lookup(formula_map) == {"<f1-17a/>": r"\pi"}
    assert split_protected_text("你好<f1-17a/>，下一步") == ["你好", "<f1-17a/>", "，下一步"]


def test_typst_markdown_direct_typst_conservative_mode_does_not_guess_plain_scripts() -> None:
    markdown = build_markdown_from_direct_text(
        r"转移矩阵Q_t表明，且x_t∈{0,1}^K。",
        aggressive_math_promotion=False,
    )
    assert "$Q_t$" not in markdown
    assert "$x_t$" not in markdown
    assert "Q_t" in markdown
    assert "x_t" in markdown


def test_typst_markdown_direct_typst_conservative_mode_keeps_raw_latex_text() -> None:
    markdown = build_markdown_from_direct_text(
        r"离子为 \left[ NTf _ { 2 } \right] ，并形成 \mathrm { Co(IV) } 物种。",
        aggressive_math_promotion=False,
    )
    assert r"$\left[" not in markdown
    assert r"$\mathrm" not in markdown
    assert r"\left[ NTf _ { 2 } \right]" in markdown
    assert "Co(IV)" in markdown


def test_typst_markdown_direct_text_normalizes_latex_cite_before_math_promotion() -> None:
    markdown = build_markdown_from_direct_text(
        r"集合 ACONF\cite{124} 和 PCONF21\cite{117,126,127}。",
    )
    assert r"\cite" not in markdown
    assert "$\\cite" not in markdown
    assert "ACONF¹²⁴" in markdown
    assert "PCONF21¹¹⁷,¹²⁶,¹²⁷" in markdown


def test_typst_markdown_direct_typst_keeps_existing_inline_math_latex() -> None:
    markdown = build_markdown_from_direct_text(
        r"观察到 $\mathrm{Ph(i-PrO)SiH_2}$ (6) 的消耗速率快于其他硅烷。",
        aggressive_math_promotion=False,
        normalize_existing_inline_math=True,
    )
    assert r"$\mathrm{Ph(i-PrO)SiH_2}$" in markdown


def test_typst_markdown_direct_typst_keeps_existing_left_right_inline_math_latex() -> None:
    markdown = build_markdown_from_direct_text(
        r"形成了 $\left(\mathrm{Ph}\left(i-\mathrm{PrO}\right)_2\mathrm{Si}\right)_2\mathrm{O}$ 物种。",
        aggressive_math_promotion=False,
        normalize_existing_inline_math=True,
    )
    assert r"\left" in markdown
    assert r"\right" in markdown
    assert "$" in markdown


def test_typst_markdown_escapes_literal_double_asterisk_in_plain_text() -> None:
    markdown = build_markdown_from_direct_text(
        r"使用 6-310** 基组及其对应优化几何结构计算。",
        aggressive_math_promotion=False,
    )
    assert r"6-310\*\*" in markdown


def test_direct_typst_passthrough_escapes_literal_double_asterisk_outside_math() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"使用 6-310** 基组，并保留 $E=mc^2$ 不变。"
    )
    assert r"6-310\*\*" in markdown
    assert r"$E=mc^2$" in markdown


def test_direct_typst_passthrough_preserves_markdown_italic_outside_math() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"源自德语 *Farbe*，并保留 $C_{3\nu}$ 不变。"
    )
    assert r"*Farbe*" in markdown
    assert r"\*Farbe\*" not in markdown
    assert r"$C_{3\nu}$" in markdown


def test_build_markdown_from_parts_direct_typst_passthrough() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"观察到 $\mathrm{Ph(i-PrO)SiH_2}$ (6) 的消耗速率快于其他硅烷。"
    )
    assert markdown == r"观察到 $\mathrm{Ph(i-PrO)SiH_2}$ (6) 的消耗速率快于其他硅烷。"


def test_typst_markdown_keeps_spaces_around_inline_math() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"\pi"}]
    markdown = build_markdown_from_parts("你好<f1-17a/>，下一步", formula_map)
    assert markdown == r"你好 $\pi$，下一步"


def test_typst_markdown_adds_spaces_between_cjk_text_and_inline_math() -> None:
    markdown = build_direct_typst_passthrough_text(r"积分$\int f(x) dx$值")
    assert markdown == r"积分 $\int f(x) dx$ 值"


def test_direct_typst_passthrough_keeps_existing_inline_math_latex_shape() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"$ \mathbf{f}_{\alpha}^{IJ}(\mathbf{R}) $ 是理解单态 Born-Oppenheimer 近似局限性的关键。"
    )
    assert markdown.startswith(r"$\mathbf{f}_{\alpha}^{IJ}(\mathbf{R})$ 是理解")


def test_direct_typst_passthrough_separates_adjacent_inline_math_blocks() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"该阻尼函数相关。$^{86}$$a_{n}$ 是调整后的全局参数。"
    )
    assert r"$^{86}$ $a_{n}$ 是调整后的全局参数。" in markdown
    assert "$$a" not in markdown


def test_direct_typst_passthrough_wraps_parenthesized_inline_math_boundary() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"而 $R_{0}^{AB} = 0.5$ ($R_{0}^{A'} + R_{0}^{B'}$) 决定阻尼。"
    )
    assert r"而 $R_{0}^{AB} = 0.5$ $(R_{0}^{A'} + R_{0}^{B'})$ 决定阻尼。" == markdown


def test_direct_typst_passthrough_does_not_wrap_cjk_parenthesized_inline_math() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"$ w_j $ 是积分权重，由网格点 $j$（$ j \in [1, 23] $）之间的梯形分割得到。"
    )
    assert r"$j$$（" not in markdown
    assert r"$w_j$ 是积分权重，由网格点 $j$（$j \in [1, 23]$）之间的梯形分割得到。" == markdown


def test_direct_typst_passthrough_normalizes_display_math_delimiters() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"$$ \delta E _{ \mathrm{c} }^{ \mathrm{MP2} }/ \delta\phi_{k}^{\dagger}(\boldsymbol{r}) $$ 的衰减速度"
    )
    assert "$ $" not in markdown
    assert r"$\delta E _{ \mathrm{c} }^{ \mathrm{MP2} } / \delta\phi_{k}^{\dagger}(\boldsymbol{r})$ 的衰减速度" == markdown


def test_convert_latexish_to_typst_splits_attached_angle_command() -> None:
    assert convert_latexish_to_typst(r"\angleCSH") == "angle CSH"


def test_direct_typst_passthrough_rewrites_mathscr_for_mitex_compatibility() -> None:
    markdown = build_direct_typst_passthrough_text(r"$\mathscr{P}$ 空间")
    assert markdown == r"$\mathcal{P}$ 空间"


def test_direct_typst_sanitizer_keeps_only_inline_math_compat_cleanup() -> None:
    markdown = sanitize_direct_typst_inline_math(r"正文 $\mathscr{P}$ 与 $\angleABC$ 保持")
    assert markdown == r"正文 $\mathcal{P}$ 与 $\angle ABC$ 保持"


def test_direct_typst_sanitizer_normalizes_double_backslash_math_commands() -> None:
    markdown = sanitize_direct_typst_inline_math(r"浓度 $2.5~\\mu\\text{g}~\\text{ml}^{-1}$ 保持")
    assert markdown == r"浓度 $2.5~\mu\text{g}~\text{ml}^{-1}$ 保持"


def test_direct_typst_sanitizer_rewrites_unsupported_circled_command() -> None:
    markdown = sanitize_direct_typst_inline_math(r"路径 $\circled{\times}$ 与 $\circled{A}$ 保持")
    assert markdown == r"路径 $\otimes$ 与 $A$ 保持"


def test_direct_typst_boundary_module_matches_legacy_passthrough_behavior() -> None:
    text = r"使用 6-310** 基组，并保留 $E=mc^2$ 与 $\mathscr{P}$ 不变。"
    assert build_direct_typst_passthrough_markdown(text) == build_direct_typst_passthrough_text(text)


def test_typst_markdown_renders_superscript_citation_as_text() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"^{6c}"}]
    markdown = build_markdown_from_parts("方法<f1-17a/>促使", formula_map)
    assert markdown == "方法⁶ᶜ促使"


def test_typst_markdown_compacts_bracket_citation_text() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"[35, 36]"}]
    markdown = build_markdown_from_parts("见<f1-17a/>下一步", formula_map)
    assert markdown == "见[35,36]下一步"


def test_typst_markdown_promotes_bare_superscript_citation() -> None:
    markdown = build_markdown_from_parts("Herzon课题组也使用了该条件。^{18}", [])
    assert markdown.endswith("$^{18}$")


def test_typst_markdown_promotes_bare_scripted_chemical_formula() -> None:
    markdown = build_markdown_from_parts("Co(III)(Sal^{tBu,tBu})(i - Pr) (4) 与中间体反应。", [])
    expected = normalize_formula_for_latex_math("Co(III)(Sal^{tBu,tBu})(i - Pr)")
    assert f"${expected}$" in markdown
    assert "(4) 与中间体反应。" in markdown


def test_typst_markdown_repairs_double_slash_latex_command_outside_math() -> None:
    markdown = build_markdown_from_parts(r"$\mathrm{Ni(II)}$-芳基/ \\mathrm{Co(IV)} -烷基", [])
    assert r"$\mathrm{Ni(II)}$" in markdown
    assert r"$\mathrm{Co(IV)}$" in markdown


def test_typst_markdown_promotes_left_right_bracket_formula() -> None:
    markdown = build_markdown_from_parts(r"离子为 \left[ NTf _ { 2 } \right] 和配体。", [])
    assert r"$\left[ NTf" in markdown
    assert r"\right]$" in markdown


def test_typst_markdown_promotes_bracketed_ion_pair() -> None:
    markdown = build_markdown_from_parts(r"溶剂使用 [BMM][PF6] 体系。", [])
    assert r"$[BMM][PF6]$" in markdown


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


def test_typst_formula_compilation_handles_prime_and_mathcal_scripts() -> None:
    for formula in (
        r"\alpha _ { t } ^ { \prime }",
        r"\frac { - \alpha _ { t } ^ { \prime } } { 1 - \alpha _ { t } }",
        r"\mathbf { \Delta } _ { \mathbf { \mathcal { X } } _ { t } }",
    ):
        path, size = compile_formula_png(formula)
        assert path.exists()
        assert size[0] > 0 and size[1] > 0


def test_promote_inline_math_like_text_for_garbled_reconstruction_blocks() -> None:
    text = (
        "转移矩阵Q_t表明，以概率1-β_t，x_t保持不变；"
        "每个条目[Q_t]_ij表示从状态i到j的转移概率，且x_t∈{0,1}^K。"
    )
    markdown = promote_inline_math_like_text(text)
    assert "$Q_t$" in markdown
    assert "$1-β_t$" in markdown
    assert "$x_t$" in markdown
    assert "$[Q_t]_{ij}$" in markdown


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
