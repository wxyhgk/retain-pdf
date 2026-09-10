from __future__ import annotations

import sys
import tempfile
import json
from pathlib import Path
from unittest import mock

import fitz
import pikepdf
import pytest
from pikepdf import Name


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.render.source.preparation.redact_restore_formula import build_redact_restore_formula_pdf_copy
from retainpdf_pipeline.render.source_cleanup.pdf import document as source_cleanup_document
from retainpdf_pipeline.render.source_cleanup.pdf.hit_test import RectIndex
from retainpdf_pipeline.render.source_cleanup.pdf.hit_test import is_protected_text_op
from retainpdf_pipeline.render.source_cleanup.pdf import pdf_math
from retainpdf_pipeline.render.source_cleanup.pdf import text_ops
from retainpdf_pipeline.render.source_cleanup import build_bbox_text_stripped_pdf_copy
from retainpdf_pipeline.render.source_cleanup import strip_bbox_text_rects_from_pdf_copy
from retainpdf_pipeline.render.source.render_source import build_render_source_pdf
from retainpdf_pipeline.render.source.prewarm_manifest_io import bbox_candidates_from_manifest
from retainpdf_pipeline.render.source.prewarm_manifest_io import bbox_candidates_to_manifest
from retainpdf_pipeline.render.source_cleanup.types import BBoxTextStripCandidates
from retainpdf_pipeline.render.source_cleanup.planning.intent_classifier import classify_source_cleanup_intent
from retainpdf_pipeline.render.source_cleanup.planning import segments
from retainpdf_pipeline.render.analysis.document.builder import build_render_page_analysis
from retainpdf_pipeline.render.contracts import RenderDocumentAnalysis
from devtools.tests.rendering_support.page_profiles import sample_render_page_profile


def test_bbox_text_strip_segments_keep_inline_formula_sides_deletable() -> None:
    text_rect = fitz.Rect(10, 20, 210, 50)
    formula_rect = fitz.Rect(80, 22, 140, 48)

    split_segments = segments.strip_segments_for_text_rect(text_rect, [formula_rect])

    assert len(split_segments) == 2
    assert split_segments[0].x0 <= 10
    assert split_segments[0].x1 <= formula_rect.x0
    assert split_segments[1].x0 >= formula_rect.x1
    assert split_segments[1].x1 >= 210
    assert all((segment & formula_rect).is_empty for segment in split_segments)


def test_source_cleanup_intent_preserves_textual_formula_without_overlay() -> None:
    intent = classify_source_cleanup_intent(
        {
            "item_id": "p001-b001",
            "block_kind": "formula",
            "block_type": "formula",
            "source_text": r"$$ \mathrm{f=lateral friction for design speed} $$",
        }
    )

    assert intent.source_role == "textual_formula"
    assert intent.cleanup_action == "protect_source"


def test_source_cleanup_intent_strips_textual_formula_with_overlay() -> None:
    intent = classify_source_cleanup_intent(
        {
            "item_id": "p001-b001",
            "block_kind": "formula",
            "block_type": "formula",
            "source_text": r"$$ \mathrm{f=lateral friction for design speed} $$",
            "protected_translated_text": "f = 设计速度对应的侧向摩擦系数",
        }
    )

    assert intent.source_role == "textual_formula"
    assert intent.cleanup_action == "strip_text"


def test_source_cleanup_intent_classifies_math_formula_as_protect_source() -> None:
    intent = classify_source_cleanup_intent(
        {
            "item_id": "p001-b001",
            "block_kind": "formula",
            "block_type": "formula",
            "source_text": r"$$ E=mc^2 $$",
        }
    )

    assert intent.source_role == "math_formula"
    assert intent.cleanup_action == "protect_source"


def test_source_cleanup_intent_preserves_mixed_text_with_display_formula() -> None:
    intent = classify_source_cleanup_intent(
        {
            "item_id": "p001-b001",
            "block_kind": "text",
            "block_type": "text",
            "source_text": "body text\n$$ E=mc^2 $$",
            "protected_translated_text": "正文\n$$ E=mc^2 $$",
        }
    )

    assert intent.source_role == "mixed_math_text"
    assert intent.cleanup_action == "protect_source"


def test_source_cleanup_intent_keeps_inline_math_text_deletable() -> None:
    intent = classify_source_cleanup_intent(
        {
            "item_id": "p001-b001",
            "block_kind": "text",
            "block_type": "text",
            "source_text": "Method-2: rate $ Ls=2.7V^2/R $",
            "protected_translated_text": "方法2：变化率 $ Ls=2.7V^2/R $",
        }
    )

    assert intent.source_role == "body_text"
    assert intent.cleanup_action == "strip_text"


def test_source_cleanup_intent_strips_table_footnote_with_inline_math_markers() -> None:
    intent = classify_source_cleanup_intent(
        {
            "item_id": "p001-b001",
            "block_kind": "text",
            "block_type": "text",
            "layout_role": "footnote",
            "semantic_role": "metadata",
            "normalized_sub_type": "table_footnote",
            "source_text": "$ ^{a} $All calculations were performed with the def2-TZVP basis set. $ ^{54} $",
            "protected_translated_text": "$^{a}$所有计算均使用 def2-TZVP 基组完成。$^{54}$",
        }
    )

    assert intent.source_role == "body_text"
    assert intent.cleanup_action == "strip_text"


def test_structural_toc_and_page_number_do_not_force_text_strip_in_beta10_cleanup() -> None:
    from retainpdf_pipeline.render.source_cleanup.planning.item_classifier import item_allows_forced_text_strip

    assert not item_allows_forced_text_strip(
        {
            "item_id": "p001-b001",
            "block_kind": "text",
            "layout_role": "toc",
            "semantic_role": "table_of_contents",
        }
    )
    assert not item_allows_forced_text_strip(
        {
            "item_id": "p001-b002",
            "block_kind": "text",
            "layout_role": "page_number",
        }
    )


def test_text_strip_hit_test_ignores_tiny_edge_intersections() -> None:
    strip_index = RectIndex.build([(100.0, 100.0, 160.0, 120.0)])

    assert strip_index.matches_text_for_removal(
        20.0,
        110.0,
        (20.0, 100.0, 101.0, 120.0),
    ) is False
    assert strip_index.matches_text_for_removal(
        20.0,
        110.0,
        (20.0, 100.0, 145.0, 120.0),
    ) is True
    assert strip_index.matches_text_for_removal(
        120.0,
        110.0,
        (20.0, 100.0, 101.0, 120.0),
    ) is True


def test_bbox_text_strip_preserves_explicit_protected_source_blocks() -> None:
    job = Path("data/jobs/20260607133703-aa37db")
    source_pdf = next((job / "source").glob("*.pdf"), None)
    translated_path = job / "translated/page-009-deepseek.json"
    normalized_path = job / "ocr/normalized/document.v1.json"
    if source_pdf is None or not translated_path.exists() or not normalized_path.exists():
        pytest.skip("sample job is not available")

    from retainpdf_pipeline.render.source_cleanup.protected_blocks import protected_pages_from_document_path

    with tempfile.TemporaryDirectory() as tmp:
        output_pdf = Path(tmp) / "stripped.pdf"
        translated_items = json.loads(translated_path.read_text(encoding="utf-8"))
        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={8: translated_items},
            protected_pages=protected_pages_from_document_path(normalized_path),
        )

        assert result.changed is True
        stripped = fitz.open(output_pdf)
        try:
            text = stripped[8].get_text()
        finally:
            stripped.close()
        assert "The Supporting Information is available free of charge at" in text


def test_bbox_text_strip_removes_text_inside_bbox_without_redaction_bloat() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=200, height=200)
        page.insert_text((20, 40), "inside text", fontsize=12)
        page.insert_text((20, 140), "outside text", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "text",
                        "bbox": [10.0, 20.0, 140.0, 55.0],
                        "protected_translated_text": "译文",
                    }
                ]
            },
            skip_form_xobject_pages=True,
        )

        assert result.changed is True
        assert result.text_show_ops_removed >= 1

        stripped = fitz.open(output_pdf)
        try:
            text = stripped[0].get_text()
        finally:
            stripped.close()
        assert "inside text" not in text
        assert "outside text" in text


def test_bbox_text_strip_preserves_text_block_with_embedded_display_formula() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=260, height=180)
        page.insert_text((30, 50), "body text", fontsize=12)
        page.insert_text((30, 90), "E = mc2", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "text",
                        "block_type": "text",
                        "bbox": [20.0, 30.0, 230.0, 105.0],
                        "source_text": "body text\n$$ E=mc^2 $$",
                        "protected_translated_text": "正文\n$$ E=mc^2 $$",
                    },
                ]
            },
        )

        assert result.changed is False
        assert output_pdf.exists() is False


def test_bbox_text_strip_keeps_source_text_when_no_translated_overlay() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=200, height=200)
        page.insert_text((20, 40), "inside source", fontsize=12)
        page.insert_text((20, 140), "outside source", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "text",
                        "bbox": [10.0, 20.0, 140.0, 55.0],
                        "protected_source_text": "inside source",
                        "protected_translated_text": "",
                    }
                ]
            },
        )

        assert result.changed is False
        assert output_pdf.exists() is False


def test_bbox_text_strip_keeps_non_translated_items_even_with_render_text() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=200, height=200)
        page.insert_text((20, 40), "keep original", fontsize=12)
        page.insert_text((20, 140), "outside source", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "text",
                        "bbox": [10.0, 20.0, 140.0, 55.0],
                        "protected_source_text": "keep original",
                        "protected_translated_text": "keep original",
                        "final_status": "kept_origin",
                        "decision": "keep_origin",
                    }
                ]
            },
        )

        assert result.changed is False
        assert output_pdf.exists() is False


def test_bbox_text_strip_deletes_safe_items_when_same_page_has_keep_origin_item() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=240, height=220)
        page.insert_text((20, 40), "translated source", fontsize=12)
        page.insert_text((20, 110), "keep original", fontsize=12)
        page.insert_text((20, 180), "outside source", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "item_id": "p001-b001",
                        "block_kind": "text",
                        "bbox": [10.0, 20.0, 180.0, 58.0],
                        "protected_source_text": "translated source",
                        "protected_translated_text": "已翻译",
                    },
                    {
                        "item_id": "p001-b002",
                        "block_kind": "text",
                        "bbox": [10.0, 90.0, 180.0, 128.0],
                        "protected_source_text": "keep original",
                        "protected_translated_text": "keep original",
                        "final_status": "kept_origin",
                        "decision": "keep_origin",
                    },
                ]
            },
        )

        assert result.changed is True
        assert result.skipped_visual_background_page_indices == frozenset()
        stripped = fitz.open(output_pdf)
        try:
            text = stripped[0].get_text()
        finally:
            stripped.close()
        assert "translated source" not in text
        assert "keep original" in text
        assert "outside source" in text


def test_bbox_text_strip_skips_large_background_image_page_before_deletion() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=200, height=200)
        pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 200, 200), False)
        pix.clear_with(255)
        page.insert_image(page.rect, pixmap=pix)
        page.insert_text((20, 40), "inside source", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "text",
                        "bbox": [10.0, 20.0, 140.0, 55.0],
                        "protected_source_text": "inside source",
                        "protected_translated_text": "译文",
                    }
                ]
            },
        )

        assert result.changed is False
        assert result.changed_page_indices == frozenset()
        assert result.skipped_visual_background_page_indices == frozenset({0})
        assert output_pdf.exists() is False


def test_bbox_text_strip_keeps_body_text_deletable_when_vector_line_overlaps() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=200, height=200)
        page.insert_text((20, 40), "inside text", fontsize=12)
        page.draw_line((12, 45), (150, 45), color=(0, 0, 0), width=1)
        doc.save(source_pdf)
        doc.close()

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "text",
                        "bbox": [10.0, 20.0, 160.0, 60.0],
                        "protected_translated_text": "译文",
                    }
                ]
            },
        )

        assert result.changed is True
        assert output_pdf.exists() is True
        assert result.skipped_complex_page_indices == frozenset()


def test_bbox_text_strip_allows_fill_only_background_overlap() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=240, height=180)
        page.draw_rect(fitz.Rect(12, 25, 180, 75), color=None, fill=(1.0, 0.95, 0.82))
        page.insert_text((20, 50), "inside text", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "text",
                        "bbox": [10.0, 20.0, 190.0, 80.0],
                        "protected_translated_text": "译文",
                    }
                ]
            },
        )

        assert result.changed is True
        assert result.skipped_complex_page_indices == frozenset()
        stripped = fitz.open(output_pdf)
        try:
            text = stripped[0].get_text()
            drawings = stripped[0].get_drawings()
        finally:
            stripped.close()
        assert "inside text" not in text
        assert drawings


def test_bbox_text_strip_allows_toc_leader_vector_overlap() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=260, height=180)
        page.insert_text((20, 50), "1.1 Introduction", fontsize=12)
        page.draw_line((120, 47), (210, 47), color=(0, 0, 0), width=0.5)
        page.insert_text((220, 50), "2", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "text",
                        "layout_role": "toc",
                        "semantic_role": "table_of_contents",
                        "structure_role": "table_of_contents",
                        "normalized_sub_type": "table_of_contents",
                        "bbox": [15.0, 30.0, 235.0, 60.0],
                        "protected_translated_text": "1.1 引言 ..... 2",
                    }
                ]
            },
        )

        assert result.changed is True
        assert result.skipped_complex_page_indices == frozenset()

        stripped = fitz.open(output_pdf)
        try:
            text = stripped[0].get_text()
            drawings = stripped[0].get_drawings()
        finally:
            stripped.close()
        assert "Introduction" not in text
        assert drawings


def test_bbox_text_strip_keeps_fast_path_when_vector_line_is_outside_text_bbox() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=200, height=200)
        page.insert_text((20, 40), "inside text", fontsize=12)
        page.draw_line((12, 120), (150, 120), color=(0, 0, 0), width=1)
        doc.save(source_pdf)
        doc.close()

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "text",
                        "bbox": [10.0, 20.0, 160.0, 60.0],
                        "protected_translated_text": "译文",
                    }
                ]
            },
        )

        assert result.changed is True
        assert result.skipped_complex_page_indices == frozenset()

        stripped = fitz.open(output_pdf)
        try:
            text = stripped[0].get_text()
        finally:
            stripped.close()
        assert "inside text" not in text


def test_bbox_text_strip_formula_guard_edge_touch_does_not_protect_whole_text_op() -> None:
    protected_index = RectIndex.build([fitz.Rect(68.5, 667.0, 249.0, 681.0)])

    assert not is_protected_text_op(
        user_point=(72.02, 684.22),
        text_rect=(72.02, 680.73, 136.76, 694.68),
        protected_index=protected_index,
    )


def test_bbox_text_strip_formula_guard_protects_substantial_text_overlap() -> None:
    protected_index = RectIndex.build([fitz.Rect(68.5, 667.0, 249.0, 681.0)])

    assert is_protected_text_op(
        user_point=(72.02, 676.0),
        text_rect=(72.02, 672.0, 136.76, 686.0),
        protected_index=protected_index,
    )


def test_bbox_text_strip_preserves_textual_formula_without_overlay_and_keeps_math_formula() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=260, height=180)
        page.insert_text((30, 50), "f = lateral friction for design speed", fontsize=12)
        page.insert_text((30, 90), "E = mc2", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "formula",
                        "block_type": "formula",
                        "bbox": [20.0, 30.0, 230.0, 65.0],
                        "source_text": r"$$ \mathrm{f=lateral friction for design speed} $$",
                    },
                    {
                        "block_kind": "formula",
                        "block_type": "formula",
                        "bbox": [20.0, 70.0, 130.0, 105.0],
                        "source_text": r"$$ E=mc^2 $$",
                    },
                ]
            },
        )

        assert result.changed is False
        assert output_pdf.exists() is False


def test_bbox_text_strip_removes_textual_formula_when_overlay_exists() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=260, height=180)
        page.insert_text((30, 50), "f = lateral friction for design speed", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "formula",
                        "block_type": "formula",
                        "bbox": [20.0, 30.0, 230.0, 65.0],
                        "source_text": r"$$ \mathrm{f=lateral friction for design speed} $$",
                        "protected_translated_text": "f = 设计速度对应的侧向摩擦系数",
                    },
                ]
            },
        )

        assert result.changed is True
        stripped = fitz.open(output_pdf)
        try:
            text = stripped[0].get_text()
        finally:
            stripped.close()
        assert "lateral friction" not in text


def test_bbox_text_strip_skips_formula_pages() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=240, height=180)
        page.insert_text((30, 50), "body text", fontsize=12)
        page.insert_text((80, 90), "I/I0 = A1 + A2", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            skip_formula_pages=True,
            translated_pages={
                0: [
                    {
                        "block_kind": "text",
                        "bbox": [20.0, 30.0, 130.0, 65.0],
                        "protected_translated_text": "正文",
                    },
                    {
                        "block_kind": "formula",
                        "bbox": [70.0, 70.0, 190.0, 105.0],
                        "protected_translated_text": "",
                    },
                ]
            },
        )

        assert result.changed is False
        assert output_pdf.exists() is False
        assert result.skipped_complex_page_indices == frozenset({0})


def test_redact_restore_formula_wrapper_only_marks_changed_pages_precleaned() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "redact-restore.pdf"
        doc = fitz.open()
        page = doc.new_page(width=240, height=180)
        page.insert_text((30, 50), "body text", fontsize=12)
        page.insert_text((80, 90), "I/I0 = A1 + A2", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        result = build_redact_restore_formula_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "text",
                        "block_type": "text",
                        "bbox": [20.0, 30.0, 150.0, 65.0],
                        "protected_translated_text": "正文",
                    },
                    {
                        "block_kind": "formula",
                        "block_type": "formula",
                        "bbox": [70.0, 70.0, 200.0, 105.0],
                        "protected_translated_text": "",
                    },
                ]
            },
        )

        assert result.changed is True
        assert result.redaction_rects == 1
        assert result.formula_rects_restored == 0
        restored = fitz.open(output_pdf)
        try:
            text = restored[0].get_text()
        finally:
            restored.close()
        assert "body text" not in text
        assert "I/I0 = A1 + A2" in text


def test_strip_bbox_text_rects_from_pdf_copy_removes_text_without_translated_pages() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=240, height=180)
        page.insert_text((30, 50), "remove me", fontsize=12)
        page.insert_text((30, 100), "keep me", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        result = strip_bbox_text_rects_from_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            page_rects={0: [fitz.Rect(20.0, 115.0, 120.0, 150.0)]},
        )

        assert result.changed is True
        stripped = fitz.open(output_pdf)
        try:
            text = stripped[0].get_text()
        finally:
            stripped.close()
        assert "remove me" not in text
        assert "keep me" in text


def test_strip_bbox_text_rects_from_pdf_copy_removes_text_like_fill_paths() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        pdf = pikepdf.Pdf.new()
        page = pdf.add_blank_page(page_size=(240, 180))
        page.obj[Name("/Contents")] = pdf.make_stream(
            b"BT /F1 12 Tf 30 50 Td (remove me) Tj ET\n"
            b"q 0 0 0 rg 60 60 m 65 60 l 65 70 l 60 70 l h f Q\n"
            b"q 0 0 0 rg 160 120 m 165 120 l 165 130 l 160 130 l h f Q\n"
        )
        page.obj[Name("/Resources")] = pikepdf.Dictionary(
            Font=pikepdf.Dictionary(
                F1=pikepdf.Dictionary(
                    Type=Name("/Font"),
                    Subtype=Name("/Type1"),
                    BaseFont=Name("/Helvetica"),
                )
            )
        )
        pdf.save(source_pdf)

        result = strip_bbox_text_rects_from_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            page_rects={0: [fitz.Rect(20.0, 35.0, 100.0, 80.0)]},
        )

        assert result.changed is True
        stripped = fitz.open(output_pdf)
        try:
            bboxlog = stripped[0].get_bboxlog()
        finally:
            stripped.close()
        assert not any(kind == "fill-path" and fitz.Rect(rect).intersects(fitz.Rect(20, 35, 100, 80)) for kind, rect in bboxlog)
        assert any(kind == "fill-path" and fitz.Rect(rect).intersects(fitz.Rect(150, 40, 180, 70)) for kind, rect in bboxlog)


def test_bbox_text_strip_clones_shared_form_xobject_before_rewrite() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        pdf = pikepdf.Pdf.new()
        page = pdf.add_blank_page(page_size=(240, 180))
        form = pdf.make_stream(b"BT /F1 12 Tf 0 0 Td (FORMTEXT) Tj ET")
        form[Name("/Type")] = Name("/XObject")
        form[Name("/Subtype")] = Name("/Form")
        form[Name("/BBox")] = pikepdf.Array([0, 0, 120, 30])
        form[Name("/Resources")] = pikepdf.Dictionary(
            Font=pikepdf.Dictionary(
                F1=pikepdf.Dictionary(
                    Type=Name("/Font"),
                    Subtype=Name("/Type1"),
                    BaseFont=Name("/Helvetica"),
                )
            )
        )
        page.obj[Name("/Resources")] = pikepdf.Dictionary(
            XObject=pikepdf.Dictionary(Fm1=form)
        )
        page.obj[Name("/Contents")] = pdf.make_stream(
            b"q 1 0 0 1 30 50 cm /Fm1 Do Q\n"
            b"q 1 0 0 1 30 120 cm /Fm1 Do Q\n"
        )
        pdf.save(source_pdf)

        result = strip_bbox_text_rects_from_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            page_rects={0: [fitz.Rect(20.0, 40.0, 180.0, 75.0)]},
            recurse_forms=True,
        )

        assert result.changed is True
        assert result.forms_changed == 1

        stripped = fitz.open(output_pdf)
        try:
            text = stripped[0].get_text()
        finally:
            stripped.close()
        assert text.count("FORMTEXT") == 1


def test_bbox_text_strip_executor_skips_form_xobject_pages_for_cover_fallback() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        pdf = pikepdf.Pdf.new()
        page = pdf.add_blank_page(page_size=(240, 180))
        form = pdf.make_stream(b"BT /F1 12 Tf 0 0 Td (FORMTEXT) Tj ET")
        form[Name("/Type")] = Name("/XObject")
        form[Name("/Subtype")] = Name("/Form")
        form[Name("/BBox")] = pikepdf.Array([0, 0, 120, 30])
        form[Name("/Resources")] = pikepdf.Dictionary(
            Font=pikepdf.Dictionary(
                F1=pikepdf.Dictionary(
                    Type=Name("/Font"),
                    Subtype=Name("/Type1"),
                    BaseFont=Name("/Helvetica"),
                )
            )
        )
        page.obj[Name("/Resources")] = pikepdf.Dictionary(XObject=pikepdf.Dictionary(Fm1=form))
        page.obj[Name("/Contents")] = pdf.make_stream(b"q 1 0 0 1 30 50 cm /Fm1 Do Q\n")
        pdf.save(source_pdf)

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "text",
                        "bbox": [20.0, 40.0, 180.0, 75.0],
                        "protected_translated_text": "译文",
                    }
                ]
            },
            skip_form_xobject_pages=True,
        )

        assert result.changed is False
        assert result.skipped_form_xobject_page_indices == frozenset({0})
        assert output_pdf.exists() is False


def test_bbox_text_strip_skips_form_recursion_but_keeps_page_text_fast_path() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        pdf = pikepdf.Pdf.new()
        page = pdf.add_blank_page(page_size=(240, 180))
        form = pdf.make_stream(b"BT /F1 12 Tf 0 0 Td (FORMTEXT) Tj ET")
        form[Name("/Type")] = Name("/XObject")
        form[Name("/Subtype")] = Name("/Form")
        form[Name("/BBox")] = pikepdf.Array([0, 0, 120, 30])
        font = pikepdf.Dictionary(
            Type=Name("/Font"),
            Subtype=Name("/Type1"),
            BaseFont=Name("/Helvetica"),
        )
        page.obj[Name("/Resources")] = pikepdf.Dictionary(
            Font=pikepdf.Dictionary(F1=font),
            XObject=pikepdf.Dictionary(Fm1=form),
        )
        page.obj[Name("/Contents")] = pdf.make_stream(
            b"BT /F1 12 Tf 30 50 Td (PAGETEXT) Tj ET\n"
            b"q 1 0 0 1 30 100 cm /Fm1 Do Q\n"
        )
        pdf.save(source_pdf)

        result = strip_bbox_text_rects_from_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            page_rects={0: [fitz.Rect(20.0, 35.0, 180.0, 70.0)]},
            recurse_forms=True,
            skip_form_xobject_pages=True,
        )

        assert result.changed is True
        assert result.skipped_form_xobject_page_indices == frozenset({0})
        stripped = fitz.open(output_pdf)
        try:
            text = stripped[0].get_text()
        finally:
            stripped.close()
        assert "PAGETEXT" not in text
        assert "FORMTEXT" in text


def test_source_cleanup_default_recurses_form_xobjects_for_inline_formula_text() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        pdf = pikepdf.Pdf.new()
        page = pdf.add_blank_page(page_size=(240, 180))
        form = pdf.make_stream(b"BT /F1 12 Tf 0 0 Td (INLINEFORMULA) Tj ET")
        form[Name("/Type")] = Name("/XObject")
        form[Name("/Subtype")] = Name("/Form")
        form[Name("/BBox")] = pikepdf.Array([0, 0, 140, 30])
        font = pikepdf.Dictionary(
            Type=Name("/Font"),
            Subtype=Name("/Type1"),
            BaseFont=Name("/Helvetica"),
        )
        page.obj[Name("/Resources")] = pikepdf.Dictionary(
            Font=pikepdf.Dictionary(F1=font),
            XObject=pikepdf.Dictionary(Fm1=form),
        )
        page.obj[Name("/Contents")] = pdf.make_stream(
            b"BT /F1 12 Tf 30 50 Td (BODYTEXT) Tj ET\n"
            b"q 1 0 0 1 30 100 cm /Fm1 Do Q\n"
        )
        pdf.save(source_pdf)

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "text",
                        "bbox": [20.0, 35.0, 180.0, 125.0],
                        "source_text": "BODYTEXT $ INLINEFORMULA $",
                        "protected_translated_text": "正文 $ INLINEFORMULA $",
                    }
                ]
            },
        )

        assert result.changed is True
        assert result.forms_changed >= 1
        assert result.skipped_form_xobject_page_indices == frozenset()
        stripped = fitz.open(output_pdf)
        try:
            text = stripped[0].get_text()
        finally:
            stripped.close()
        assert "BODYTEXT" not in text
        assert "INLINEFORMULA" not in text


def test_bbox_text_strip_recurses_large_form_xobject_in_beta10_cleanup(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RETAIN_BBOX_TEXT_STRIP_FORM_RECURSE_MAX_RAW_BYTES", "64")
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        pdf = pikepdf.Pdf.new()
        page = pdf.add_blank_page(page_size=(240, 180))
        filler = b"".join(f"% filler {index:04d} abcdefghijklmnopqrstuvwxyz\n".encode() for index in range(200))
        form = pdf.make_stream(b"BT /F1 12 Tf 0 0 Td (FORMTEXT) Tj ET\n" + filler)
        form[Name("/Type")] = Name("/XObject")
        form[Name("/Subtype")] = Name("/Form")
        form[Name("/BBox")] = pikepdf.Array([0, 0, 140, 30])
        font = pikepdf.Dictionary(
            Type=Name("/Font"),
            Subtype=Name("/Type1"),
            BaseFont=Name("/Helvetica"),
        )
        page.obj[Name("/Resources")] = pikepdf.Dictionary(
            Font=pikepdf.Dictionary(F1=font),
            XObject=pikepdf.Dictionary(Fm1=form),
        )
        page.obj[Name("/Contents")] = pdf.make_stream(
            b"BT /F1 12 Tf 30 50 Td (PAGETEXT) Tj ET\n"
            b"q 1 0 0 1 30 100 cm /Fm1 Do Q\n"
        )
        pdf.save(source_pdf)

        result = strip_bbox_text_rects_from_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            page_rects={0: [fitz.Rect(20.0, 35.0, 180.0, 125.0)]},
            recurse_forms=True,
        )

        assert result.changed is True
        assert result.forms_changed == 1
        stripped = fitz.open(output_pdf)
        try:
            text = stripped[0].get_text()
        finally:
            stripped.close()
        assert "PAGETEXT" not in text
        assert "FORMTEXT" not in text


def test_render_source_skips_physical_strip_when_document_analysis_requires_visual_cover() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "translated.pdf"
        doc = fitz.open()
        for _index in range(121):
            page = doc.new_page(width=120, height=120)
            page.insert_text((10, 30), "source", fontsize=10)
        doc.save(source_pdf)
        doc.close()

        translated_pages = {
            index: [
                {
                    "block_kind": "text",
                    "bbox": [5.0, 15.0, 90.0, 45.0],
                    "protected_translated_text": "译文",
                }
            ]
            for index in range(121)
        }

        result = build_render_source_pdf(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            pdf_compress_dpi=0,
            translated_pages=translated_pages,
            strip_hidden_text=False,
            artifact_mode=True,
            source_cleanup_strategy="pikepdf_text_strip",
            document_analysis=RenderDocumentAnalysis(
                pages={
                    index: build_render_page_analysis(sample_render_page_profile("scan_image"))
                    for index in translated_pages
                }
            ),
        )

        assert result.path == source_pdf
        assert result.bbox_text_stripped_page_indices == frozenset()
        assert len(result.bbox_text_strip_skipped_page_indices) == 121


def test_bbox_text_strip_single_worker_preserves_form_recursion(monkeypatch: pytest.MonkeyPatch) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        for _index in range(85):
            page = doc.new_page(width=240, height=180)
            page.insert_text((30, 50), "remove me", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        monkeypatch.setenv("RETAIN_BBOX_TEXT_STRIP_WORKERS", "1")
        monkeypatch.setenv("RETAIN_BBOX_TEXT_STRIP_PARALLEL_THRESHOLD", "1")
        seen_recurse_forms: list[bool] = []

        def fake_strip_page(
            page,
            rects,
            *,
            pdf,
            protected_rects,
            recurse_forms,
        ):
            seen_recurse_forms.append(recurse_forms)
            return b"", 0, 0

        with mock.patch.object(source_cleanup_document, "strip_bbox_text_from_page", side_effect=fake_strip_page):
            strip_bbox_text_rects_from_pdf_copy(
                source_pdf_path=source_pdf,
                output_pdf_path=output_pdf,
                page_rects={index: [fitz.Rect(20.0, 35.0, 120.0, 65.0)] for index in range(85)},
                recurse_forms=True,
            )

    assert seen_recurse_forms
    assert set(seen_recurse_forms) == {True}


def test_bbox_text_strip_parallel_worker_count_scales_for_medium_documents() -> None:
    assert source_cleanup_document._parallel_worker_count(30) >= 2
    assert source_cleanup_document._parallel_worker_count(500) <= source_cleanup_document.BBOX_TEXT_STRIP_PARALLEL_MAX_WORKERS


def test_bbox_text_strip_parallel_threshold_scales_with_cpu_count(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RETAIN_BBOX_TEXT_STRIP_PARALLEL_THRESHOLD", raising=False)
    monkeypatch.setattr(source_cleanup_document.os, "cpu_count", lambda: 4)
    assert source_cleanup_document._parallel_worker_count(500) == 4

    monkeypatch.setattr(source_cleanup_document.os, "cpu_count", lambda: 8)
    assert source_cleanup_document._parallel_worker_count(500) == source_cleanup_document.BBOX_TEXT_STRIP_PARALLEL_MAX_WORKERS


def test_bbox_text_strip_parallel_threshold_can_be_overridden(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RETAIN_BBOX_TEXT_STRIP_PARALLEL_THRESHOLD", "18")

    assert source_cleanup_document.BBOX_TEXT_STRIP_PARALLEL_PAGE_THRESHOLD == 12


def test_bbox_text_strip_chunks_balance_decoded_stream_weights() -> None:
    pdf = pikepdf.Pdf.new()
    sizes = [1200, 1100, 1000, 220, 210, 200, 190, 180, 170]
    for size in sizes:
        page = pdf.add_blank_page(page_size=(120, 120))
        page.obj[Name("/Contents")] = pdf.make_stream(b"q\n" + (b" " * size) + b"\nQ")

    page_rects = {
        index: [fitz.Rect(10.0, 10.0, 60.0, 40.0)]
        for index in range(len(sizes))
    }

    chunks = source_cleanup_document._page_chunks(pdf, page_rects, {}, 3)
    loads = [sum(weight for _page_idx, weight, _rects, _protected in chunk) for chunk in chunks]

    assert len(chunks) == 3
    assert max(loads) - min(loads) < max(sizes)


def test_bbox_text_strip_candidates_manifest_preserves_runtime_skip_metadata() -> None:
    candidates = BBoxTextStripCandidates(
        page_rects={1: ((10.0, 20.0, 30.0, 40.0),)},
        page_protected_rects={1: ((12.0, 22.0, 18.0, 28.0),)},
        pages_skipped_complex=1,
        pages_skipped_form_xobject=2,
        pages_strip_no_effect=3,
        skipped_complex_page_indices=frozenset({4}),
        skipped_form_xobject_page_indices=frozenset({5, 6}),
        strip_no_effect_page_indices=frozenset({7, 8, 9}),
        page_features={1: {"content_stream_size": 1234, "has_form_xobjects": True}},
    )

    restored = bbox_candidates_from_manifest(bbox_candidates_to_manifest(candidates))

    assert restored is not None
    assert restored.page_rects == candidates.page_rects
    assert candidates.candidate_source == "fresh_plan"
    assert restored.candidate_source == "manifest"
    assert restored.skipped_form_xobject_page_indices == frozenset({5, 6})
    assert restored.strip_no_effect_page_indices == frozenset({7, 8, 9})
    assert restored.page_features[1]["content_stream_size"] == 1234


def test_text_state_advance_uses_font_size_spacing_and_tj_adjustments() -> None:
    state = text_ops.TextState(font_size=12.0, char_spacing=1.0, word_spacing=3.0)

    plain = text_ops.text_advance_tx(pdf_math.IDENTITY_MATRIX, ["hello"], text_state=state)
    with_space = text_ops.text_advance_tx(pdf_math.IDENTITY_MATRIX, ["a b"], text_state=state)
    with_tj_pull = text_ops.text_advance_tx(pdf_math.IDENTITY_MATRIX, [pikepdf.Array(["a", -120, "b"])], text_state=state)

    assert plain == pytest.approx(35.0)
    assert with_space == pytest.approx(24.0)
    assert with_tj_pull > text_ops.text_advance_tx(pdf_math.IDENTITY_MATRIX, ["ab"], text_state=state)


def test_estimated_text_rect_uses_font_size_from_text_state() -> None:
    state = text_ops.TextState(font_size=12.0)
    _point, rect = text_ops.estimated_user_text_geometry(
        pdf_math.IDENTITY_MATRIX,
        (1, 0, 0, 1, 20, 40),
        state,
        text_length=4,
    )

    assert rect[0] == pytest.approx(20.0)
    assert rect[1] < 40.0
    assert rect[2] >= 44.0
    assert rect[3] > 50.0
