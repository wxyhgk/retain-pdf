from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import fitz


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

# Experimental source-cleanup-next tests. They intentionally target the
# pdf-structure-profile cleanup contract, which is not enabled in the current
# beta10 cleanup mainline.

from retainpdf_pipeline.render.pdf_structure_profile.contracts import PDF_STRUCTURE_PROFILE_ALGORITHM_VERSION
from retainpdf_pipeline.render.pdf_structure_profile.contracts import PdfObjectBox
from retainpdf_pipeline.render.pdf_structure_profile.contracts import PdfStructureDocumentProfile
from retainpdf_pipeline.render.pdf_structure_profile.contracts import PdfStructurePageProfile
from retainpdf_pipeline.render.pdf_structure_profile.io import write_pdf_structure_profile
from retainpdf_pipeline.render.source_cleanup import SourceCleanupOptions
from retainpdf_pipeline.render.source_cleanup import SourceCleanupRequest
from retainpdf_pipeline.render.source_cleanup import build_source_cleanup_plan


def test_source_cleanup_plan_uses_pdf_structure_profile_page_features() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        profile_path = root / "pdf_structure_profile.v1.json"
        _write_simple_source_pdf(source_pdf)
        write_pdf_structure_profile(profile_path, _document_profile_with_form_xobject())

        plan = build_source_cleanup_plan(
            SourceCleanupRequest(
                source_pdf_path=source_pdf,
                output_pdf_path=output_pdf,
                translated_pages={0: [_translated_item()]},
                options=SourceCleanupOptions(skip_form_xobject_pages=True),
                pdf_structure_profile_path=profile_path,
            )
        )

    assert plan.candidates.page_features[0]["has_form_xobjects"] is True
    assert 0 in plan.candidates.page_rects


def test_source_cleanup_ignores_mismatched_pdf_structure_profile_page() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        _write_simple_source_pdf(source_pdf)

        plan = build_source_cleanup_plan(
            SourceCleanupRequest(
                source_pdf_path=source_pdf,
                output_pdf_path=output_pdf,
                translated_pages={0: [_translated_item()]},
                options=SourceCleanupOptions(skip_form_xobject_pages=True),
                pdf_structure_profile=_document_profile_with_form_xobject(page_width=999),
            )
        )

    assert plan.candidates.page_features[0]["has_form_xobjects"] is False
    assert 0 in plan.candidates.page_rects


def test_source_cleanup_resolver_uses_pdf_structure_profile_rects(monkeypatch) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        _write_simple_source_pdf(source_pdf)

        original_get_bboxlog = fitz.Page.get_bboxlog
        calls = 0

        def counted_get_bboxlog(self):
            nonlocal calls
            calls += 1
            return original_get_bboxlog(self)

        monkeypatch.setattr(fitz.Page, "get_bboxlog", counted_get_bboxlog)
        plan = build_source_cleanup_plan(
            SourceCleanupRequest(
                source_pdf_path=source_pdf,
                output_pdf_path=output_pdf,
                translated_pages={0: [_translated_item()]},
                pdf_structure_profile=_document_profile_with_text_object(),
            )
        )

    assert calls == 0
    assert 0 in plan.candidates.page_rects
    assert plan.candidates.skipped_no_text_overlap_page_indices == frozenset()


def test_source_cleanup_uses_pdf_structure_profile_unsafe_path_rects() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        _write_simple_source_pdf(source_pdf)

        plan = build_source_cleanup_plan(
            SourceCleanupRequest(
                source_pdf_path=source_pdf,
                output_pdf_path=output_pdf,
                translated_pages={0: [_translated_caption_item()]},
                pdf_structure_profile=_document_profile_with_text_object_and_unsafe_path(),
            )
        )

    assert plan.candidates.uncovered_unsafe_vector_item_ids == frozenset({"p001-caption"})


def test_source_cleanup_decision_keeps_multi_item_text_object_deletable() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        _write_simple_source_pdf(source_pdf)

        plan = build_source_cleanup_plan(
            SourceCleanupRequest(
                source_pdf_path=source_pdf,
                output_pdf_path=output_pdf,
                translated_pages={
                    0: [
                        {
                            "item_id": "p001-b001",
                            "block_kind": "text",
                            "bbox": [20.0, 35.0, 120.0, 50.0],
                            "protected_translated_text": "译文一",
                        },
                        {
                            "item_id": "p001-b002",
                            "block_kind": "text",
                            "bbox": [20.0, 52.0, 120.0, 68.0],
                            "protected_translated_text": "译文二",
                        },
                    ]
                },
                pdf_structure_profile=_document_profile_with_shared_text_object(),
            )
        )

    assert 0 in plan.candidates.page_rects
    assert plan.candidates.skipped_visual_background_page_indices == frozenset()


def test_source_cleanup_decision_keeps_formula_adjacent_body_with_protected_rects() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        _write_simple_source_pdf(source_pdf)

        plan = build_source_cleanup_plan(
            SourceCleanupRequest(
                source_pdf_path=source_pdf,
                output_pdf_path=output_pdf,
                translated_pages={
                    0: [
                        {
                            "item_id": "p001-b001",
                            "block_kind": "text",
                            "bbox": [20.0, 35.0, 180.0, 55.0],
                            "protected_translated_text": "上方正文",
                        },
                        {
                            "item_id": "p001-f001",
                            "block_kind": "formula",
                            "block_type": "formula",
                            "bbox": [50.0, 70.0, 150.0, 88.0],
                        },
                    ]
                },
                pdf_structure_profile=_document_profile_with_text_object(),
            )
        )

    assert 0 in plan.candidates.page_rects
    assert plan.candidates.page_protected_rects
    assert 0 in plan.candidates.page_protected_rects


def _write_simple_source_pdf(path: Path) -> None:
    doc = fitz.open()
    try:
        page = doc.new_page(width=240, height=180)
        page.insert_text((30, 50), "remove me", fontsize=12)
        doc.save(path)
    finally:
        doc.close()


def _translated_item() -> dict:
    return {
        "item_id": "p001-b001",
        "block_kind": "text",
        "bbox": [20.0, 35.0, 180.0, 70.0],
        "protected_translated_text": "译文",
    }


def _translated_caption_item() -> dict:
    return {
        "item_id": "p001-caption",
        "block_kind": "text",
        "layout_role": "caption",
        "bbox": [20.0, 35.0, 180.0, 70.0],
        "protected_translated_text": "图注",
    }


def _document_profile_with_text_object() -> PdfStructureDocumentProfile:
    page_profile = PdfStructurePageProfile(
        page_index=0,
        page_width_pt=240,
        page_height_pt=180,
        text_objects=(
            PdfObjectBox(
                object_id="p001-text_object-0000",
                page_index=0,
                object_type="text_object",
                bbox=(25.0, 35.0, 120.0, 58.0),
                source="bboxlog",
            ),
        ),
        text_spans=(),
        path_objects=(),
        image_objects=(),
        form_xobjects=(),
        item_hits=(),
    )
    return PdfStructureDocumentProfile(
        algorithm=PDF_STRUCTURE_PROFILE_ALGORITHM_VERSION,
        pages={0: page_profile},
    )


def _document_profile_with_text_object_and_unsafe_path() -> PdfStructureDocumentProfile:
    page_profile = PdfStructurePageProfile(
        page_index=0,
        page_width_pt=240,
        page_height_pt=180,
        text_objects=(
            PdfObjectBox(
                object_id="p001-text_object-0000",
                page_index=0,
                object_type="text_object",
                bbox=(25.0, 35.0, 120.0, 58.0),
                source="bboxlog",
            ),
        ),
        text_spans=(),
        path_objects=(
            PdfObjectBox(
                object_id="p001-path_object-0001",
                page_index=0,
                object_type="path_object",
                bbox=(24.0, 34.0, 122.0, 60.0),
                source="bboxlog",
                flags=("fill-path", "blocks_text_strip"),
            ),
        ),
        image_objects=(),
        form_xobjects=(),
        item_hits=(),
    )
    return PdfStructureDocumentProfile(
        algorithm=PDF_STRUCTURE_PROFILE_ALGORITHM_VERSION,
        pages={0: page_profile},
    )


def _document_profile_with_shared_text_object() -> PdfStructureDocumentProfile:
    page_profile = PdfStructurePageProfile(
        page_index=0,
        page_width_pt=240,
        page_height_pt=180,
        text_objects=(
            PdfObjectBox(
                object_id="p001-text_object-0000",
                page_index=0,
                object_type="text_object",
                bbox=(18.0, 34.0, 125.0, 70.0),
                source="bboxlog",
            ),
        ),
        text_spans=(),
        path_objects=(),
        image_objects=(),
        form_xobjects=(),
        item_hits=(),
    )
    return PdfStructureDocumentProfile(
        algorithm=PDF_STRUCTURE_PROFILE_ALGORITHM_VERSION,
        pages={0: page_profile},
    )


def _document_profile_with_form_xobject(page_width: float = 240) -> PdfStructureDocumentProfile:
    page_profile = PdfStructurePageProfile(
        page_index=0,
        page_width_pt=page_width,
        page_height_pt=180,
        text_objects=(),
        text_spans=(),
        path_objects=(),
        image_objects=(),
        form_xobjects=(
            PdfObjectBox(
                object_id="p001-form_xobject-0000",
                page_index=0,
                object_type="form_xobject",
                bbox=(0.0, 0.0, 120.0, 30.0),
                source="xobjects",
            ),
        ),
        item_hits=(),
    )
    return PdfStructureDocumentProfile(
        algorithm=PDF_STRUCTURE_PROFILE_ALGORITHM_VERSION,
        pages={0: page_profile},
    )
