import sys
import tempfile
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


def test_direct_typst_inline_math_internal_newline_is_folded_before_rendering() -> None:
    markdown = build_direct_typst_passthrough_text(
        "对于较大的 $ CN_{A}^{\\prime}\n$ 值，该 d 能级降低。"
    )

    assert "$CN_{A}^{\\prime}$" in markdown
    assert "$ CN_{A}^{\\prime}\n$" not in markdown
    assert "\n$" not in markdown


def test_direct_typst_keeps_short_latex_text_tags_inside_math() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"其中 $ W_l^{\text{pre}}, W_l^{\text{post}} \in \mathbb{R}^{n_{\text{hc}} d \times n_{\text{hc}}} $ 是参数。"
    )

    assert r"W_l^{\text{pre}}" in markdown
    assert r"W_l^{$ pre $}" not in markdown
    assert r"n_{$ hc $}" not in markdown


def test_direct_typst_renders_hbar_as_unicode_symbol_for_mitex() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"振动常数 $ \omega_e = \hbar \sqrt{k / \mu} $ 等间距分布。"
    )

    assert "ℏ" in markdown
    assert r"\hbar" not in markdown
    assert " hbar " not in markdown


def test_direct_typst_renders_partial_as_unicode_symbol_for_mitex() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"曲率 $ k=\left(\frac{\partial^{2}U}{\partial R^{2}}\right) $。"
    )

    assert "∂" in markdown
    assert r"\partial" not in markdown


def test_direct_typst_renders_otimes_as_unicode_symbol_for_mitex() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"选择规则 $ \Gamma_i \otimes \Gamma_f \ni \Gamma_\mu $。"
    )

    assert "⊗" in markdown
    assert r"\otimes" not in markdown


def test_direct_typst_normalizes_left_right_angle_ket_for_mitex() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"将单激发行列式与 $ \left|\Psi_0\right\rangle $ 混合。"
    )

    assert r"\left" not in markdown
    assert r"\right" not in markdown
    assert r"$|\Psi_0⟩$" in markdown


def test_direct_typst_normalizes_left_right_bra_matrix_for_mitex() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"非对角元满足 $ \left\langle\chi_i\right|f|\chi_j\rangle=0 $。"
    )

    assert r"\left" not in markdown
    assert r"\right" not in markdown
    assert r"$⟨\chi_i|f|\chi_j⟩=0$" in markdown


def test_direct_typst_normalizes_nested_left_right_matrix_element_for_mitex() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"矩阵元 $ \left\langle\Psi_a^{rs}\right|\mathcal{H}\left|\Psi_{ab}^{rs}\right\rangle $。"
    )

    assert r"\left" not in markdown
    assert r"\right" not in markdown
    assert r"$⟨\Psi_a^{rs}|\mathcal{H}|\Psi_{ab}^{rs}⟩$" in markdown


def test_direct_typst_does_not_inject_empty_base_for_prefix_scripts() -> None:
    """Prefix-script empty bases are translation's job, not render-time regex."""
    markdown = build_direct_typst_passthrough_text(
        r"能量为 $ ^{N}E_0 = \langle ^{N}\Psi_0 | \mathcal{H} | ^{N}\Psi_0 \rangle $。"
    )

    assert r"\{}^{" not in markdown
    assert "⟨" in markdown and "⟩" in markdown
    assert r"^{N}\Psi_0" in markdown


def test_direct_typst_preserves_backslash_space_before_degree_mathrm() -> None:
    r"""LaTeX backslash-space before ^{\circ} must not become \{}^{\circ}."""
    markdown = build_direct_typst_passthrough_text(
        r"反应在 $-78\ ^{\circ}\mathrm{C}$ 至室温下进行。"
    )

    assert r"-78\{}^{\circ}" not in markdown
    assert r"\{}^{" not in markdown
    assert r"^{\circ}\mathrm{C}" in markdown
    assert r"\ ^{\circ}\mathrm{C}" in markdown


def test_body_rendering_folds_model_visual_line_breaks_for_flow_text() -> None:
    item = {
        "item_id": "p005-b025",
        "semantic_role": "body",
        "structure_role": "body",
        "text_flow": "preserve_lines",
    }
    translated = "对于较大的 $ CN_{A}^{\\prime}\n$ 值，该 d 能级能量降低。"

    rendered = maybe_preserve_structured_line_breaks(item, translated)

    assert "\n" not in rendered
    assert rendered == "对于较大的 $ CN_{A}^{\\prime} $ 值，该 d 能级能量降低。"
    assert "_render_preserve_line_breaks" not in item
