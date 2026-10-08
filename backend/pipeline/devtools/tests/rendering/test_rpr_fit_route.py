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
from retainpdf_pipeline.render.output.rpr_fit.source_scan import extract_drawings
from retainpdf_pipeline.render.output.typst.fit_report import fit_report_scope
from retainpdf_pipeline.render.workflow.context import RenderExecutionContext
from retainpdf_pipeline.render.workflow.engine_dispatch import dispatch_with_render_engine
from retainpdf_pipeline.render.workflow.engine_dispatch import render_engine_summary
from retainpdf_pipeline.translate.services.quality.qa.fit import check_fit_report


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
    context = _context(tmp_path, document_path=document_path)
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


def test_rpr_fit_engine_failure_falls_back_to_typst(tmp_path: Path, monkeypatch) -> None:
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    monkeypatch.setenv("FAKE_RPR_EXIT", "1")
    source_pdf, document_path, translated = _job(tmp_path)
    context = _context(tmp_path, document_path=document_path)
    pages, diagnostics, calls = _dispatch(context, mode="overlay", source_pdf_path=source_pdf, translated_pages=translated)
    assert calls == ["overlay"]
    assert diagnostics["render_engine"] == "typst"
    assert diagnostics["render_engine_requested"] == "rpr_fit"
    assert diagnostics["render_engine_fallback_reason"] == "engine_error"
    assert "rpr_fit" in diagnostics["render_engine_warnings"][0]


def test_rpr_fit_needs_the_normalized_document(tmp_path: Path, monkeypatch) -> None:
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    source_pdf, _document_path, translated = _job(tmp_path)
    context = _context(tmp_path, document_path=tmp_path / "missing.json")
    _pages, diagnostics, calls = _dispatch(context, mode="overlay", source_pdf_path=source_pdf, translated_pages=translated)
    assert calls == ["overlay"]
    assert diagnostics["render_engine_fallback_reason"] == "document_missing"


def test_rpr_fit_overlay_page_count_mismatch_falls_back(tmp_path: Path, monkeypatch) -> None:
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    monkeypatch.setenv("FAKE_RPR_PAGES_DELTA", "1")
    source_pdf, document_path, translated = _job(tmp_path)
    context = _context(tmp_path, document_path=document_path)
    _pages, diagnostics, calls = _dispatch(context, mode="overlay", source_pdf_path=source_pdf, translated_pages=translated)
    assert calls == ["overlay"]
    assert diagnostics["render_engine_fallback_reason"] == "engine_output_invalid"


def test_dual_mode_falls_back_for_rpr_fit(tmp_path: Path, monkeypatch) -> None:
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    source_pdf, document_path, translated = _job(tmp_path)
    context = _context(tmp_path, document_path=document_path)
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
