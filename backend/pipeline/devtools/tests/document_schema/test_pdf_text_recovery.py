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


def test_keeps_unknown_character_when_symbol_is_a_vector_path_or_scan():
    with fitz.open() as pdf:
        page = pdf.new_page(width=240, height=90)
        page.insert_text((35, 52), "Let    be a training image.")
        # The letter I is visible, but only as vector strokes.
        page.draw_line((54, 44), (54, 52))
        scan_image = page.get_pixmap()
        scan = pdf.new_page(width=240, height=90)
        scan.insert_image(scan.rect, pixmap=scan_image)
        damaged = "Let \ufffd be a training image."
        pages = [
            {"blocks": [{"text": damaged, "bbox": [30, 35, 230, 60],
                         "content": {"kind": "text", "text": damaged}}]}
            for _ in pdf
        ]

        assert recover_corrupted_pdf_text({"pages": pages}, pdf) == 0
        assert [p["blocks"][0]["content"]["text"] for p in pages] == [damaged, damaged]


def test_visual_ocr_recovers_scan_and_path_without_rewriting_surrounding_text(monkeypatch):
    from retainpdf_pipeline.ocr.ocr_provider import glm_ocr_api
    from retainpdf_pipeline.ocr.ocr_provider.visual_recovery import configured_crop_recognizer

    responses = iter(("Let $I$ be a training image.", "Let $I$ be a training image.",
                      "Let $J$ be a testing image."))
    calls = []

    def recognize(pdf_bytes, **kwargs):
        assert kwargs["api_key"] == "test-key"
        with fitz.open(stream=pdf_bytes, filetype="pdf") as crop:
            assert len(crop) == 1 and crop[0].get_images() and not crop[0].get_text().strip()
            assert crop[0].rect.height < 300  # just the affected paragraph
        calls.append(pdf_bytes)
        response = next(responses)
        if len(calls) == 2:
            return {"layout_details": [[
                {"native_label": "text", "content": "Let"},
                {"native_label": "display_formula", "content": "$$\nI\n$$"},
                {"native_label": "text", "content": "be a training image."},
            ]]}
        return {"layout_details": [[{"native_label": "text", "content": response}]]}

    monkeypatch.setenv("RETAIN_VISUAL_OCR_API_KEY", "test-key")
    monkeypatch.setenv("RETAIN_VISUAL_OCR_PROVIDER", "glm_ocr")
    monkeypatch.setattr(glm_ocr_api, "parse_pdf", recognize)
    with fitz.open() as pdf:
        selectable = pdf.new_page(width=240, height=90)
        selectable.insert_text((35, 52), "Let I be a training image.")
        raster = selectable.get_pixmap()
        scan = pdf.new_page(width=240, height=90)
        scan.insert_image(scan.rect, pixmap=raster)
        for stroke_width in (1, 2):
            path = pdf.new_page(width=240, height=90)
            path.insert_text((35, 52), "Let    be a training image.")
            path.draw_line((54, 44), (54, 52), width=stroke_width)
        damaged = "Let \ufffd be a training image."

        def blocks():
            return [
                {"blocks": [{"text": damaged, "bbox": [30, 35, 230, 60],
                             "content": {"kind": "text", "text": damaged, "line_texts": [damaged]}}]}
                for _ in pdf
            ]

        recognizer = configured_crop_recognizer()
        for _ in range(2):  # prefixes and the final pass reuse the same crops
            pages = blocks()
            assert recover_corrupted_pdf_text({"pages": pages}, pdf, recognize_crop=recognizer) == 3
            result = [p["blocks"][0] for p in pages]
            expected = ["Let I be a training image.", "Let $I$ be a training image.",
                        "Let $I$ be a training image.", damaged]
            assert [b["content"]["text"] for b in result] == expected
            assert [b["content"]["line_texts"][0] for b in result] == expected
            assert ["visual_ocr_recovered" in b.get("metadata", {}) for b in result] == [False, True, True, False]
        assert len(calls) == 3


def test_visual_ocr_is_opt_in_and_stops_after_a_service_error(monkeypatch):
    from retainpdf_pipeline.ocr.ocr_provider import glm_ocr_api
    from retainpdf_pipeline.ocr.ocr_provider.visual_recovery import configured_crop_recognizer

    monkeypatch.delenv("RETAIN_VISUAL_OCR_API_KEY", raising=False)
    assert configured_crop_recognizer() is None
    monkeypatch.setenv("RETAIN_VISUAL_OCR_API_KEY", "test-key")
    monkeypatch.setenv("RETAIN_VISUAL_OCR_PROVIDER", "glm_ocr")
    request = Mock(side_effect=glm_ocr_api.GlmOcrRequestRejected("rejected"))
    monkeypatch.setattr(glm_ocr_api, "parse_pdf", request)
    with fitz.open() as pdf:
        page = pdf.new_page(width=100, height=50)
        png = page.get_pixmap().tobytes("png")
        recognize = configured_crop_recognizer()
        assert recognize(png) is None
        page.draw_line((5, 5), (10, 10))
        assert recognize(page.get_pixmap().tobytes("png")) is None
        assert recognize(png) is None
        assert request.call_count == 1


def test_mineru_visual_transport_reads_only_the_single_crop_result(monkeypatch):
    import json
    from retainpdf_pipeline.ocr.mineru_provider import artifacts, submission
    from retainpdf_pipeline.ocr.ocr_provider.visual_recovery import _mineru_crop

    def submit(**kwargs):
        assert kwargs["enable_formula"] and kwargs["is_ocr"]
        assert not kwargs["enable_table"]
        assert kwargs["file_path"].read_bytes() == b"%PDF-crop"
        return {"data": {"full_zip_url": "https://example.com/result.zip"}}

    def download(**kwargs):
        path = kwargs["unpack_dir"]
        path.mkdir()
        (path / "crop_content_list.json").write_text(json.dumps([
            {"type": "text", "text": "Let", "page_idx": 0},
            {"type": "equation", "text": "$$I$$", "page_idx": 0},
            {"type": "text", "text": "be a training image.", "page_idx": 0},
        ]), encoding="utf-8")

    monkeypatch.setattr(submission, "run_local_extract_task", submit)
    monkeypatch.setattr(artifacts, "download_and_unpack_bundle", download)
    assert _mineru_crop(b"%PDF-crop", "test-key") == "Let $I$ be a training image."


def test_visual_matching_preserves_intact_formulas_and_rejects_missing_or_changed_context():
    from retainpdf_pipeline.ocr.document_schema.visual_text_recovery import visual_replacements

    original = r"Let � be a training image and q \in I be a pixel."
    segments = [{"type": "inline_formula", "text": r"q \in I"}]
    recognized = r"Let $I$ be a training image and $q\in I$ be a pixel."
    assert visual_replacements(original, recognized, segments=segments) == ["$I$"]
    assert visual_replacements(original, recognized.replace("training", "testing"), segments=segments) == []
    assert visual_replacements(original, recognized.replace("$I$", ""), segments=segments) == []
    assert visual_replacements(original, recognized.replace(r"$q\in I$", r"$q\in J$"), segments=segments) == []
    assert visual_replacements("Let $�$ be a training image.", "Let $I$ be a training image.") == []
    original = r"Let � be a training image with loss \mathrm { C E } _ { I }."
    formula = {"type": "inline_formula", "text": r"\mathrm { C E } _ { I }"}
    assert visual_replacements(
        original, r"Let $I$ be a training image with loss $\mathrm{CE}_I$.", segments=[formula]
    ) == ["$I$"]


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
