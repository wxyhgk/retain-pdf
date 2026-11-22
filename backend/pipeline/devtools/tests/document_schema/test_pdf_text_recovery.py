import fitz

from retainpdf_pipeline.ocr.document_schema.pdf_text_recovery import recover_corrupted_pdf_text, _line_text


def test_recovers_only_matching_corrupted_ocr_text():
    with fitz.open() as pdf:
        page=pdf.new_page(width=500,height=200)
        page.insert_text((20,60),'The parameter beta determines the loss.',fontsize=12)
        damaged=dict(text='The parameter \ufffd determines the loss.',bbox=[15,40,400,70])
        unrelated=dict(text='Unrelated \ufffd text from a different region.',bbox=[15,40,400,70])
        doc={'pages':[{'blocks':[damaged,unrelated]}]}
        assert recover_corrupted_pdf_text(doc,pdf)==1
        assert 'beta' in damaged['text']
        assert '\ufffd' in unrelated['text']


def test_embedded_math_preserves_greek_letters_and_subscript_baseline():
    line={'spans':[dict(text='𝜉',size=10,origin=(0,20)),
                   dict(text='(',size=10,origin=(5,20)),
                   dict(text='𝑙',size=10,origin=(8,20)),
                   dict(text='𝑥',size=7,origin=(12,23)),
                   dict(text=')',size=10,origin=(15,20))]}
    text=_line_text(line)
    assert r'\xi' in text and 'l_{x}' in text


def _document_with_corrupted_block(tmp_path):
    """真实流程：通用 OCR 结果 → document.v1（content、segments 都建好）→ 换到 PDF 坐标时顺带恢复乱码。"""
    from pathlib import Path

    from retainpdf_pipeline.ocr.document_schema.adapters import adapt_payload_to_document_v1
    from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_GENERIC_FLAT_OCR

    pdf_path = tmp_path / "source.pdf"
    with fitz.open() as pdf:
        page = pdf.new_page(width=400, height=300)
        page.insert_text((22, 60), "Light falls on the photoresistors in the circuit.", fontsize=11)
        pdf.save(pdf_path)
    damaged = "Light falls on the photore�sistors in the circuit."
    payload = {
        "provider": PROVIDER_GENERIC_FLAT_OCR,
        "pages": [{
            "width": 400.0, "height": 300.0, "unit": "pt",
            "blocks": [{
                "type": "text", "sub_type": "body", "bbox": [20, 48, 330, 64], "text": damaged,
                "lines": [{"bbox": [20, 48, 330, 64], "spans": [{"type": "text", "raw_type": "text", "text": damaged, "bbox": [20, 48, 330, 64]}]}],
                "segments": [{"type": "text", "raw_type": "text", "text": damaged, "bbox": [20, 48, 330, 64]}],
                "tags": [], "derived": {"role": "", "by": "", "confidence": 0.0}, "metadata": {},
            }],
        }],
    }
    document = adapt_payload_to_document_v1(
        payload=payload, provider=PROVIDER_GENERIC_FLAT_OCR, document_id="recover", source_json_path=Path("/tmp/recover.json"),
    )
    return document, pdf_path


def test_recovered_text_keeps_the_document_valid(tmp_path):
    """11-22 一本 583 页的书第 480 页的一块：恢复只改了 text，content.text 还是乱码，校验判"两份不一样"，整个任务失败。"""
    from retainpdf_pipeline.ocr.document_schema.pdf_geometry import rescale_document_geometry_to_pdf
    from retainpdf_pipeline.ocr.document_schema.validator import validate_document_payload

    document, pdf_path = _document_with_corrupted_block(tmp_path)
    rescale_document_geometry_to_pdf(document, pdf_path)
    block = document["pages"][0]["blocks"][0]
    assert block["metadata"].get("pdf_text_recovered") is True
    assert "photoresistors" in block["text"] and "�" not in block["text"]
    # 翻译读的是 content.text：它也要是恢复后的
    assert block["content"]["text"] == block["text"]
    assert all("�" not in line for line in block["content"].get("line_texts", []))
    assert all("�" not in segment["text"] for segment in block["segments"])
    validate_document_payload(document)


def test_image_only_pdf_keeps_the_ocr_text_and_stays_valid(tmp_path):
    """扫描件（没有文字层）：读不到可以替换的字，OCR 原文（带乱码）原样留着，文档照样有效，任务不失败。"""
    from retainpdf_pipeline.ocr.document_schema.pdf_geometry import rescale_document_geometry_to_pdf
    from retainpdf_pipeline.ocr.document_schema.validator import validate_document_payload

    document, pdf_path = _document_with_corrupted_block(tmp_path)
    with fitz.open() as pdf:   # 同样大小的空白页：没有文字层
        pdf.new_page(width=400, height=300)
        pdf.save(pdf_path)
    rescale_document_geometry_to_pdf(document, pdf_path)
    block = document["pages"][0]["blocks"][0]
    assert "pdf_text_recovered" not in block["metadata"]
    assert "�" in block["text"] and block["content"]["text"] == block["text"]
    validate_document_payload(document)
