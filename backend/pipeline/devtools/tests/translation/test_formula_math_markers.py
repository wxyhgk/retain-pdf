import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.render.layout.inline_content.core.markdown import build_markdown_from_direct_text
from retainpdf_pipeline.render.layout.inline_content.core.markdown import build_direct_typst_passthrough_text
from retainpdf_pipeline.render.layout.inline_content.fallback.placeholder_markdown import build_markdown_from_parts
from retainpdf_pipeline.render.layout.inline_content.fallback.placeholder_markdown import formula_map_lookup
from retainpdf_pipeline.render.layout.inline_content.fallback.placeholder_markdown import split_protected_text
from retainpdf_pipeline.render.layout.inline_content.fallback.png_renderer import convert_latexish_to_typst
from retainpdf_pipeline.render.layout.inline_content.core.inline_math import build_direct_typst_passthrough_markdown
from retainpdf_pipeline.render.layout.inline_content.core.inline_math import sanitize_direct_typst_inline_math
from retainpdf_pipeline.render.layout.inline_content.mode_router import build_item_render_markdown
from retainpdf_pipeline.render.layout.inline_content.mode_router import build_render_markdown
from retainpdf_pipeline.render.layout.inline_content.mode_router import is_direct_typst_math_mode
from retainpdf_pipeline.render.layout.inline_content.mode_router import item_render_math_mode


def test_typst_markdown_supports_typed_formula_placeholders() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"(\mathrm{CaO}_2)"}]
    markdown = build_markdown_from_parts("过氧化钙<f1-17a/>释放", formula_map)
    assert markdown == r"过氧化钙 $(\mathrm{CaO}_2)$ 释放"


def test_typst_markdown_supports_direct_math_text_without_formula_map() -> None:
    markdown = build_markdown_from_direct_text(r"转移矩阵Q_t表明，且x_t∈{0,1}^K。")
    assert markdown == r"转移矩阵Q_t表明，且x_t∈{0,1}^K。"


def test_render_markdown_defaults_to_placeholder_mode() -> None:
    assert item_render_math_mode({}) == "placeholder"
    assert not is_direct_typst_math_mode({})


def test_render_markdown_uses_direct_typst_path_for_item() -> None:
    item = {"math_mode": "direct_typst"}
    markdown = build_item_render_markdown(item, r"积分$\int f(x) dx$值", [])
    assert markdown == r"积分 $\int f(x) dx$ 值"


def test_direct_typst_render_markdown_does_not_rewrite_latex_cite_commands() -> None:
    item = {"math_mode": "direct_typst"}
    markdown = build_item_render_markdown(
        item,
        r"ACONF\cite{124}、PCONF21\cite{117,126,127} 和 GMTKN55 \citep{117}",
        [],
    )
    assert r"ACONF\cite{124}" in markdown
    assert r"PCONF21\cite{117,126,127}" in markdown
    assert r"GMTKN55 \citep{117}" in markdown


def test_render_markdown_uses_formula_map_for_placeholder_mode() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"\pi"}]
    markdown = build_render_markdown("你好<f1-17a/>，下一步", formula_map, math_mode="placeholder")
    assert markdown == r"你好 $\pi$，下一步"


def test_placeholder_boundary_helpers_preserve_token_splitting_and_lookup() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"\pi"}]
    assert formula_map_lookup(formula_map) == {"<f1-17a/>": r"\pi"}
    assert split_protected_text("你好<f1-17a/>，下一步") == ["你好", "<f1-17a/>", "，下一步"]


def test_typst_markdown_direct_typst_conservative_mode_does_not_guess_plain_scripts() -> None:
    markdown = build_markdown_from_direct_text(r"转移矩阵Q_t表明，且x_t∈{0,1}^K。")
    assert "$Q_t$" not in markdown
    assert "$x_t$" not in markdown
    assert "Q_t" in markdown
    assert "x_t" in markdown


def test_typst_markdown_direct_typst_conservative_mode_keeps_raw_latex_text() -> None:
    markdown = build_markdown_from_direct_text(r"离子为 \left[ NTf _ { 2 } \right] ，并形成 \mathrm { Co(IV) } 物种。")
    assert r"$\left[" not in markdown
    assert r"$\mathrm" not in markdown
    assert r"\left[ NTf _ { 2 } \right]" in markdown
    assert "Co(IV)" in markdown


def test_typst_markdown_direct_text_does_not_rewrite_latex_cite() -> None:
    markdown = build_markdown_from_direct_text(
        r"集合 ACONF\cite{124} 和 PCONF21\cite{117,126,127}。",
    )
    assert r"ACONF\cite{124}" in markdown
    assert r"PCONF21\cite{117,126,127}" in markdown
    assert "¹²⁴" not in markdown


def test_typst_markdown_direct_typst_keeps_existing_inline_math_latex() -> None:
    markdown = build_markdown_from_direct_text(
        r"观察到 $\mathrm{Ph(i-PrO)SiH_2}$ (6) 的消耗速率快于其他硅烷。",
        normalize_existing_inline_math=True,
    )
    assert r"$\mathrm{Ph(i-PrO)SiH_2}$" in markdown


def test_typst_markdown_direct_typst_keeps_existing_left_right_inline_math_latex() -> None:
    markdown = build_markdown_from_direct_text(
        r"形成了 $\left(\mathrm{Ph}\left(i-\mathrm{PrO}\right)_2\mathrm{Si}\right)_2\mathrm{O}$ 物种。",
        normalize_existing_inline_math=True,
    )
    assert r"\left" in markdown
    assert r"\right" in markdown
    assert "$" in markdown


def test_direct_typst_passthrough_keeps_short_latex_text_subscripts_atomic() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"外势集合 ($v_{\text{ext}}, \mathbf{B}_{\text{ext}}$) 之间的映射。"
    )

    assert r"v_{\text{ext}}, \mathbf{B}_{\text{ext}}" in markdown
    assert r"$v_{$" not in markdown
    assert r"\mathbf{B}_{$" not in markdown


def test_direct_typst_passthrough_keeps_adjacent_short_latex_text_subscripts_atomic() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"势场组分别为$v_{\text{ext}}, A_{\text{ext}}$和$v_{\text{ext}}^{\prime}, A_{\text{ext}}^{\prime}$。"
    )

    assert r"$v_{\text{ext}}, A_{\text{ext}}$" in markdown
    assert r"$v_{\text{ext}}^{\prime}, A_{\text{ext}}^{\prime}$" in markdown
    assert r"$v_{$" not in markdown
    assert r"A_{$" not in markdown


def test_direct_typst_passthrough_does_not_demote_formula_text_blocks() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"其中 $x^{\text{this is intentionally long text inside math}} + y$ 保持模型输出。"
    )

    assert r"$x^{\text{this is intentionally long text inside math}} + y$" in markdown
    assert "intentionally long text inside math $" not in markdown


def test_typst_markdown_escapes_literal_double_asterisk_in_plain_text() -> None:
    markdown = build_markdown_from_direct_text(r"使用 6-310** 基组及其对应优化几何结构计算。")
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


def test_direct_typst_passthrough_normalizes_angle_expectation_for_mitex() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"其中 $ \langle S^{2}\rangle_{T_{1}} $ 和 $ \langle S^{2}\rangle_{BS} $ 分别是 $ T_{1} $ 态。"
    )

    assert r"$⟨S^{2}⟩_{T_{1}}$" in markdown
    assert r"$⟨S^{2}⟩_{BS}$" in markdown
    assert r"$T_{1}$" in markdown


def test_direct_typst_passthrough_normalizes_bare_angle_expectation_for_mitex() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"表1. $ \langle\Delta E_{ST}\rangle $（单位：eV）。"
    )

    assert r"$⟨\Delta E_{ST}⟩$" in markdown
    assert r"\langle" not in markdown
    assert r"\rangle" not in markdown


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


def test_direct_typst_sanitizer_rewrites_hbar_for_mitex_compatibility() -> None:
    markdown = sanitize_direct_typst_inline_math(r"动量算符 $-i\hbar d/dq_k$ 和 $i\hbar d/dp_j$。")
    assert markdown == "动量算符 $-iℏ d/dq_k$ 和 $iℏ d/dp_j$。"


def test_direct_typst_sanitizer_rewrites_partial_for_mitex_compatibility() -> None:
    markdown = sanitize_direct_typst_inline_math(r"导数 $\partial E/\partial N = \mu$ 保持。")
    assert markdown == r"导数 $∂ E/∂ N = \mu$ 保持。"


def test_direct_typst_sanitizer_rewrites_bra_ket_rangle_for_mitex_compatibility() -> None:
    markdown = sanitize_direct_typst_inline_math(r"态 $|k\rangle$ 与 $|0\rangle$ 保持。")
    assert markdown == r"态 $|k⟩$ 与 $|0⟩$ 保持。"


def test_direct_typst_sanitizer_rewrites_varphi_for_mitex_compatibility() -> None:
    # sanitizer 同时会剥掉 mitex 不支持的 \left/\right 尺寸修饰
    markdown = sanitize_direct_typst_inline_math(r"基态 $\left|\varPhi_{0}\right\rangle$ 保持。")
    assert markdown == r"基态 $|\Phi_{0}⟩$ 保持。"


def test_direct_typst_sanitizer_restores_spreadsheet_cell_pseudo_math() -> None:
    markdown = sanitize_direct_typst_inline_math(r"目标框输入 $\C\107$，变量框输入 $\B\3$。")
    assert markdown == "目标框输入 C107，变量框输入 B3。"


def test_direct_typst_boundary_module_matches_legacy_passthrough_behavior() -> None:
    text = r"使用 6-310** 基组，并保留 $E=mc^2$ 与 $\mathscr{P}$ 不变。"
    assert build_direct_typst_passthrough_markdown(text) == build_direct_typst_passthrough_text(text)


def test_typst_markdown_does_not_render_superscript_citation_as_unicode_text() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"^{6c}"}]
    markdown = build_markdown_from_parts("方法<f1-17a/>促使", formula_map)
    assert "⁶ᶜ" not in markdown
    assert "6c" in markdown


def test_typst_markdown_does_not_compact_bracket_citation_text() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"[35, 36]"}]
    markdown = build_markdown_from_parts("见<f1-17a/>下一步", formula_map)
    assert "[35" in markdown
    assert "36]" in markdown


def test_typst_markdown_does_not_promote_bare_superscript_citation_by_default() -> None:
    markdown = build_markdown_from_parts("Herzon课题组也使用了该条件。^{18}", [])
    assert markdown.endswith("。^{18}")


def test_typst_markdown_does_not_promote_bare_scripted_chemical_formula() -> None:
    text = "Co(III)(Sal^{tBu,tBu})(i - Pr) (4) 与中间体反应。"
    markdown = build_markdown_from_direct_text(text)
    assert markdown == text


def test_typst_markdown_does_not_promote_double_slash_latex_command_outside_math() -> None:
    markdown = build_markdown_from_direct_text(r"$\mathrm{Ni(II)}$-芳基/ \\mathrm{Co(IV)} -烷基")
    assert r"$\mathrm{Ni(II)}$" in markdown
    assert r"\\mathrm{Co(IV)}" in markdown
    assert r"$\mathrm{Co(IV)}$" not in markdown


def test_typst_markdown_does_not_promote_left_right_bracket_formula() -> None:
    markdown = build_markdown_from_direct_text(r"离子为 \left[ NTf _ { 2 } \right] 和配体。")
    assert r"$\left[ NTf" not in markdown
    assert r"\left[ NTf _ { 2 } \right]" in markdown


def test_typst_markdown_does_not_promote_bracketed_ion_pair() -> None:
    markdown = build_markdown_from_direct_text(r"溶剂使用 [BMM][PF6] 体系。")
    assert markdown == r"溶剂使用 [BMM][PF6] 体系。"
