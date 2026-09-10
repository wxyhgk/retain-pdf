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


def test_background_render_resilient_compile_sanitizes_on_failure() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        background_pdf = root / "background.pdf"

        doc = fitz.open()
        doc.new_page(width=200, height=300)
        doc.save(source_pdf)
        doc.save(background_pdf)
        doc.close()

        translated_pages = {
            0: [
                {
                    "item_id": "p001-b001",
                    "page_idx": 0,
                    "block_type": "text",
                    "bbox": [10.0, 20.0, 180.0, 80.0],
                    "lines": [{"text": "raw"}],
                    "source_text": "raw text",
                    "protected_source_text": "raw text",
                    "protected_translated_text": "translated text",
                }
            ]
        }
        page_specs = build_render_page_specs(
            source_pdf_path=source_pdf,
            translated_pages=translated_pages,
        )

        sanitized_pages = {
            0: [
                {
                    "item_id": "p001-b001",
                    "page_idx": 0,
                    "block_type": "text",
                    "bbox": [10.0, 20.0, 180.0, 80.0],
                    "lines": [{"text": "raw"}],
                    "source_text": "raw text",
                    "protected_source_text": "raw text",
                    "protected_translated_text": "sanitized text",
                }
            ]
        }

        with mock.patch(
            "retainpdf_pipeline.render.output.typst.book_renderer.compile_typst_render_pages_pdf",
            side_effect=[RuntimeError("mitex failed"), root / "probe.pdf", root / "sanitized.pdf"],
        ) as compile_mock, mock.patch(
            "retainpdf_pipeline.render.output.typst.book_renderer.collect_background_page_specs",
            return_value=[(0, 200.0, 300.0, translated_pages[0])],
        ), mock.patch(
            "retainpdf_pipeline.render.output.typst.book_renderer.sanitize_page_specs_for_typst_book_background",
            return_value=[(0, 200.0, 300.0, sanitized_pages[0])],
        ):
            result, diagnostics = _compile_render_pages_pdf_resilient(
                source_pdf_path=source_pdf,
                color_sample_pdf_path=source_pdf,
                background_pdf_path=background_pdf,
                translated_pages=translated_pages,
                page_specs=page_specs,
                work_dir=root,
            )

        assert result == root / "sanitized.pdf"
        assert diagnostics["background_compile_retried"] is True
        assert diagnostics["background_compile_failed"] is True
        assert "background_sanitize_elapsed_seconds" in diagnostics
        assert compile_mock.call_count == 3
        assert compile_mock.call_args_list[2].kwargs["stem"] == "book-background-overlay-sanitized"


def test_background_render_resilient_compile_sanitizes_only_bad_pages() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        background_pdf = root / "background.pdf"

        doc = fitz.open()
        for _ in range(4):
            doc.new_page(width=200, height=300)
        doc.save(source_pdf)
        doc.save(background_pdf)
        doc.close()

        translated_pages = {
            page_idx: [
                {
                    "item_id": f"p{page_idx + 1:03d}-b001",
                    "page_idx": page_idx,
                    "block_type": "text",
                    "bbox": [10.0, 20.0, 180.0, 80.0],
                    "lines": [{"text": "raw"}],
                    "source_text": "raw text",
                    "protected_source_text": "raw text",
                    "protected_translated_text": "translated text",
                }
            ]
            for page_idx in range(4)
        }
        page_specs = build_render_page_specs(
            source_pdf_path=source_pdf,
            translated_pages=translated_pages,
        )

        def fake_compile(*, page_specs, stem, **kwargs):
            del kwargs
            if stem == "book-background-overlay":
                raise RuntimeError("mitex failed")
            if "probe" in stem and any(spec.page_index == 2 for spec in page_specs):
                raise RuntimeError("mitex failed")
            return root / f"{stem}.pdf"

        with mock.patch(
            "retainpdf_pipeline.render.output.typst.book_renderer.compile_typst_render_pages_pdf",
            side_effect=fake_compile,
        ), mock.patch(
            "retainpdf_pipeline.render.output.typst.book_renderer.collect_background_page_specs",
            return_value=[
                (page_idx, 200.0, 300.0, translated_pages[page_idx])
                for page_idx in range(4)
            ],
        ), mock.patch(
            "retainpdf_pipeline.render.output.typst.book_renderer.sanitize_page_specs_for_typst_book_background",
            return_value=[
                (page_idx, 200.0, 300.0, translated_pages[page_idx])
                for page_idx in range(4)
            ],
        ) as sanitize_mock:
            result, diagnostics = _compile_render_pages_pdf_resilient(
                source_pdf_path=source_pdf,
                color_sample_pdf_path=source_pdf,
                background_pdf_path=background_pdf,
                translated_pages=translated_pages,
                page_specs=page_specs,
                work_dir=root,
            )

        assert result == root / "book-background-overlay-sanitized.pdf"
        assert diagnostics["background_bad_page_indices"] == [2]
        assert sanitize_mock.call_args.kwargs["page_indices"] == {2}


def test_background_render_color_adapt_samples_original_pdf_not_cleaned_background() -> None:
    from retainpdf_pipeline.render.output.typst.book_renderer import _apply_background_page_color_adapt
    from retainpdf_pipeline.render.output.typst.emitter import build_typst_source_from_page_specs

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        original_pdf = root / "original.pdf"
        cleaned_pdf = root / "cleaned.pdf"

        doc = fitz.open()
        page = doc.new_page(width=200, height=160)
        shape = page.new_shape()
        shape.draw_rect(fitz.Rect(20, 30, 150, 80))
        shape.finish(color=None, fill=(216 / 255.0, 216 / 255.0, 216 / 255.0))
        shape.commit()
        page.insert_text((28, 54), "source text", fontsize=10, color=(0, 0, 0))
        doc.save(original_pdf)
        doc.close()

        doc = fitz.open()
        page = doc.new_page(width=200, height=160)
        shape = page.new_shape()
        shape.draw_rect(fitz.Rect(20, 30, 150, 80))
        shape.finish(color=None, fill=(1, 1, 1))
        shape.commit()
        doc.save(cleaned_pdf)
        doc.close()

        translated_pages = {
            0: [
                {
                    "item_id": "p001-b001",
                    "page_idx": 0,
                    "block_type": "text",
                    "block_kind": "text",
                    "bbox": [26.0, 40.0, 130.0, 66.0],
                    "lines": [{"text": "source text", "bbox": [26.0, 40.0, 130.0, 66.0]}],
                    "source_text": "source text",
                    "protected_source_text": "source text",
                        "protected_translated_text": "译文",
                        "translated_text": "译文",
                        "formula_map": [],
                        "_render_policy": {"overlay_fill": "sampled"},
                        "_render_use_cover_fill": True,
                    }
                ]
            }
        adapted_pages = _apply_background_page_color_adapt(
            sample_pdf_path=original_pdf,
            translated_pages=translated_pages,
        )
        page_specs = build_render_page_specs(
            source_pdf_path=cleaned_pdf,
            translated_pages=adapted_pages,
            background_pdf_path=cleaned_pdf,
            prepared=True,
        )
        source = build_typst_source_from_page_specs(
            background_pdf_path=cleaned_pdf,
            page_specs=page_specs,
            work_dir=root,
        )

    assert "fill: rgb(216, 216, 216)" in source
    assert "fill: rgb(255, 255, 255)" not in source
