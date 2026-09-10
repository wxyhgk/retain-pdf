import sys
import tempfile
import time
from pathlib import Path
from unittest import mock
import re

import fitz
import pytest
from PIL import Image


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.render.source.background.stage import build_clean_background_pdf
from retainpdf_pipeline.foundation.config import fonts
from retainpdf_pipeline.render.layout.payload.blocks import build_render_blocks
from retainpdf_pipeline.render.layout.payload.body_pipeline import apply_body_payload_pipeline
from retainpdf_pipeline.render.layout.payload.collision import mark_adjacent_collision_risk
from retainpdf_pipeline.render.layout.payload.emit import payload_to_render_block
from retainpdf_pipeline.render.layout.payload.first_line_indent import detect_first_line_indent_pt
from retainpdf_pipeline.render.layout.payload.line_structure import maybe_preserve_structured_line_breaks
from retainpdf_pipeline.render.layout.model.models import RenderLayoutBlock
from retainpdf_pipeline.render.layout.model.models import RenderPageSpec
from retainpdf_pipeline.render.layout.page_specs import build_render_page_specs
from retainpdf_pipeline.render.layout.payload.continuation_split import split_protected_text_for_boxes
from retainpdf_pipeline.render.layout.payload.prepare import prepare_render_payloads_by_page
from retainpdf_pipeline.render.source.items import get_item_translated_text
from retainpdf_pipeline.render.source.dev_overlay.text_draw import _build_direct_draw_tokens
from retainpdf_pipeline.render.source.dev_overlay.text_draw import _fit_segment_layout
from retainpdf_pipeline.render.layout.payload.suspicious_ocr import detect_and_drop_suspicious_ocr_glued_blocks
from retainpdf_pipeline.render.output.typst.book_renderer import _compile_render_pages_pdf_resilient
from retainpdf_pipeline.render.output.typst.block_renderer import build_typst_block
from retainpdf_pipeline.render.output.typst.overlay_ops import overlay_translated_pages_on_doc
from retainpdf_pipeline.render.output.typst.book_support import prepare_translated_pages_for_render
from retainpdf_pipeline.render.output.typst.compiler import _resolved_font_paths
from retainpdf_pipeline.render.output.typst.compiler import _resolved_common_root
from retainpdf_pipeline.render.output.typst.compiler import TypstCompileError
from retainpdf_pipeline.render.output.typst.compiler import compile_typst_book_background_pdf
from retainpdf_pipeline.render.output.typst.compiler import compile_typst_overlay_pdf
from retainpdf_pipeline.render.output.typst.compiler import compile_typst_render_pages_pdf
from retainpdf_pipeline.render.output.typst.emitter import build_typst_source_from_page_specs
from retainpdf_pipeline.render.output.typst.source_builder import build_typst_overlay_source
from retainpdf_pipeline.render.policy import apply_render_page_policy_fields
from retainpdf_pipeline.render.policy import build_render_page_policy
from retainpdf_pipeline.render.policy import formula_neighbor_text_item_ids
from retainpdf_pipeline.render.policy import item_render_policy
from retainpdf_pipeline.render.policy import item_render_policy_reason
from retainpdf_pipeline.render.policy import item_requires_visual_cover_only
from retainpdf_pipeline.render.policy import item_uses_white_overlay_fill
from retainpdf_pipeline.render.policy import protect_formula_regions_in_redaction_items
from retainpdf_pipeline.render.output.typst.source_page_overlay import apply_source_page_overlay
from retainpdf_pipeline.render.output.typst.overlay_diagnostics import apply_redaction_diagnostics
from retainpdf_pipeline.render.output.typst.overlay_diagnostics import new_overlay_merge_diagnostics
from retainpdf_pipeline.render.source.background.redaction_items import redaction_items_from_layout_blocks
from retainpdf_pipeline.render.source.cleanup.item_rects import cover_rects_from_valid_items
from retainpdf_pipeline.render.output.typst.source_page_overlay import overlay_pages_from_single_pdf
from retainpdf_pipeline.render.output.typst.source_page_overlay import redaction_items_from_render_blocks
from retainpdf_pipeline.render.output.typst.sanitize import sanitize_items_for_typst_compile
from retainpdf_pipeline.render.output.typst.overlay_ops import _extract_failed_overlay_indices
from retainpdf_pipeline.render.output.typst.overlay_ops import _can_use_pikepdf_book_overlay
from retainpdf_pipeline.render.workflow.cover_fallback import cover_fallback_page_indices
from retainpdf_pipeline.render.workflow.context import RenderExecutionContext
from retainpdf_pipeline.render.workflow.modes import _compress_final_pdf_if_needed
from retainpdf_pipeline.render.document.pikepdf_overlay import overlay_pdf_pages_with_pikepdf
from retainpdf_pipeline.render.document.pikepdf_overlay import overlay_page_pdfs_with_pikepdf
from retainpdf_pipeline.render.document.pikepdf_pages import extract_pages_with_pikepdf
from retainpdf_pipeline.render.layout.inline_content.core.markdown import build_direct_typst_passthrough_text
from devtools.tests.rendering_support.page_specs import sample_page_spec as _page_spec
from retainpdf_pipeline.render.layout.model.models import RenderBlock
from retainpdf_pipeline.render.layout.payload.formula_safety import formula_safety_insets_pt
from retainpdf_pipeline.render.layout.payload.formula_safety import has_long_inline_math_layout_risk


def test_text_heavy_inline_math_demotes_latex_text_to_plain_text() -> None:
    blocks = build_render_blocks(
        [
            {
                "item_id": "p020-b015",
                "page_idx": 19,
                "block_type": "text",
                "block_kind": "text",
                "normalized_sub_type": "body",
                "bbox": [50.988, 307.815, 386.912, 332.3],
                "source_text": (
                    r"$ (\nabla_i \equiv \nabla_{r_i}, \text{with } \mathbf{r}_i "
                    r"\text{ denoting the position of electron } i), \text{ the interaction between electrons "
                    r"and nuclei (with charges } Z_\alpha e, e = |e|), $"
                ),
                "protected_translated_text": (
                    r"$ (\nabla_i \equiv \nabla_{r_i}, \text{其中 } \mathbf{r}_i "
                    r"\text{ 表示电子 } i \text{ 的位置}), \text{电子与原子核（带有电荷 } "
                    r"Z_\alpha e, e = |e|) \text{ 之间的相互作用}, $"
                ),
            }
        ],
        page_width=595.0,
        page_height=842.0,
    )

    markdown = blocks[0].markdown_text

    assert r"\text{其中" not in markdown
    assert "表示电子" in markdown


def test_dense_inline_math_paragraph_builds_render_blocks_without_backtracking() -> None:
    text = (
        r"其中 $\lambda_{\parallel}$ 和 $\lambda_{\perp}$ 分别表示层内和层间几何自旋-轨道耦合强度，"
        r"由 $\lambda = -\hbar^{2}/8mS$ 给出，其中 $S$ 为相邻位点间的弧长。"
        r"算符 $\Omega_{nl}^{\parallel}$ 和 $\Omega_{nl}^{\perp}$ 包含依赖于曲率的自旋-轨道场。"
        r"具体地，$\Omega_{n+1,l}^{\parallel} = \kappa_{n+1,l} \sigma_{n+1,l}^{\parallel}"
        r" = \kappa_{n+1,l} [(\sin \theta_n \cos \varphi_{nl} \sin \Psi_n"
        r" - \sin \varphi_{nl} \cos \Psi_n) \sigma_x +"
        r"(\sin \theta_n \sin \varphi_{nl} \sin \Psi_n + \cos \varphi_{nl} \cos \Psi_n)"
        r" \sigma_y + \cos \theta_n \sin \Psi_n \sigma_z]$。"
    )
    started = time.perf_counter()

    blocks = build_render_blocks(
        [
            {
                "item_id": "p003-b019",
                "page_idx": 2,
                "block_type": "text",
                "block_kind": "text",
                "normalized_sub_type": "body",
                "bbox": [304.0, 540.0, 553.0, 732.0],
                "source_text": text,
                "protected_source_text": text,
                "protected_translated_text": text,
            }
        ],
        page_width=595.0,
        page_height=842.0,
    )

    assert time.perf_counter() - started < 1.0
    assert len(blocks) == 1
    assert "自旋-轨道场" in blocks[0].markdown_text
    assert r"\sigma_x" in blocks[0].markdown_text


def test_direct_typst_adjacent_inline_math_boundaries_do_not_cross_text() -> None:
    from retainpdf_pipeline.render.layout.inline_content.core.markdown import build_direct_typst_passthrough_text
    from retainpdf_pipeline.render.layout.text_analysis import analyze_text

    text = (
        r"根据Stewart的高斯展开，$^{70}$$ \phi_{\kappa} $指的是收缩型高斯原子轨道，"
        r"用于近似指数为$ \zeta_{\kappa} $的球面斯莱特型轨道。"
    )

    markdown = build_direct_typst_passthrough_text(text)

    assert "$^{70}$" in markdown
    assert r"$\phi_{\kappa}$" in markdown
    assert r"$\zeta_{\kappa}$" in markdown
    assert "指的是收缩型高斯原子轨道" in markdown
    assert r"\$phi" not in markdown
    assert not any("指的是收缩型高斯原子轨道" in segment.value for segment in analyze_text(markdown).formula_segments)


def test_formula_safety_insets_reserve_more_bottom_space_for_subscripts() -> None:
    insets = formula_safety_insets_pt(
        "文字 $x_i$",
        [],
        font_size_pt=10.0,
        box_height_pt=20.0,
    )

    assert insets.bottom_pt > insets.top_pt
    assert insets.bottom_pt >= 1.0


def test_long_inline_chemical_formula_is_layout_risk() -> None:
    text = (
        r"例如，Zheng团队开发了巨型POM，"
        r"$[Sb_{15}Tb_{7}W_{3}O_{29}(OH)_{3}(DMF)(H_{2}O)_{6}(SbW_{8}O_{30})(SbW_{9}O_{33})_{5}]^{27-}$ "
        r"$[Sb_{21}Tb_{7}W_{56})$，具有优异的水溶性。"
    )

    assert has_long_inline_math_layout_risk(text, [], font_size_pt=11.0, box_width_pt=255.0)
    assert not has_long_inline_math_layout_risk("短公式 $x_i$ 正文", [], font_size_pt=11.0, box_width_pt=255.0)


def test_typst_block_adds_formula_safety_padding_without_shrinking_outer_fill() -> None:
    block = RenderBlock(
        block_id="b1",
        bbox=[10.0, 20.0, 180.0, 42.0],
        cover_bbox=[10.0, 20.0, 180.0, 42.0],
        inner_bbox=[10.0, 20.0, 180.0, 42.0],
        markdown_text="这是一段文字 $x_i$",
        plain_text="这是一段文字 xi",
        render_kind="markdown",
        font_size_pt=10.0,
        leading_em=0.55,
        fit_to_box=True,
        fit_min_font_size_pt=8.0,
        fit_min_leading_em=0.45,
        fit_max_height_pt=22.0,
        math_map=[],
        use_cover_fill=True,
    )

    typst = build_typst_block("formula_safety", block, include_fill=True)

    assert "height: 22.0pt" in typst
    assert "fill:" in typst
    assert "pad(top:" in typst
    assert "bottom:" in typst
    assert "fit_height: 22.0pt" not in typst


def test_typst_block_relaxes_justification_for_long_inline_math() -> None:
    formula = (
        r"$[Sb_{15}Tb_{7}W_{3}O_{29}(OH)_{3}(DMF)(H_{2}O)_{6}"
        r"(SbW_{8}O_{30})(SbW_{9}O_{33})_{5}]^{27-}$"
    )
    block = RenderBlock(
        block_id="b1",
        bbox=[34.0, 622.0, 290.0, 739.0],
        cover_bbox=[34.0, 622.0, 290.0, 739.0],
        inner_bbox=[34.0, 622.0, 290.0, 739.0],
        markdown_text=f"除了与特定生物分子相互作用外，巨型POM {formula} 具有优异的水溶性和稳定性。",
        plain_text="除了与特定生物分子相互作用外，巨型POM具有优异的水溶性和稳定性。",
        render_kind="markdown",
        font_size_pt=11.0,
        leading_em=0.58,
        fit_to_box=True,
        fit_min_font_size_pt=10.2,
        fit_min_leading_em=0.36,
        fit_max_height_pt=117.0,
        justify_text=True,
        math_map=[],
    )

    typst = build_typst_block("long_inline_formula", block, include_fill=True)

    assert "justify: false" in typst
    assert "min_size: 7.92pt" in typst
    assert "min_leading: 0.58em" in typst


def test_toc_entries_render_with_typst_style_rows() -> None:
    blocks = build_render_blocks(
        [
            {
                "item_id": "p010-b001",
                "page_idx": 9,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "toc",
                "semantic_role": "table_of_contents",
                "structure_role": "table_of_contents",
                "normalized_sub_type": "table_of_contents",
                "bbox": [100.0, 200.0, 780.0, 260.0],
                "text_flow": "preserve_lines",
                "source_text": "1 Introduction ..... 1\n2 Foundations of Density Functional Theory ..... 11",
                "protected_translated_text": "1 引言 ..... 1\n2 密度泛函理论基础 ..... 11",
                "source_line_texts": [
                    "1 Introduction ..... 1",
                    "2 Foundations of Density Functional Theory ..... 11",
                ],
                "lines": [
                    {"bbox": [100.0, 200.0, 780.0, 230.0], "spans": [{"content": "1 Introduction ..... 1"}]},
                    {"bbox": [100.0, 230.0, 780.0, 260.0], "spans": [{"content": "2 Foundations of Density Functional Theory ..... 11"}]},
                ],
                "toc_entries": [
                    {
                        "number": "1",
                        "title": "Introduction",
                        "page_label": "1",
                        "level": 1,
                        "line_index": 0,
                        "bbox": [200.0, 400.0, 1560.0, 460.0],
                    },
                    {
                        "number": "2",
                        "title": "Foundations of Density Functional Theory",
                        "page_label": "11",
                        "level": 1,
                        "line_index": 1,
                        "bbox": [200.0, 460.0, 1560.0, 520.0],
                    },
                ],
            }
        ],
        page_width=595.0,
        page_height=842.0,
    )

    typst = build_typst_block("rp9_item_p010_b001_0", blocks[0])

    assert "layout(size =>" in typst
    assert "measure(title-body)" in typst
    assert '"1 引言"' in typst
    assert '"2 密度泛函理论基础"' in typst
    assert "dash: (1pt, 2pt)" in typst
    assert '_toc_0_page = "1"' in typst
    assert '_toc_1_page = "11"' in typst
    assert "size.width - page-size.width" in typst
    assert "dy: 230.0pt" in typst
    assert "dx: 200.0pt" not in typst


def test_toc_line_fallback_uses_model_lines_without_content_rules() -> None:
    blocks = build_render_blocks(
        [
            {
                "item_id": "p005-b002",
                "page_idx": 4,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "toc",
                "semantic_role": "table_of_contents",
                "structure_role": "table_of_contents",
                "normalized_sub_type": "table_of_contents",
                "bbox": [75.5, 138.494, 384.0, 173.233],
                "text_flow": "preserve_lines",
                "source_text": "opaque source line A\nopaque source line B",
                "protected_translated_text": (
                    "图1.1 球极坐标下的类氢原子 22\n"
                    "表8.4 2-丁酮构象热力学性质 279"
                ),
                "source_line_texts": [
                    "opaque source line A",
                    "opaque source line B",
                ],
                "lines": [
                    {"bbox": [75.5, 138.494, 384.0, 155.864], "spans": [{"content": ""}]},
                    {"bbox": [75.5, 155.864, 384.0, 173.233], "spans": [{"content": ""}]},
                ],
                "toc_entries": [],
            }
        ],
        page_width=540.0,
        page_height=665.972,
    )

    block = blocks[0]
    typst = build_typst_block("rp4_item_p005_b002_0", block)

    assert block.toc_entries
    assert '_toc_0_page = "22"' in typst
    assert '_toc_1_page = "279"' in typst
    assert '"图1.1 球极坐标下的类氢原子"' in typst
    assert '"表8.4 2-丁酮构象热力学性质"' in typst
    assert "dash: (1pt, 2pt)" in typst
    assert "pdftr_fit_single_line_markdown" not in typst


def test_toc_entries_render_plain_page_number_lines_without_dot_leaders() -> None:
    blocks = build_render_blocks(
        [
            {
                "item_id": "p001-b006",
                "page_idx": 0,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "toc",
                "semantic_role": "table_of_contents",
                "structure_role": "table_of_contents",
                "normalized_sub_type": "table_of_contents",
                "bbox": [68.474, 416.052, 542.793, 659.518],
                "text_flow": "preserve_lines",
                "source_text": (
                    "1 Introduction 2\n"
                    "2 Sources of components for thermodynamic quantities 2\n"
                    "2.1 Contributions from translation ..... 3\n"
                    "3 Thermochemistry output from Gaussian 8\n"
                    "3.2 Output from compound model chemistries 11\n"
                    "5 Summary 17"
                ),
                "protected_translated_text": (
                    "1 引言 2\n"
                    "2 热力学量组分的来源 2\n"
                    "2.1 平动贡献 ..... 3\n"
                    "3 来自Gaussian的热化学输出 8\n"
                    "3.2 复合模型化学输出 11\n"
                    "5 总结 17"
                ),
                "source_line_texts": [
                    "1 Introduction 2",
                    "2 Sources of components for thermodynamic quantities 2",
                    "2.1 Contributions from translation ..... 3",
                    "3 Thermochemistry output from Gaussian 8",
                    "3.2 Output from compound model chemistries 11",
                    "5 Summary 17",
                ],
                "lines": [
                    {"bbox": [68.474, 416.052 + index * 17.39, 542.793, 433.442 + index * 17.39]}
                    for index in range(6)
                ],
                "toc_entries": [],
            }
        ],
        page_width=595.0,
        page_height=842.0,
    )

    block = blocks[0]
    typst = build_typst_block("rp0_item_p001_b006_0", block)

    assert len(block.toc_entries or []) == 6
    assert '"1 引言"' in typst
    assert '"2 热力学量组分的来源"' in typst
    assert '"3 来自Gaussian的热化学输出"' in typst
    assert '"5 总结"' in typst
    assert '_toc_0_page = "2"' in typst
    assert '_toc_3_page = "8"' in typst
    assert '_toc_5_page = "17"' in typst
    assert "dash: (1pt, 2pt)" in typst


def test_toc_entries_rebuild_partial_source_entries_before_rendering() -> None:
    blocks = build_render_blocks(
        [
            {
                "item_id": "p001-b006",
                "page_idx": 0,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "toc",
                "semantic_role": "table_of_contents",
                "structure_role": "table_of_contents",
                "normalized_sub_type": "table_of_contents",
                "bbox": [68.474, 416.052, 542.793, 520.394],
                "text_flow": "preserve_lines",
                "source_text": (
                    "1 Introduction 2\n"
                    "2 Sources of components for thermodynamic quantities 2\n"
                    "2.1 Contributions from translation ..... 3"
                ),
                "protected_translated_text": (
                    "1 引言 2\n"
                    "2 热力学量组分的来源 2\n"
                    "2.1 平动贡献 ..... 3"
                ),
                "source_line_texts": [
                    "1 Introduction 2",
                    "2 Sources of components for thermodynamic quantities 2",
                    "2.1 Contributions from translation ..... 3",
                ],
                "lines": [
                    {"bbox": [68.474, 416.052 + index * 17.39, 542.793, 433.442 + index * 17.39]}
                    for index in range(3)
                ],
                "toc_entries": [
                    {
                        "number": "2.1",
                        "title": "Contributions from translation",
                        "page_label": "3",
                        "level": 2,
                        "line_index": 2,
                        "bbox": [68.474, 450.832, 542.793, 468.222],
                    }
                ],
            }
        ],
        page_width=595.0,
        page_height=842.0,
    )

    block = blocks[0]
    typst = build_typst_block("rp0_item_p001_b006_0", block)

    assert len(block.toc_entries or []) == 3
    assert '"1 引言"' in typst
    assert '"2 热力学量组分的来源"' in typst
    assert '"2.1 平动贡献"' in typst
    assert '_toc_0_page = "2"' in typst
    assert '_toc_1_page = "2"' in typst
    assert '_toc_2_page = "3"' in typst


def test_toc_rendering_maps_two_column_translated_lines_by_geometry() -> None:
    blocks = build_render_blocks(
        [
            {
                "item_id": "p010-b002",
                "page_idx": 9,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "toc",
                "semantic_role": "table_of_contents",
                "structure_role": "table_of_contents",
                "normalized_sub_type": "table_of_contents",
                "bbox": [50.0, 100.0, 520.0, 160.0],
                "text_flow": "preserve_lines",
                "source_text": (
                    "1 Left first 1\n"
                    "4 Right first 4\n"
                    "2 Left second 2\n"
                    "5 Right second 5"
                ),
                "protected_translated_text": (
                    "1 左一 1\n"
                    "4 右一 4\n"
                    "2 左二 2\n"
                    "5 右二 5"
                ),
                "source_line_texts": [
                    "1 Left first 1",
                    "4 Right first 4",
                    "2 Left second 2",
                    "5 Right second 5",
                ],
                "lines": [
                    {"bbox": [50.0, 100.0, 240.0, 112.0]},
                    {"bbox": [300.0, 100.0, 520.0, 112.0]},
                    {"bbox": [50.0, 120.0, 240.0, 132.0]},
                    {"bbox": [300.0, 120.0, 520.0, 132.0]},
                ],
                "toc_entries": [],
            }
        ],
        page_width=595.0,
        page_height=842.0,
    )

    block = blocks[0]
    typst = build_typst_block("rp9_item_p010_b002_0", block)

    assert [entry.title for entry in block.toc_entries or []] == ["左一", "左二", "右一", "右二"]
    assert '_toc_0_page = "1"' in typst
    assert '_toc_1_page = "2"' in typst
    assert '_toc_2_page = "4"' in typst
    assert '_toc_3_page = "5"' in typst


def test_toc_entries_normalize_spaced_inline_math() -> None:
    blocks = build_render_blocks(
        [
            {
                "item_id": "p010-b001",
                "page_idx": 9,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "toc",
                "semantic_role": "table_of_contents",
                "structure_role": "table_of_contents",
                "normalized_sub_type": "table_of_contents",
                "bbox": [100.0, 200.0, 780.0, 230.0],
                "text_flow": "preserve_lines",
                "source_text": "4.2 Exact Representations of $ E_{xc}[n] $ ..... 115",
                "protected_translated_text": "4.2 $ E_{xc}[n] $ 的精确表示 ..... 115",
                "source_line_texts": ["4.2 Exact Representations of $ E_{xc}[n] $ ..... 115"],
                "lines": [
                    {
                        "bbox": [100.0, 200.0, 780.0, 230.0],
                        "spans": [{"content": "4.2 Exact Representations of $ E_{xc}[n] $ ..... 115"}],
                    },
                ],
                "toc_entries": [
                    {
                        "number": "4.2",
                        "title": "Exact Representations of $ E_{xc}[n] $",
                        "page_label": "115",
                        "level": 2,
                        "line_index": 0,
                        "bbox": [200.0, 400.0, 1560.0, 460.0],
                    },
                ],
            }
        ],
        page_width=595.0,
        page_height=842.0,
    )

    typst = build_typst_block("rp9_item_p010_b001_0", blocks[0])

    assert '"4.2 $E_{xc}[n]$ 的精确表示"' in typst
    assert '"4.2 $ E_{xc}[n] $ 的精确表示"' not in typst
