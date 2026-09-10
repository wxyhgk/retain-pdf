from __future__ import annotations

import sys
from pathlib import Path

import fitz


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.render.pdf_structure_profile import build_pdf_structure_page_profile
from retainpdf_pipeline.render.pdf_structure_profile.manifest import pdf_structure_profile_from_manifest
from retainpdf_pipeline.render.pdf_structure_profile.manifest import pdf_structure_profile_to_manifest
from retainpdf_pipeline.render.pdf_structure_profile.contracts import PdfStructureDocumentProfile


def test_pdf_structure_profile_collects_pdf_native_boxes() -> None:
    doc = fitz.open()
    try:
        page = doc.new_page(width=240, height=180)
        page.insert_textbox(fitz.Rect(30, 40, 180, 70), "Native PDF text", fontsize=12)
        page.draw_rect(fitz.Rect(20, 90, 120, 120), color=(0, 0, 0), fill=None)
        items = [
            {
                "item_id": "p001-b001",
                "bbox": [30, 40, 180, 70],
                "block_kind": "text",
            }
        ]

        profile = build_pdf_structure_page_profile(page, items)

        assert profile.page_index == 0
        assert profile.text_objects
        assert profile.text_spans
        assert profile.path_objects
        assert profile.item_hits
        assert profile.item_hits[0].item_id == "p001-b001"
        assert profile.item_hits[0].object_type == "text_object"
        assert profile.item_hits[0].overlap_ratio > 0.2
    finally:
        doc.close()


def test_pdf_structure_profile_manifest_round_trips() -> None:
    doc = fitz.open()
    try:
        page = doc.new_page(width=200, height=120)
        page.insert_textbox(fitz.Rect(20, 20, 160, 45), "Text", fontsize=12)
        page_profile = build_pdf_structure_page_profile(
            page,
            [{"item_id": "p001-b001", "bbox": [20, 20, 160, 45]}],
        )
        document = PdfStructureDocumentProfile(
            algorithm="pdf_structure_profile_v1",
            pages={0: page_profile},
        )

        manifest = pdf_structure_profile_to_manifest(document)
        restored = pdf_structure_profile_from_manifest(manifest)

        assert restored.algorithm == "pdf_structure_profile_v1"
        assert restored.pages[0].text_objects[0].object_type == "text_object"
        assert restored.pages[0].text_spans[0].source == "text_dict"
        assert restored.pages[0].item_hits[0].item_id == "p001-b001"
    finally:
        doc.close()
