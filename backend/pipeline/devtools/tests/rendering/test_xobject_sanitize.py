from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import pikepdf
from pikepdf import Name


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.render.source.preparation.xobject_sanitize import build_invalid_xobject_sanitized_pdf_copy


def test_invalid_zero_sized_image_xobject_is_replaced_with_empty_form() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "sanitized.pdf"
        _write_pdf_with_zero_sized_image_xobject(source_pdf)

        result = build_invalid_xobject_sanitized_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
        )

        assert result.changed is True
        assert result.invalid_image_xobjects == 1
        assert result.pages_changed == 1

        with pikepdf.Pdf.open(output_pdf) as pdf:
            xobjects = pdf.pages[0].obj[Name("/Resources")][Name("/XObject")]
            replacement = xobjects[Name("/ImBad")]
            assert replacement[Name("/Subtype")] == Name("/Form")
            assert list(replacement[Name("/BBox")]) == [0, 0, 0, 0]


def test_valid_image_xobject_does_not_create_sanitized_copy() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "sanitized.pdf"
        _write_pdf_with_valid_image_xobject(source_pdf)

        result = build_invalid_xobject_sanitized_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
        )

        assert result.changed is False
        assert output_pdf.exists() is False


def _write_pdf_with_zero_sized_image_xobject(path: Path) -> None:
    with pikepdf.Pdf.new() as pdf:
        page = pdf.add_blank_page(page_size=(100, 100))
        image = pdf.make_stream(b"")
        image[Name("/Type")] = Name("/XObject")
        image[Name("/Subtype")] = Name("/Image")
        image[Name("/Width")] = 0
        image[Name("/Height")] = 0
        image[Name("/ColorSpace")] = Name("/DeviceGray")
        image[Name("/BitsPerComponent")] = 8
        page.obj[Name("/Resources")] = pikepdf.Dictionary(
            {"/XObject": pikepdf.Dictionary({"/ImBad": image})}
        )
        pdf.save(path)


def _write_pdf_with_valid_image_xobject(path: Path) -> None:
    with pikepdf.Pdf.new() as pdf:
        page = pdf.add_blank_page(page_size=(100, 100))
        image = pdf.make_stream(b"\x00")
        image[Name("/Type")] = Name("/XObject")
        image[Name("/Subtype")] = Name("/Image")
        image[Name("/Width")] = 1
        image[Name("/Height")] = 1
        image[Name("/ColorSpace")] = Name("/DeviceGray")
        image[Name("/BitsPerComponent")] = 8
        page.obj[Name("/Resources")] = pikepdf.Dictionary(
            {"/XObject": pikepdf.Dictionary({"/ImOk": image})}
        )
        pdf.save(path)
