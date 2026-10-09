"""渲染准备阶段（与翻译并行）：配置文件、预测的输入与渲染阶段一致、步骤锁。"""

from __future__ import annotations

import json
import threading
import time
from pathlib import Path

import fitz
import pytest

from retainpdf_pipeline.foundation.shared.stage_specs import RENDER_PREPARE_STAGE_SCHEMA_VERSION
from retainpdf_pipeline.foundation.shared.stage_specs import RenderPrepareStageSpec
from retainpdf_pipeline.ocr.document_schema.adapters import adapt_payload_to_document_v1
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_GENERIC_FLAT_OCR
from retainpdf_pipeline.render.prepare.page_analysis import run_page_analysis
from retainpdf_pipeline.render.prepare.source_base import run_source_base
from retainpdf_pipeline.render.prepare.store import PrepareStore
from retainpdf_pipeline.render.render_plan import plan_pages
from retainpdf_pipeline.render.workflow import source_page_records
from retainpdf_pipeline.render.workflow.prepare_stage import document_path_for_render
from retainpdf_pipeline.render.workflow.prepare_stage import run_render_prepare
from retainpdf_pipeline.render.workflow.prewarm_entry import build_source_render_preprocess_pages
from retainpdf_pipeline.translate.core.ocr import json_extractor


def _block(sub_type: str, top: float, text: str) -> dict:
    bbox = [20, top, 280, top + 20]
    return {
        "type": "text",
        "sub_type": sub_type,
        "bbox": bbox,
        "text": text,
        "lines": [{"bbox": bbox, "spans": [{"type": "text", "raw_type": "text", "text": text, "bbox": bbox}]}],
        "segments": [],
        "tags": [],
        "derived": {"role": "", "by": "", "confidence": 0.0},
        "metadata": {},
    }


def _job(tmp_path: Path) -> tuple[Path, Path]:
    """一个任务目录：source PDF（两页扫描件，带不可见 OCR 文字层）与 ocr/normalized/document.v1.json。"""
    job = tmp_path / "job"
    pdf = job / "source" / "source.pdf"
    pdf.parent.mkdir(parents=True)
    doc = fitz.open()
    for _ in range(2):
        page = doc.new_page(width=300, height=400)
        scan = fitz.Pixmap(fitz.csGRAY, fitz.IRect(0, 0, 150, 200), False)
        scan.clear_with(230)
        page.insert_image(page.rect, pixmap=scan)
        page.insert_text((20, 80), ["hidden OCR words for the scanned page"] * 8, fontsize=10, render_mode=3)
    doc.save(pdf)
    doc.close()
    pages = [
        {"width": 300.0, "height": 400.0, "unit": "pt", "blocks": [_block("body", 40 + 60 * i, f"Paragraph {p}.{i}") for i in range(3)]}
        for p in range(2)
    ]
    document = adapt_payload_to_document_v1(
        payload={"provider": PROVIDER_GENERIC_FLAT_OCR, "pages": pages},
        document_id="doc",
        provider=PROVIDER_GENERIC_FLAT_OCR,
        source_json_path=Path("doc.json"),
    )
    for page in document["pages"]:
        for block in page["blocks"]:
            block["policy"] = {"translate": True, "translate_reason": "test"}
    translations_dir = job / "translated"
    document_path = document_path_for_render(translations_dir)
    document_path.parent.mkdir(parents=True)
    document_path.write_text(json.dumps(document), encoding="utf-8")
    return job, pdf


def test_render_and_translate_extractors_yield_the_same_items(tmp_path: Path) -> None:
    # 提前做的渲染准备用渲染侧的抽取器预测翻译后的条目；两份抽取器的条目必须一一对应。
    job, _pdf = _job(tmp_path)
    data = json.loads(document_path_for_render(job / "translated").read_text(encoding="utf-8"))
    for page_idx in range(2):
        render_items = source_page_records.extract_text_items(data, page_idx=page_idx)
        translate_items = json_extractor.extract_text_items(data, page_idx=page_idx)
        assert [(i.item_id, list(i.bbox)) for i in render_items] == [(i.item_id, list(i.bbox)) for i in translate_items]
        assert render_items


def test_prepared_steps_are_what_the_render_stage_asks_for(tmp_path: Path) -> None:
    job, pdf = _job(tmp_path)
    translations_dir = job / "translated"
    report = run_render_prepare(
        source_pdf_path=pdf,
        translations_dir=translations_dir,
        start_page=0,
        end_page=-1,
        render_mode="typst",
        render_engine="rpr_fit",
    )
    assert set(report["steps"]) == {"obstacle_scan", "page_analysis", "source_base"}
    assert all("error" not in step for step in report["steps"].values())
    # 渲染阶段：同样的条目（翻译只往里加译文）经 build_render_plan 的推导与 executor 的页码范围。
    translated = {
        page: [{**item, "translated_text": "译文"} for item in items]
        for page, items in build_source_render_preprocess_pages(
            source_json_path=document_path_for_render(translations_dir), start_page=0, end_page=-1
        ).items()
    }
    selected, mode = plan_pages(
        source_pdf_path=pdf, pages=translated, mode_probe_pages=None, start_page=0, end_page=-1, render_mode="typst"
    )
    store = PrepareStore(job / "artifacts" / "render_prepare")
    analysis, record = run_page_analysis(
        store, source_pdf_path=pdf, translated_pages=selected, start_page=0, end_page=max(selected)
    )
    assert record.hit
    base, record = run_source_base(
        store,
        source_pdf_path=pdf,
        strip_hidden_text=bool(mode != "overlay" and analysis.hidden_text_strip_page_indices),
        start_page=0,
        end_page=max(selected),
    )
    assert record.hit and base.hidden_text_stripped


def test_prepare_stage_spec_loads(tmp_path: Path) -> None:
    job, pdf = _job(tmp_path)
    spec_path = job / "specs" / "render-prepare.spec.json"
    spec_path.parent.mkdir(parents=True)
    payload = {
        "schema_version": RENDER_PREPARE_STAGE_SCHEMA_VERSION,
        "stage": "render_prepare",
        "job": {"job_id": "job", "job_root": str(job), "workflow": "book"},
        "inputs": {
            "source_pdf": str(pdf),
            "source_json": str(document_path_for_render(job / "translated")),
            "translations_dir": str(job / "translated"),
        },
        "params": {"start_page": 1, "end_page": -1, "render_mode": "typst", "engine": "RPR_FIT", "math_mode": ""},
    }
    spec_path.write_text(json.dumps(payload), encoding="utf-8")
    spec = RenderPrepareStageSpec.load(spec_path)
    assert spec.params.start_page == 1 and spec.params.engine == "rpr_fit" and spec.params.math_mode == "direct_typst"
    assert spec.inputs.translations_dir == (job / "translated").resolve()
    spec_path.write_text(json.dumps({**payload, "schema_version": "render.stage.v1"}), encoding="utf-8")
    with pytest.raises(RuntimeError, match="schema_version"):
        RenderPrepareStageSpec.load(spec_path)


def test_concurrent_builders_of_one_step_build_once(tmp_path: Path) -> None:
    calls: list[int] = []
    results: list[bool] = []

    def build(directory: Path) -> dict[str, Path]:
        calls.append(1)
        time.sleep(0.3)
        out = directory / "out.txt"
        out.write_text("x", encoding="utf-8")
        return {"out": out}

    def worker() -> None:
        # 两个独立的 store 对象，模拟两个进程。
        results.append(PrepareStore(tmp_path / "render_prepare").run("demo", "1", {"a": 1}, build).hit)

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for thread in threads:
        thread.start()
        time.sleep(0.05)
    for thread in threads:
        thread.join()
    assert len(calls) == 1
    assert sorted(results) == [False, True]
