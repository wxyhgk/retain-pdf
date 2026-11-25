"""目录页拆出的条目（structure_role = toc_entry）进翻译、各自成一条（2026-11-25）。"""

from pathlib import Path

import fitz

from retainpdf_pipeline.ocr.document_schema.adapters import adapt_payload_to_document_v1
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_GENERIC_FLAT_OCR
from retainpdf_pipeline.ocr.document_schema.toc_pages import split_toc_blocks_with_text_layer
from retainpdf_pipeline.render.workflow.source_page_records import extract_text_items as render_extract_text_items
from retainpdf_translation.core.ocr.json_extractor import extract_text_items

ROWS = [("1", "Analyzing the Audience", "1"), ("", "Analyze who your audience is", "3"),
        ("", "References", "13"), ("2", "Balancing Precision", "15")]


def _split_document(*, translate: bool = True):
    text = "\n".join(" ".join(part for part in row if part) for row in ROWS)
    document = adapt_payload_to_document_v1(
        payload={
            "provider": PROVIDER_GENERIC_FLAT_OCR,
            "pages": [{
                "width": 420.0, "height": 600.0, "unit": "pt",
                "blocks": [{
                    "type": "text", "sub_type": "table_of_contents", "bbox": [50, 80, 380, 200], "text": text,
                    "lines": [], "segments": [], "tags": ["table_of_contents"],
                    "derived": {"role": "table_of_contents", "by": "", "confidence": 0.0}, "metadata": {},
                }],
            }],
        },
        document_id="toc-doc",
        provider=PROVIDER_GENERIC_FLAT_OCR,
        source_json_path=Path("/tmp/toc-doc.json"),
    )
    # 通用格式默认不翻目录（provider_non_body）；GLM 之类放行目录的服务商给 translate=True。条目照抄目录块的 policy
    document["pages"][0]["blocks"][0]["policy"] = {"translate": translate, "translate_reason": "test"}
    pdf = fitz.open()
    page = pdf.new_page(width=420, height=600)
    y = 100
    for number, title, label in ROWS:
        if number:
            page.insert_text((60, y), number, fontsize=11)
        page.insert_text((90, y), title, fontsize=11)
        page.insert_text((350, y), label, fontsize=11)
        y += 22
    with pdf:
        assert split_toc_blocks_with_text_layer(document, pdf) == 1
    return document


def test_toc_entries_are_translated_one_by_one():
    document = _split_document()
    for extract in (extract_text_items, render_extract_text_items):
        items = extract(document, 0)
        assert [item.text for item in items] == [
            "1 Analyzing the Audience", "Analyze who your audience is", "References", "2 Balancing Precision"
        ]
        assert [item.item_id for item in items] == ["p001-b000", "p001-b001", "p001-b002", "p001-b003"]


def test_toc_entries_follow_the_provider_policy():
    document = _split_document(translate=False)
    assert extract_text_items(document, 0) == []
