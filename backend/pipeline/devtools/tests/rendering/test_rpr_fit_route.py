"""render.engine = rpr_fit：字号由引擎按测量决定的路线（假引擎 rendering_support/fake_rpr_engine.py）。"""

from __future__ import annotations

import json
from pathlib import Path

import fitz
import pytest

from devtools.tests.rendering_support.fake_rpr_engine import FAKE_ENGINE_VERSION
from devtools.tests.rendering_support.fake_rpr_engine import install_fake_rpr_engine
from retainpdf_pipeline.foundation.shared.stage_specs import normalize_render_engine
from retainpdf_pipeline.render.output.rpr_fit.report import build_rpr_fit_fit_report_payload
from retainpdf_pipeline.render.prepare.obstacle_scan_pdf import extract_drawings
from retainpdf_pipeline.render.output.typst.fit_report import fit_report_scope
from retainpdf_pipeline.render.workflow import engine_dispatch
from retainpdf_pipeline.render.workflow.context import RenderExecutionContext
from retainpdf_pipeline.render.workflow.engine_dispatch import dispatch_with_render_engine
from retainpdf_pipeline.render.workflow.engine_dispatch import render_engine_summary
from retainpdf_translation.services.quality.qa.fit import check_fit_report


def _job(tmp_path: Path, *, texts: tuple[str, str] = ("译文 $x^2$ 正文", "第二页译文")) -> tuple[Path, Path, dict[int, list[dict]]]:
    source_pdf = tmp_path / "source.pdf"
    doc = fitz.open()
    for index in range(3):
        page = doc.new_page(width=300, height=400)
        page.insert_text((20, 50), f"source text {index}", fontsize=12)
        page.draw_line((20, 200), (280, 200))
    doc.set_toc([[1, "Chapter", 1]])
    doc.save(source_pdf)
    doc.close()
    document_path = tmp_path / "document.v1.json"
    document_path.write_text(
        json.dumps(
            {
                "schema": "normalized_document_v1",
                "pages": [
                    {
                        "page_index": index,
                        "width": 300,
                        "height": 400,
                        "blocks": [
                            {"block_id": f"p{index + 1:03d}-b0001", "type": "text", "sub_type": "body", "bbox": [10, 30, 280, 80], "lines": []},
                        ],
                    }
                    for index in range(3)
                ]
            }
        ),
        encoding="utf-8",
    )
    translated = {
        index: [
            {
                "item_id": f"p{index + 1:03d}-b001",
                "page_idx": index,
                "block_idx": 1,
                "policy_translate": True,
                "source_text": f"source text {index}",
                "translated_text": texts[index],
                "lines": [],
            }
        ]
        for index in range(2)
    }
    return source_pdf, document_path, translated


def _dispatch(context, *, mode: str, source_pdf_path: Path, translated_pages):
    typst_calls: list[str] = []

    def typst_dispatch():
        typst_calls.append(mode)
        return 1, {"mode": mode}

    pages, diagnostics = dispatch_with_render_engine(
        mode=mode,
        source_pdf_path=source_pdf_path,
        translated_pages=translated_pages,
        context=context,
        extract_selected_pages=False,
        typst_dispatch=typst_dispatch,
        compress_final=lambda ctx, label: False,
        fast_save=True,
    )
    return pages, diagnostics, typst_calls


def _context(tmp_path: Path, **overrides) -> RenderExecutionContext:
    values = dict(output_pdf_path=tmp_path / "out.pdf", start_page=0, end_page=1, render_engine="rpr_fit")
    values.update(overrides)
    return RenderExecutionContext(**values)


def test_rpr_fit_is_a_known_engine() -> None:
    assert normalize_render_engine(" RPR_FIT ") == "rpr_fit"


@pytest.mark.parametrize("mode", ["overlay", "typst", "typst_visual"])
def test_rpr_fit_route_end_to_end_with_fake_engine(tmp_path: Path, monkeypatch, mode: str) -> None:
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    source_pdf, document_path, translated = _job(tmp_path, texts=("译文 SHRINK", "第二页 OVERFLOW"))
    context = _context(tmp_path, document_path=document_path, indent_detection_pdf_path=source_pdf)
    report_path = tmp_path / "artifacts" / "fit_report.v1.json"
    with fit_report_scope(report_path):
        pages, diagnostics, calls = _dispatch(context, mode=mode, source_pdf_path=source_pdf, translated_pages=translated)
    assert calls == [], diagnostics.get("render_engine_fallback_message")
    assert pages == 2
    assert diagnostics["render_engine"] == "rpr_fit"
    assert diagnostics["rpr_engine_version"] == FAKE_ENGINE_VERSION

    # 引擎拿到的是任务自己的数据：document.v1、译文条目、要渲染的页、底图的矢量图形。
    work = Path(diagnostics["rpr_work_dir"])
    payload = json.loads((work / "rpr-fit-input.json").read_text(encoding="utf-8"))
    assert payload["schema"] == "rpr_fit_input_v1"
    assert payload["pages"] == [0, 1]
    assert Path(payload["document_path"]) == document_path.resolve()
    items = json.loads((work / "translations.json").read_text(encoding="utf-8"))
    assert [item["item_id"] for item in items] == ["p001-b001", "p002-b001"]
    drawings = json.loads((work / "drawings.json").read_text(encoding="utf-8"))
    assert sorted(drawings) == ["0", "1"]
    assert drawings["0"]["drawings"], "the source's vector line is passed on as an obstacle candidate"

    output = fitz.open(context.output_pdf_path)
    try:
        # overlay：原件全部页（第 3 页原样）+ 目录；typst 系：只输出要渲染的页。
        assert len(output) == (3 if mode == "overlay" else 2)
        assert "FIT" in output[0].get_text()
        if mode == "overlay":
            assert output.get_toc() == [[1, "Chapter", 1]]
    finally:
        output.close()

    fit_report = json.loads(report_path.read_text(encoding="utf-8"))
    assert fit_report["status"] == "ok"
    assert fit_report["source"]["measurement"] == "rpr_fit_engine"
    by_item = {block["item_id"]: block for block in fit_report["blocks"]}
    assert by_item["p001-b001"]["tier"] == "shrink" and by_item["p001-b001"]["final_font_size"] == 9.5
    assert by_item["p002-b001"]["overflow"] is True and by_item["p002-b001"]["page"] == 2
    assert fit_report["summary"]["overflow_item_ids"] == ["p002-b001"]
    assert fit_report["invariants"]["line_overlaps"] == 0
    # 渲染后 QA 照常能读：溢出的那块报 layout_overflow
    qa_summary, violations = check_fit_report(report_path, {})
    assert qa_summary["status"] == "ok" and qa_summary["overflow_count"] == 1
    assert "layout_overflow" in [violation.type for violation in violations]

    summary = render_engine_summary(requested="rpr_fit", diagnostics=diagnostics)
    assert summary["effective"] == "rpr_fit" and summary["requested"] == "rpr_fit"
    assert summary["invariants"]["line_overlaps"] == 0
    assert summary["body_font"]["shared"] == 10.0


@pytest.mark.parametrize("mode", ["overlay", "typst", "typst_visual"])
def test_rpr_fit_keeps_a_page_with_nothing_to_translate(tmp_path: Path, monkeypatch, mode: str) -> None:
    # A page in the job with no translation items (a whole-page figure, code, references kept as they are) stays in the
    # translated PDF as it is: dropped, the translation had fewer pages than the source and the side-by-side reader
    # went out of step from there (a 481-page book came out with 469, 2026-11-02).
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    source_pdf, document_path, translated = _job(tmp_path)
    translated = {0: [], 1: translated[1], 2: []}
    context = _context(tmp_path, document_path=document_path, indent_detection_pdf_path=source_pdf, end_page=2)
    pages, diagnostics, calls = _dispatch(context, mode=mode, source_pdf_path=source_pdf, translated_pages=translated)
    assert calls == [], diagnostics.get("render_engine_fallback_message")
    assert pages == 3
    payload = json.loads((Path(diagnostics["rpr_work_dir"]) / "rpr-fit-input.json").read_text(encoding="utf-8"))
    assert payload["pages"] == [1], "the engine lays out only the pages with something to translate"
    assert diagnostics["rpr_pages"] == 1
    assert diagnostics["rpr_fit_untranslated_pages"] == 2
    output = fitz.open(context.output_pdf_path)
    try:
        assert len(output) == 3
        # Each page where it was: the untranslated ones as they are, the engine's layer (the fake engine's FIT) on the second.
        assert [("source text " + str(index)) in page.get_text() for index, page in enumerate(output)] == [True, True, True]
        assert ["FIT" in page.get_text() for page in output] == [False, True, False]
    finally:
        output.close()


@pytest.mark.parametrize("mode", ["overlay", "typst"])
def test_a_block_whose_formula_did_not_render_keeps_the_original(tmp_path: Path, monkeypatch, mode: str) -> None:
    # 481 页的书第 379 页（2026-11-02）：`$` 不成对，引擎没把它当公式，也不报，整段 LaTeX 印在页面上，
    # 原来的图被盖掉。另一种是 MathJax 报错（`Misplaced &`），引擎同样原样印出 tex。
    # 这两种块改成保留原文、引擎重排一次，原件的那一块盖回去。
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    source_pdf, document_path, translated = _job(tmp_path, texts=("RAWTEX \\frac{a}{b} end", "MJFAIL $x^{2} & y$"))
    for page_items in translated.values():
        page_items[0]["bbox"] = [10, 30, 280, 80]
    context = _context(tmp_path, document_path=document_path, indent_detection_pdf_path=source_pdf)
    report_path = tmp_path / "artifacts" / "fit_report.v1.json"
    with fit_report_scope(report_path):
        pages, diagnostics, calls = _dispatch(context, mode=mode, source_pdf_path=source_pdf, translated_pages=translated)
    assert calls == [], diagnostics.get("render_engine_fallback_message")
    check = diagnostics["rpr_fit_formula_check"]
    assert [(entry["item_id"], entry["reasons"]) for entry in check["kept_origin"]] == [
        ("p001-b001", ["visible_latex"]),
        ("p002-b001", ["mathjax_failed", "visible_latex"]),
    ]
    assert check["remaining"] == [] and check["mathjax_failed"] == 1
    # 重排时这两块交给引擎的是空的（保留元素）
    work = Path(diagnostics["rpr_work_dir"])
    items = json.loads((work / "translations.json").read_text(encoding="utf-8"))
    assert [item["translated_text"] for item in items] == ["", ""]
    output = fitz.open(context.output_pdf_path)
    try:
        for index in (0, 1):
            text = output[index].get_text()
            assert "\\frac" not in text and "x^{2}" not in text, text
            assert f"source text {index}" in text, "the original block is back"
    finally:
        output.close()
    fit_report = json.loads(report_path.read_text(encoding="utf-8"))
    assert fit_report["summary"]["math_failed"] == 1
    assert fit_report["summary"]["math_kept_origin"] == 2
    assert fit_report["summary"]["math_visible_latex"] == 0
    assert [entry["item_id"] for entry in fit_report["math"]["kept_origin"]] == ["p001-b001", "p002-b001"]


def test_formulas_that_rendered_need_no_second_pass(tmp_path: Path, monkeypatch) -> None:
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    source_pdf, document_path, translated = _job(tmp_path)
    context = _context(tmp_path, document_path=document_path, indent_detection_pdf_path=source_pdf)
    _pages, diagnostics, _calls = _dispatch(context, mode="typst", source_pdf_path=source_pdf, translated_pages=translated)
    check = diagnostics["rpr_fit_formula_check"]
    assert check["kept_origin"] == [] and check["remaining"] == []
    assert not (Path(diagnostics["rpr_work_dir"]) / "out-formula-kept").exists()


def test_visible_latex_ignores_the_invisible_copy_layer_and_plain_dollars(tmp_path: Path) -> None:
    from retainpdf_pipeline.render.output.rpr_fit.formula_check import visible_latex_spans

    path = tmp_path / "page.pdf"
    with fitz.open() as document:
        page = document.new_page(width=300, height=200)
        page.insert_text((20, 40), "price $22.00 and FORTRAN $ E(1,1)=F(1,1)", fontsize=8)
        page.insert_text((20, 80), "\\frac{a}{b}", fontsize=8, render_mode=3)  # 公式旁边的复制层
        page.insert_text((20, 120), "x_{i} printed raw", fontsize=8)
        document.save(path)
    with fitz.open(path) as document:
        assert [text for _rect, text in visible_latex_spans(document[0])] == ["x_{i} printed raw"]


def test_visible_latex_the_engine_reshaped_is_matched_by_the_box(tmp_path: Path) -> None:
    # 引擎印出来的字和交给它的不完全一样（2026-11-02 一份电子版的矩阵：`\\begin{array}` 被预处理删了），
    # 按文字对不上，按框对：落在哪个条目的框里就是哪个。
    from retainpdf_pipeline.render.output.rpr_fit.formula_check import failed_formula_items

    path = tmp_path / "out.pdf"
    with fitz.open() as document:
        page = document.new_page(width=300, height=400)
        page.insert_text((20, 150), "\\left( 3 & 2 i \\right)", fontsize=8)
        document.save(path)
    items = [
        {"item_id": "p001-b000", "page_idx": 0, "translated_text": "上面一段"},
        {"item_id": "p001-b001", "page_idx": 0, "translated_text": "矩阵 $\\left(\\begin{array}{cc} 3 & 2i \\end{array}\\right)$"},
        {"item_id": "p001-b002", "page_idx": 0, "translated_text": ""},
    ]
    bboxes = {"p001-b000": [10, 20, 290, 100], "p001-b001": [10, 120, 290, 200], "p001-b002": [10, 120, 290, 200]}
    found = failed_formula_items(path, output_pages={0: 0}, items=items, bboxes=bboxes, mathjax_failed=[])
    assert found == {"p001-b001": ["visible_latex"]}, "an item with nothing to lay out is not a candidate"


def _indented_job(tmp_path: Path) -> tuple[Path, Path, dict[int, list[dict]]]:
    """一页三行的正文段，文字层里首行比其余行靠右 20pt（和 Word 排的论文一样）。"""
    source_pdf = tmp_path / "source.pdf"
    doc = fitz.open()
    page = doc.new_page(width=300, height=400)
    for index, x in enumerate((50, 30, 30)):
        page.insert_text((x, 60 + index * 16), "source paragraph line with enough words", fontsize=10)
    doc.save(source_pdf)
    doc.close()
    block = {"block_id": "p001-b0001", "type": "text", "sub_type": "body", "bbox": [28, 48, 280, 98], "lines": []}
    document_path = tmp_path / "document.v1.json"
    document_path.write_text(
        json.dumps({"schema": "normalized_document_v1", "pages": [{"page_index": 0, "width": 300, "height": 400, "blocks": [block]}]}),
        encoding="utf-8",
    )
    item = {
        "item_id": "p001-b001",
        "page_idx": 0,
        "block_idx": 1,
        "block_type": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "bbox": [28, 48, 280, 98],
        "policy_translate": True,
        "source_text": "source paragraph line with enough words " * 3,
        "translated_text": "译文正文段落",
        "lines": [],
    }
    return source_pdf, document_path, {0: [item]}


def _engine_items(diagnostics: dict) -> list[dict]:
    return json.loads((Path(diagnostics["rpr_work_dir"]) / "translations.json").read_text(encoding="utf-8"))


def test_rpr_fit_passes_the_first_line_indent_read_from_the_text_layer(tmp_path: Path, monkeypatch) -> None:
    """引擎只能从 OCR 行框估缩进（Paddle、GLM 只有块级框），以前可编辑 PDF 一个缩进都没有：
    retain-pdf 读原 PDF 文字层量好，随译文条目交给引擎。"""
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    source_pdf, document_path, translated = _indented_job(tmp_path)
    context = _context(tmp_path, end_page=0, document_path=document_path, indent_detection_pdf_path=source_pdf)
    _pages, diagnostics, calls = _dispatch(context, mode="overlay", source_pdf_path=source_pdf, translated_pages=translated)
    assert calls == [], diagnostics.get("render_engine_fallback_message")
    [entry] = _engine_items(diagnostics)
    assert entry["first_line_indent_pt"] == pytest.approx(20, abs=0.5)
    assert diagnostics["rpr_fit_indent_source"] == "computed"
    assert diagnostics["rpr_fit_indented_blocks"] == 1


def test_rpr_fit_uses_the_prewarmed_indents_and_survives_a_failed_measurement(tmp_path: Path, monkeypatch) -> None:
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    source_pdf, document_path, translated = _indented_job(tmp_path)
    prewarmed = _context(
        tmp_path, end_page=0, document_path=document_path, indent_detection_pdf_path=source_pdf,
        first_line_indent_lookup={"p001-b001": 12.5},
    )
    _pages, diagnostics, _calls = _dispatch(prewarmed, mode="overlay", source_pdf_path=source_pdf, translated_pages=translated)
    assert _engine_items(diagnostics)[0]["first_line_indent_pt"] == 12.5
    assert diagnostics["rpr_fit_indent_source"] == "prewarm"

    def broken(**_kwargs):
        raise ValueError("boom")

    monkeypatch.setattr(engine_dispatch, "build_payload_geometry", broken)
    context = _context(tmp_path, end_page=0, document_path=document_path, indent_detection_pdf_path=source_pdf)
    _pages, diagnostics, calls = _dispatch(context, mode="overlay", source_pdf_path=source_pdf, translated_pages=translated)
    assert calls == [], "缩进算失败不回退 Typst"
    assert "first_line_indent_pt" not in _engine_items(diagnostics)[0]
    assert diagnostics["rpr_fit_indent_source"] == "failed"


def test_rpr_fit_engine_failure_falls_back_to_typst(tmp_path: Path, monkeypatch) -> None:
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    monkeypatch.setenv("FAKE_RPR_EXIT", "1")
    source_pdf, document_path, translated = _job(tmp_path)
    context = _context(tmp_path, document_path=document_path, indent_detection_pdf_path=source_pdf)
    pages, diagnostics, calls = _dispatch(context, mode="overlay", source_pdf_path=source_pdf, translated_pages=translated)
    assert calls == ["overlay"]
    assert diagnostics["render_engine"] == "typst"
    assert diagnostics["render_engine_requested"] == "rpr_fit"
    assert diagnostics["render_engine_fallback_reason"] == "engine_error"
    assert "rpr_fit" in diagnostics["render_engine_warnings"][0]


def test_rpr_fit_needs_the_normalized_document(tmp_path: Path, monkeypatch) -> None:
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    source_pdf, _document_path, translated = _job(tmp_path)
    context = _context(tmp_path, document_path=tmp_path / "missing.json", indent_detection_pdf_path=source_pdf)
    _pages, diagnostics, calls = _dispatch(context, mode="overlay", source_pdf_path=source_pdf, translated_pages=translated)
    assert calls == ["overlay"]
    assert diagnostics["render_engine_fallback_reason"] == "document_missing"


def test_rpr_fit_overlay_page_count_mismatch_falls_back(tmp_path: Path, monkeypatch) -> None:
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    monkeypatch.setenv("FAKE_RPR_PAGES_DELTA", "1")
    source_pdf, document_path, translated = _job(tmp_path)
    context = _context(tmp_path, document_path=document_path, indent_detection_pdf_path=source_pdf)
    _pages, diagnostics, calls = _dispatch(context, mode="overlay", source_pdf_path=source_pdf, translated_pages=translated)
    assert calls == ["overlay"]
    assert diagnostics["render_engine_fallback_reason"] == "engine_output_invalid"


def test_dual_mode_falls_back_for_rpr_fit(tmp_path: Path, monkeypatch) -> None:
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    source_pdf, document_path, translated = _job(tmp_path)
    context = _context(tmp_path, document_path=document_path, indent_detection_pdf_path=source_pdf)
    _pages, diagnostics, calls = _dispatch(context, mode="dual", source_pdf_path=source_pdf, translated_pages=translated)
    assert calls == ["dual"]
    assert diagnostics["render_engine_fallback_reason"] == "dual_unsupported"


def test_extract_drawings_reads_only_the_requested_pages(tmp_path: Path) -> None:
    source_pdf, _document_path, _translated = _job(tmp_path)
    drawings = extract_drawings(source_pdf, [1, 7])
    assert sorted(drawings) == ["1"]
    page = drawings["1"]
    assert page["width"] == 300 and page["height"] == 400
    line = page["drawings"][0]
    assert line["polylines"] == [[[20.0, 200.0], [280.0, 200.0]]]
    assert page["words"], "text-layer words (for obstacle ink extents) are read too"


def test_fit_report_conversion_from_engine_report() -> None:
    report = {
        "schema": "rpr_fit_report_v1",
        "engine": {"version": "x"},
        "blocks": [
            {"id": "p001-b0001", "item_id": "p001-b001", "page": 0, "kind": "body", "seed_font_size": 10.0,
             "final_font_size": 10.0, "lines": 3, "overflow_pt": 0.2, "overflow_right_pt": 0.0},
            {"id": "p001-b0002", "item_id": "p001-b002", "page": 0, "kind": "title", "seed_font_size": 12.0,
             "final_font_size": 9.0, "lines": 1, "overflow_pt": 4.0, "overflow_right_pt": 0.0},
        ],
        "invariants": {"line_overlaps": 0, "obstacle_hits": 1, "vector_hits": 2},
        "math": {"formulas": 3, "failed": [{"tex": "\\bad", "error": "x"}]},
        "body_font": {"shared": 10.0},
    }
    payload = build_rpr_fit_fit_report_payload(report, render_path="rpr_fit_overlay", engine_elapsed_seconds=0.5)
    first, second = payload["blocks"]
    assert first["tier"] == "base" and first["overflow"] is False, "0.2 pt is within the 0.5 pt tolerance"
    assert second["tier"] == "shrink" and second["scale"] == 0.75 and second["overflow"] is True
    assert payload["summary"]["obstacle_collisions"] == 3
    assert payload["summary"]["math_failed"] == 1
    assert payload["body_font"]["shared"] == 10.0


def test_paths_inside_known_obstacles_collapse_into_one_ink_rect(tmp_path: Path) -> None:
    # A figure's thousands of paths: the engine only needs "inside an obstacle"
    # and the obstacle's ink extent, so they become one rect (no polylines).
    pdf = tmp_path / "figure.pdf"
    doc = fitz.open()
    page = doc.new_page(width=300, height=400)
    for k in range(40):
        page.draw_line((60 + k, 100), (60 + k, 160))
    page.draw_line((20, 300), (280, 300))
    doc.save(pdf)
    doc.close()
    drawings = extract_drawings(pdf, [0], obstacle_boxes={0: [[50, 90, 120, 170]]}, text_boxes={0: []})["0"]["drawings"]
    synthetic = [entry for entry in drawings if entry.get("synthetic") == "obstacle-ink"]
    assert len(synthetic) == 1
    x0, y0, x1, y1 = synthetic[0]["rect"]
    assert 59 <= x0 <= 60.5 and x1 >= 99 and y0 <= 100.5 and y1 >= 159.5
    rules = [entry for entry in drawings if not entry.get("synthetic")]
    assert len(rules) == 1 and rules[0]["polylines"] == [[[20.0, 300.0], [280.0, 300.0]]]


def test_scanned_page_ink_outside_known_boxes_becomes_obstacle_cells(tmp_path: Path) -> None:
    # A page that is one image: the thin coloured frame line under a text box
    # exists only as pixels. Cells straddling the text box edge are kept (the
    # engine cuts away what lies inside the box); cells fully inside are not.
    pdf = tmp_path / "scan.pdf"
    pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 600, 800), 0)
    pix.clear_with(255)
    pix.set_rect(fitz.IRect(60, 422, 540, 424), (230, 120, 40))  # frame line at y = 211-212 pt
    pix.set_rect(fitz.IRect(100, 300, 300, 330), (20, 20, 20))  # source text inside the box
    doc = fitz.open()
    page = doc.new_page(width=300, height=400)
    page.insert_image(page.rect, pixmap=pix)
    doc.save(pdf)
    doc.close()
    text_box = [40, 140, 280, 211]  # the line sits right at the box's bottom edge
    page_data = extract_drawings(pdf, [0], obstacle_boxes={0: []}, text_boxes={0: [text_box]})["0"]
    assert page_data["raster"] is True
    cells = [entry["rect"] for entry in page_data["drawings"] if entry.get("synthetic") == "raster-ink"]
    assert any(rect[1] <= 211.5 <= rect[3] and rect[2] - rect[0] > 100 for rect in cells), cells
    assert not any(rect[1] >= 150 and rect[3] <= 165 for rect in cells), "source text inside the box is skipped"


def test_vector_pages_get_no_raster_ink(tmp_path: Path) -> None:
    source_pdf, _document_path, _translated = _job(tmp_path)
    page = extract_drawings(source_pdf, [0])["0"]
    assert page["raster"] is False
    assert not any(entry.get("synthetic") == "raster-ink" for entry in page["drawings"])


def test_table_of_contents_keeps_one_entry_per_line() -> None:
    """目录逐行排：引擎文本里每个条目一行，不能被压成一段（#133，Paddle 把整页目录切成一个块）。"""
    from retainpdf_pipeline.render.output.rpr_fit.renderer import _translation_items

    source_lines = ["1 Introduction 4", "2 Architecture 7", "2.1 Overview ..... 7", "2.1.1 Multimodal Architecture ..... 8"]
    item = {
        "item_id": "p001-b001",
        "page_idx": 0,
        "block_idx": 1,
        "block_type": "text",
        "structure_role": "table_of_contents",
        "semantic_role": "table_of_contents",
        "text_flow": "preserve_lines",
        "source_line_texts": source_lines,
        "policy_translate": True,
        "source_text": "\n".join(source_lines),
        "protected_source_text": "\n".join(source_lines),
        "translated_text": "1 引言 4\n2 架构 7\n2.1 概述 ..... 7\n2.1.1 多模态架构 ..... 8",
        "protected_translated_text": "1 引言 4\n2 架构 7\n2.1 概述 ..... 7\n2.1.1 多模态架构 ..... 8",
        "lines": [
            {"bbox": [67, 117 + 20 * index, 528, 137 + 20 * index], "spans": [{"type": "text", "content": text}]}
            for index, text in enumerate(source_lines)
        ],
    }
    [entry] = _translation_items({0: [item]})
    assert entry["translated_text"].split("\n") == [
        "1 引言 4",
        "2 架构 7",
        "2.1 概述 ..... 7",
        "2.1.1 多模态架构 ..... 8",
    ]


def test_a_page_with_too_many_vector_paths_gets_coarse_ink_rects_instead(tmp_path: Path, monkeypatch) -> None:
    # CAD 图纸一页十来万条线，逐条写给引擎 1265 页 1.74 GB，引擎（Node）读不进来（2026-11-04）：
    # 多过 DENSE_VECTOR_DRAWINGS 条就换成粗格子墨迹，上下相邻的格子并成矩形
    from retainpdf_pipeline.render.prepare import obstacle_scan_pdf

    monkeypatch.setattr(obstacle_scan_pdf, "DENSE_VECTOR_DRAWINGS", 50)
    pdf = tmp_path / "drawing.pdf"
    doc = fitz.open()
    dense = doc.new_page(width=600, height=400)
    for k in range(120):  # 一片密密的竖线：x 100-220, y 50-150
        dense.draw_line((100 + k, 50), (100 + k, 150))
    light = doc.new_page(width=300, height=400)
    light.draw_line((20, 200), (280, 200))
    doc.save(pdf)
    doc.close()
    drawings = extract_drawings(pdf, [0, 1], obstacle_boxes={0: [], 1: []}, text_boxes={0: [], 1: []})
    page = drawings["0"]
    assert page["dense"] is True and not page["raster"]
    assert all(entry.get("synthetic") == "dense-ink" and not entry["polylines"] for entry in page["drawings"])
    assert len(page["drawings"]) < 10, "上下相邻、左右一样的格子并成了几个矩形"
    x0 = min(entry["rect"][0] for entry in page["drawings"])
    x1 = max(entry["rect"][2] for entry in page["drawings"])
    y0 = min(entry["rect"][1] for entry in page["drawings"])
    y1 = max(entry["rect"][3] for entry in page["drawings"])
    assert x0 <= 100 and x1 >= 219 and y0 <= 50 and y1 >= 149 and x1 - x0 < 200, (x0, y0, x1, y1)
    # 线条少的页照旧逐条
    assert drawings["1"]["dense"] is False and drawings["1"]["drawings"][0]["polylines"] == [[[20.0, 200.0], [280.0, 200.0]]]


def test_drawings_the_engine_cannot_read_fall_back_with_a_clear_reason(tmp_path: Path, monkeypatch) -> None:
    from retainpdf_pipeline.render.output.rpr.engine_cli import RprEngineFailed
    from retainpdf_pipeline.render.output.rpr_fit import renderer

    monkeypatch.setattr(renderer, "DRAWINGS_JSON_MAX_CHARS", 10)
    source_pdf, document_path, translated = _job(tmp_path)
    with pytest.raises(RprEngineFailed) as raised:
        renderer.build_book_rpr_fit_pdf(
            mode="overlay",
            runtime=None,
            source_pdf_path=source_pdf,
            output_pdf_path=tmp_path / "rendered" / "out.pdf",
            translated_pages=translated,
            font_family="Source Han Serif SC",
            document_path=document_path,
            obstacle_scan={"0": {"width": 300, "height": 400, "drawings": [], "images": [], "words": []}},
        )
    assert raised.value.code == "drawings_too_large" and "超过引擎能读的上限" in str(raised.value)


def test_a_page_tiled_from_thousands_of_small_images_also_gets_coarse_ink(tmp_path: Path, monkeypatch) -> None:
    # 图纸的填充花纹是成千上万张小图拼的：图片框多过 DENSE_IMAGES 个也换成粗格子，图片框清空（墨迹在格子里）
    from retainpdf_pipeline.render.prepare import obstacle_scan_pdf

    monkeypatch.setattr(obstacle_scan_pdf, "DENSE_IMAGES", 20)
    tile = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 4, 4), False)
    tile.clear_with(0)
    pdf = tmp_path / "tiles.pdf"
    doc = fitz.open()
    page = doc.new_page(width=400, height=300)
    for k in range(40):
        page.insert_image(fitz.Rect(50 + k * 5, 100, 54 + k * 5, 104), pixmap=tile)
    doc.save(pdf)
    doc.close()
    scanned = extract_drawings(pdf, [0], obstacle_boxes={0: []}, text_boxes={0: []})["0"]
    assert scanned["dense"] is True and scanned["images"] == []
    assert scanned["drawings"] and all(entry.get("synthetic") == "dense-ink" for entry in scanned["drawings"])
