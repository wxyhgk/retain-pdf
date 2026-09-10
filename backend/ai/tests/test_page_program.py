from __future__ import annotations

import json
from pathlib import Path

import fitz
import pikepdf
import pytest
from retainpdf_ai.document_operations.page_program import (
    build_page_plan,
    canonical_program_bytes,
    execute_page_program,
    validate_page_program,
)
from retainpdf_ai.document_operations.visual_validation import (
    validate_page_program_visuals,
)


def _source_pdf(path: Path, pages: int = 4) -> Path:
    pdf = pikepdf.Pdf.new()
    for index in range(pages):
        page = pdf.add_blank_page(page_size=(300 + index, 500 + index))
        page.obj["/Rotate"] = 0
    pdf.save(path)
    return path


def _visible_source_pdf(path: Path) -> Path:
    document = fitz.open()
    for index, (width, height) in enumerate(((300, 500), (420, 260), (360, 360)), start=1):
        page = document.new_page(width=width, height=height)
        page.insert_text((36, 72), f"VISIBLE PAGE {index}", fontsize=24)
        page.draw_rect(
            fitz.Rect(24, 110, width - 24, height - 24),
            color=(1, 0, 0),
            fill=(index / 4, 0.2, 0.7),
        )
        if index == 2:
            page.set_rotation(90)
    document.save(path)
    document.close()
    return path


def _fractional_visible_source_pdf(path: Path) -> Path:
    """Match real-world A4 geometry whose raster origin rounds by one pixel."""

    document = fitz.open()
    page = document.new_page(width=595.2760009765625, height=841.8899536132812)
    page.insert_text((47.25, 83.75), "FRACTIONAL A4 PAGE", fontsize=21)
    page.draw_rect(
        fitz.Rect(31.125, 127.375, 557.875, 799.625),
        color=(0.1, 0.4, 0.8),
        fill=(0.9, 0.75, 0.2),
    )
    document.save(path)
    document.close()
    return path


def test_program_selects_reorders_duplicates_and_rotates(tmp_path):
    source = _source_pdf(tmp_path / "source.pdf")
    output = tmp_path / "candidate.pdf"
    program = {
        "schema": "retainpdf_page_program_v1",
        "steps": [
            {"op": "select_pages", "pages": [4, 2, 2]},
            {"op": "rotate_pages", "pages": [1, 3], "degrees": 90},
        ],
    }

    result = execute_page_program(source, program, output)

    assert result["status"] == "completed"
    assert result["input_page_count"] == 4
    assert result["output_page_count"] == 3
    assert result["output_bytes"] == output.stat().st_size
    with pikepdf.open(output) as candidate:
        assert len(candidate.pages) == 3
        assert [int(page.obj.get("/Rotate", 0)) for page in candidate.pages] == [90, 0, 90]
        widths = [float(page.obj["/MediaBox"][2]) for page in candidate.pages]
        assert widths == [303.0, 301.0, 301.0]


def test_program_contract_rejects_code_paths_and_unknown_fields():
    invalid = [
        {"schema": "retainpdf_page_program_v1", "steps": [{"op": "python", "code": "x"}]},
        {
            "schema": "retainpdf_page_program_v1",
            "steps": [{"op": "select_pages", "pages": [1], "path": "/tmp/x"}],
        },
        {
            "schema": "retainpdf_page_program_v1",
            "steps": [{"op": "rotate_pages", "pages": [1], "degrees": 45}],
        },
    ]
    for program in invalid:
        with pytest.raises(ValueError):
            validate_page_program(program)


def test_canonical_program_is_key_order_independent():
    left = {"schema": "retainpdf_page_program_v1", "steps": [{"op": "select_pages", "pages": [1]}]}
    right = json.loads('{"steps":[{"pages":[1],"op":"select_pages"}],"schema":"retainpdf_page_program_v1"}')
    assert canonical_program_bytes(left) == canonical_program_bytes(right)


def test_visual_validation_proves_reorder_duplicate_and_rotation_semantics(tmp_path):
    source = _visible_source_pdf(tmp_path / "visible-source.pdf")
    candidate = tmp_path / "candidate.pdf"
    program = {
        "schema": "retainpdf_page_program_v1",
        "steps": [
            {"op": "select_pages", "pages": [3, 1, 1]},
            {"op": "rotate_pages", "pages": [1, 3], "degrees": 90},
        ],
    }
    assert build_page_plan(3, program) == [(2, 90), (0, 0), (0, 90)]
    execute_page_program(source, program, candidate)

    report = validate_page_program_visuals(source, candidate, program, max_dimension=256)

    assert report["valid"] is True
    assert report["rendered_page_count"] == 3
    assert report["mismatch_count"] == 0
    assert report["expected_pixels_sha256"] == report["candidate_pixels_sha256"]
    assert report["dropped_source_pages"] == 1
    assert report["duplicated_output_pages"] == 1
    assert report["rotated_output_pages"] == 2


def test_visual_validation_accepts_exact_180_rotation_with_fractional_page_geometry(
    tmp_path,
):
    source = _fractional_visible_source_pdf(tmp_path / "fractional-source.pdf")
    candidate = tmp_path / "candidate.pdf"
    program = {
        "schema": "retainpdf_page_program_v1",
        "steps": [{"op": "rotate_pages", "pages": [1], "degrees": 180}],
    }
    execute_page_program(source, program, candidate)

    report = validate_page_program_visuals(
        source, candidate, program, max_dimension=512
    )

    assert report["valid"] is True
    assert report["mismatch_count"] == 0
    assert report["expected_pixels_sha256"] == report["candidate_pixels_sha256"]


def test_visual_validation_detects_content_tampering_with_same_page_count(tmp_path):
    source = _visible_source_pdf(tmp_path / "visible-source.pdf")
    candidate = tmp_path / "candidate.pdf"
    tampered = tmp_path / "tampered.pdf"
    program = {
        "schema": "retainpdf_page_program_v1",
        "steps": [{"op": "select_pages", "pages": [2, 1]}],
    }
    execute_page_program(source, program, candidate)
    with fitz.open(candidate) as document:
        document[1].insert_text((40, 100), "TAMPERED", fontsize=32, color=(1, 0, 0))
        document.save(tampered)

    report = validate_page_program_visuals(source, tampered, program, max_dimension=256)

    assert report["valid"] is False
    assert report["mismatch_count"] == 1
    assert report["mismatched_pages"] == [2]
    assert report["expected_pixels_sha256"] != report["candidate_pixels_sha256"]
