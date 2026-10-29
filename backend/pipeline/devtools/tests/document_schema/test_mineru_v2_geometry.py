from copy import deepcopy
from pathlib import Path

import fitz
import pytest

from retainpdf_pipeline.ocr.document_schema.adapters import adapt_payload_to_document_v1
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_MINERU_CONTENT_LIST_V2
from retainpdf_pipeline.ocr.document_schema.validator import DocumentSchemaValidationError, validate_document_payload
from retainpdf_pipeline.ocr.document_schema.pdf_geometry import rescale_document_geometry_to_pdf


def adapt(payload):
    return adapt_payload_to_document_v1(
        payload=payload, provider=PROVIDER_MINERU_CONTENT_LIST_V2,
        document_id="v2-geometry", source_json_path=Path("fixture_content_list_v2.json"),
    )


def paragraph(bbox):
    return {"type": "paragraph", "bbox": bbox,
            "content": {"paragraph_content": [{"type": "text", "content": "Margin fixture"}]}}


@pytest.mark.parametrize("width,height", [(600, 800), (800, 600), (612, 792)])
def test_v2_preserves_page_margins_and_all_geometry_levels(tmp_path, width, height):
    payload = [[paragraph([100, 200, 800, 700])], [], [paragraph([0, 0, 1000, 1000])]]
    original = deepcopy(payload)
    document = adapt(payload)
    assert all((p["width"], p["height"]) == (1000, 1000) for p in document["pages"])
    pdf_path = tmp_path / "geometry.pdf"
    with fitz.open() as pdf:
        for index, _ in enumerate(payload):
            page = pdf.new_page(width=width, height=height)
            if index == 0:
                page.draw_rect(fitz.Rect(width * .1, height * .2, width * .8, height * .7))
                page.insert_text((width * .1 + 8, height * .2 + 20), "Margin fixture")
        pdf.save(pdf_path)
    rescale_document_geometry_to_pdf(document, pdf_path)
    validate_document_payload(document)
    assert payload == original, "normalization does not mutate provider facts"
    assert document["derived"]["coordinate_space"] == "pdf_point"
    assert all((p["width"], p["height"]) == (width, height) for p in document["pages"])
    block = document["pages"][0]["blocks"][0]
    expected = [width * .1, height * .2, width * .8, height * .7]
    boxes = [block["bbox"], block["geometry"]["bbox"]]
    boxes += [line["bbox"] for line in block["lines"]]
    boxes += [span["bbox"] for line in block["lines"] for span in line["spans"]]
    boxes += [segment["bbox"] for segment in block["segments"]]
    for box in boxes:
        assert box == pytest.approx(expected, abs=.002)
    assert block["source"]["raw_bbox"] == [100, 200, 800, 700]
    assert document["pages"][1]["blocks"] == []
    assert document["pages"][2]["blocks"][0]["bbox"] == [0, 0, width, height]
    once = deepcopy(document)
    rescale_document_geometry_to_pdf(document, pdf_path)
    assert document == once, "rescaling an already normalized document is idempotent"


def test_v2_sparse_and_missing_boxes_do_not_define_page_size():
    document = adapt([[], [paragraph([10, 20, 30, 40])]])
    assert [(p["width"], p["height"]) for p in document["pages"]] == [(1000, 1000)] * 2
    with pytest.raises(DocumentSchemaValidationError, match="positive-area rectangle"):
        adapt([[paragraph([])]])
