from unittest.mock import Mock

import fitz

from retainpdf_pipeline.ocr.document_schema.pdf_text_recovery import (
    _line_text,
    _recover_math_runs,
    recover_corrupted_pdf_text,
)


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


def test_recovers_math_glyph_in_all_text_projections_without_rebuilding_formulas():
    from retainpdf_pipeline.ocr.document_schema.pdf_geometry import rebuild_estimated_text_geometry
    from retainpdf_translation.core.ocr.json_extractor import block_source_text

    embedded_line = {"spans": [{"text": "Let 𝐼 be a training image and 𝑍=√𝑎2+𝑏2."}]}
    page = Mock()
    page.get_text.return_value = {"blocks": [{"lines": [embedded_line]}]}
    prose = "Let \ufffd be a training image and"
    formula = r"Z = \sqrt{a^2 + b^2}"
    text = f"{prose} {formula}."
    bbox = [15, 45, 200, 68]
    segments = [
        {"type": "text", "text": prose, "bbox": [15, 45, 130, 68]},
        {"type": "inline_formula", "text": formula, "bbox": [131, 45, 199, 68]},
    ]
    block = {
        "type": "text", "text": text, "bbox": bbox,
        "geometry": {"bbox": bbox},
        "content": {"kind": "text", "text": text, "line_texts": [text]},
        "segments": segments,
        "lines": [{"bbox": bbox, "bbox_precision": "provider_layout",
                   "spans": [dict(segment) for segment in segments]}],
    }
    document = {"pages": [{"blocks": [block]}]}
    assert recover_corrupted_pdf_text(document, [page]) == 1
    rebuild_estimated_text_geometry(document)

    expected_prose = "Let $I$ be a training image and"
    expected = f"{expected_prose} {formula}."
    assert block_source_text(block, []) == expected
    assert block["text"] == expected and block["content"]["line_texts"] == [expected]
    assert block["lines"][0]["spans"] == block["segments"]
    assert block["segments"][0]["text"] == expected_prose
    assert block["segments"][1]["text"] == formula
    assert block["segments"][1]["bbox"] == [131, 45, 199, 68]


def test_recovers_missing_math_identifier_only_with_a_matching_context_and_subscript():
    line = {"spans": [
        {"text": "Update the loss ", "size": 8, "origin": (0, 10)},
        {"text": "𝐹𝑜𝑢𝑟𝑖𝑒𝑟𝐿𝑜𝑠𝑠", "size": 8, "origin": (80, 10)},
        {"text": "𝐼", "size": 6, "origin": (135, 12)},
        {"text": " using the current weights.", "size": 8, "origin": (140, 10)},
    ]}
    context = "Update the loss " + "\ufffd" * 11 + " using the current weights."
    assert _recover_math_runs(context, [line]) == ["$FourierLoss_{I}$"]
    assert _recover_math_runs(context, [line, line]) == []
    assert _recover_math_runs(context.replace("current", "previous"), [line]) == []
    line["spans"][2]["origin"] = (135, 10)
    assert _recover_math_runs(context, [line]) == []
