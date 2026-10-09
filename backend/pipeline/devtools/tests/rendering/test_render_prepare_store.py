"""render/prepare：渲染准备步骤的缓存（指纹、命中、失效）与障碍物扫描步骤。"""

from __future__ import annotations

import json
import os
from pathlib import Path

import fitz

from retainpdf_pipeline.render.prepare.obstacle_scan import load_obstacle_scan
from retainpdf_pipeline.render.prepare.obstacle_scan import run_obstacle_scan
from retainpdf_pipeline.render.prepare.store import MANIFEST_NAME
from retainpdf_pipeline.render.prepare.store import PrepareStore
from retainpdf_pipeline.render.prepare.store import file_identity


def _build_counter(calls: list[int], text: str = "data"):
    def build(directory: Path) -> dict[str, Path]:
        calls.append(1)
        out = directory / "out.txt"
        out.write_text(text, encoding="utf-8")
        return {"out": out}

    return build


def test_step_is_built_once_and_reused_while_inputs_match(tmp_path: Path) -> None:
    store = PrepareStore(tmp_path / "render_prepare")
    calls: list[int] = []
    first = store.run("demo", "1", {"a": 1}, _build_counter(calls))
    second = store.run("demo", "1", {"a": 1}, _build_counter(calls))
    assert calls == [1]
    assert first.hit is False and second.hit is True
    assert second.output("out").read_text(encoding="utf-8") == "data"


def test_changed_inputs_or_version_rebuild(tmp_path: Path) -> None:
    store = PrepareStore(tmp_path / "render_prepare")
    calls: list[int] = []
    store.run("demo", "1", {"a": 1}, _build_counter(calls))
    store.run("demo", "1", {"a": 2}, _build_counter(calls))
    store.run("demo", "2", {"a": 2}, _build_counter(calls))
    assert len(calls) == 3
    assert store.load("demo", "1", {"a": 1}) is None, "only the latest build is kept"


def test_missing_output_or_manifest_is_not_a_hit(tmp_path: Path) -> None:
    store = PrepareStore(tmp_path / "render_prepare")
    calls: list[int] = []
    record = store.run("demo", "1", {"a": 1}, _build_counter(calls))
    record.output("out").unlink()
    assert store.load("demo", "1", {"a": 1}) is None
    store.run("demo", "1", {"a": 1}, _build_counter(calls))
    (store.step_dir("demo") / MANIFEST_NAME).write_text("{not json", encoding="utf-8")
    assert store.load("demo", "1", {"a": 1}) is None


def test_build_failure_leaves_no_manifest(tmp_path: Path) -> None:
    store = PrepareStore(tmp_path / "render_prepare")
    store.run("demo", "1", {"a": 1}, _build_counter([]))

    def broken(directory: Path) -> dict[str, Path]:
        raise RuntimeError("boom")

    try:
        store.run("demo", "1", {"a": 2}, broken)
    except RuntimeError:
        pass
    assert not (store.step_dir("demo") / MANIFEST_NAME).exists()
    assert store.load("demo", "1", {"a": 1}) is None


def test_file_identity_tracks_size_and_mtime(tmp_path: Path) -> None:
    path = tmp_path / "f.bin"
    path.write_bytes(b"x")
    before = file_identity(path)
    os.utime(path, ns=(1, 1))
    assert file_identity(path) != before
    assert file_identity(tmp_path / "missing") is None


def _doc_and_pdf(tmp_path: Path) -> tuple[Path, Path]:
    pdf = tmp_path / "source.pdf"
    doc = fitz.open()
    for _ in range(2):
        page = doc.new_page(width=300, height=400)
        page.draw_line((20, 300), (280, 300))
        page.insert_text((20, 50), "source", fontsize=12)
    doc.save(pdf)
    doc.close()
    document = tmp_path / "document.v1.json"
    document.write_text(json.dumps({"pages": [
        {"page_index": index, "blocks": [{"block_id": f"p{index + 1:03d}-b0001", "type": "text", "bbox": [10, 30, 280, 80]}]}
        for index in range(2)
    ]}), encoding="utf-8")
    return pdf, document


def test_obstacle_scan_covers_every_document_page_and_is_reused(tmp_path: Path) -> None:
    pdf, document = _doc_and_pdf(tmp_path)
    store = PrepareStore(tmp_path / "render_prepare")
    first = run_obstacle_scan(store, source_pdf_path=pdf, document_path=document)
    scan = load_obstacle_scan(first)
    assert sorted(scan) == ["0", "1"]
    assert scan["0"]["drawings"][0]["polylines"] == [[[20.0, 300.0], [280.0, 300.0]]]
    again = run_obstacle_scan(store, source_pdf_path=pdf, document_path=document)
    assert again.hit is True
    # A new OCR result invalidates the scan.
    os.utime(document, ns=(2, 2))
    assert run_obstacle_scan(store, source_pdf_path=pdf, document_path=document).hit is False


def test_page_analysis_is_reused_when_only_the_wording_changes(tmp_path: Path) -> None:
    from retainpdf_pipeline.render.prepare.page_analysis import run_page_analysis

    pdf, _document = _doc_and_pdf(tmp_path)
    store = PrepareStore(tmp_path / "render_prepare")
    item = {"item_id": "p001-b001", "bbox": [10, 30, 280, 80], "translated_text": "旧译文"}
    first, record = run_page_analysis(store, source_pdf_path=pdf, translated_pages={0: [item]}, start_page=0, end_page=-1)
    assert record.hit is False and sorted(first.pages) == [0]
    reworded = {**item, "translated_text": "新译文"}
    again, record = run_page_analysis(store, source_pdf_path=pdf, translated_pages={0: [reworded]}, start_page=0, end_page=-1)
    assert record.hit is True
    assert again == first
    _, record = run_page_analysis(store, source_pdf_path=pdf, translated_pages={0: [reworded], 1: [item]}, start_page=0, end_page=-1)
    assert record.hit is False, "another page to analyse is a new input"


def test_visual_profile_step_is_exact_and_ignores_wording(tmp_path: Path) -> None:
    from retainpdf_pipeline.render.prepare.visual_profile import run_visual_profile
    from retainpdf_pipeline.render.visual_profile import build_document_visual_profile

    pdf = tmp_path / "colored.pdf"
    doc = fitz.open()
    page = doc.new_page(width=300, height=400)
    # 1/3 和 161/255 这类颜色舍入成 5 位小数后，typst_rgb 的截断取整会差一级。
    page.insert_text((20, 50), "Colored title", fontsize=14, color=(1.0, 161 / 255, 1 / 3))
    doc.save(pdf)
    doc.close()
    item = {
        "item_id": "p001-b000",
        "bbox": [15, 35, 200, 60],
        "block_type": "title",
        "_render_use_cover_fill": True,  # 要采底色 → 也从文字 span 取字色
        "translated_text": "旧",
    }
    store = PrepareStore(tmp_path / "render_prepare")
    fresh = build_document_visual_profile(pdf, {0: [item]}, max_workers=1)
    first, record = run_visual_profile(store, source_pdf_path=pdf, pages={0: [item]})
    assert record.hit is False and first == fresh
    assert round(fresh.pages[0].items["p001-b000"].text_rgb[1], 5) != fresh.pages[0].items["p001-b000"].text_rgb[1]
    again, record = run_visual_profile(store, source_pdf_path=pdf, pages={0: [{**item, "translated_text": "新"}]})
    assert record.hit is True and again == fresh
    moved = {**item, "bbox": [15, 35, 210, 60]}
    _, record = run_visual_profile(store, source_pdf_path=pdf, pages={0: [moved]})
    assert record.hit is False
