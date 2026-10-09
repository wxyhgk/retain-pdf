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


def _hidden_text_pdf(path: Path) -> Path:
    doc = fitz.open()
    page = doc.new_page(width=300, height=400)
    # A scanned page: a full-page image with an invisible OCR text layer on top.
    scan = fitz.Pixmap(fitz.csGRAY, fitz.IRect(0, 0, 150, 200), False)
    scan.clear_with(230)
    page.insert_image(page.rect, pixmap=scan)
    page.insert_text((20, 80), ["invisible OCR layer with enough words"] * 12, fontsize=10, render_mode=3)
    doc.save(path)
    doc.close()
    return path


def _hidden_analysis():
    from retainpdf_pipeline.render.contracts.document_analysis import RenderDocumentAnalysis
    from types import SimpleNamespace

    analysis = RenderDocumentAnalysis(pages={})
    return SimpleNamespace(
        hidden_text_strip_page_indices=frozenset({0}),
        pikepdf_text_strip_page_indices=frozenset(),
        pages=analysis.pages,
    )


def _texts(path: Path) -> str:
    with fitz.open(path) as doc:
        return doc[0].get_text()


def test_source_base_step_is_cached_and_linked_not_moved(tmp_path: Path) -> None:
    from retainpdf_pipeline.render.contracts.prepare_hooks import RenderPrepareHooks
    from retainpdf_pipeline.render.prepare.source_base import source_base_builder
    from retainpdf_pipeline.render.source.render_source import build_render_source_pdf

    source = _hidden_text_pdf(tmp_path / "source.pdf")
    prepare_dir = tmp_path / "render_prepare"
    out_dir = tmp_path / "rendered"
    out_dir.mkdir()

    def render(builder):
        return build_render_source_pdf(
            source_pdf_path=source,
            output_pdf_path=out_dir / "out.pdf",
            pdf_compress_dpi=0,
            translated_pages=None,
            strip_hidden_text=True,
            document_analysis=_hidden_analysis(),
            prepare_hooks=RenderPrepareHooks(source_base=builder),
        )

    fresh = render(None)
    assert "invisible" in _texts(source) and "invisible" not in _texts(fresh.path)
    assert not list(out_dir.rglob(".render-source-base-*")), "the uncached base leaves no temp dir"

    first = render(source_base_builder(prepare_dir))
    cache_pdf = prepare_dir / "source_base" / "base.pdf"
    assert cache_pdf.is_file() and first.path != cache_pdf
    assert first.path.read_bytes() == fresh.path.read_bytes()
    # Non-artifact mode deletes its temp copies; the cached base must survive.
    assert first.path in first.temp_paths
    for path in first.temp_paths:
        path.unlink(missing_ok=True)
    assert cache_pdf.is_file()

    second = render(source_base_builder(prepare_dir))
    assert second.path.read_bytes() == fresh.path.read_bytes()
    linked = second.path.read_bytes()
    # Rebuilding the step with other inputs replaces the cache file; an earlier link keeps the old bytes.
    from retainpdf_pipeline.render.prepare.source_base import run_source_base
    from retainpdf_pipeline.render.prepare.store import PrepareStore

    _base, record = run_source_base(
        PrepareStore(prepare_dir), source_pdf_path=source, strip_hidden_text=True, start_page=0, end_page=0
    )
    assert record.hit is False
    assert second.path.read_bytes() == linked


def test_source_base_without_changes_uses_the_source(tmp_path: Path) -> None:
    from retainpdf_pipeline.render.prepare.source_base import run_source_base
    from retainpdf_pipeline.render.prepare.store import PrepareStore

    pdf, _document = _doc_and_pdf(tmp_path)
    base, record = run_source_base(
        PrepareStore(tmp_path / "render_prepare"), source_pdf_path=pdf, strip_hidden_text=False, start_page=0, end_page=-1
    )
    assert base.path is None and base.cached
    again, record = run_source_base(
        PrepareStore(tmp_path / "render_prepare"), source_pdf_path=pdf, strip_hidden_text=False, start_page=3, end_page=9
    )
    assert record.hit is True, "the page range only matters when hidden text is stripped"


def _fake_strip(calls: list[dict], *, deadline_pages: frozenset[int] = frozenset()):
    from retainpdf_pipeline.render.source_cleanup.types import BBoxTextStripResult

    def execute(**kwargs):
        calls.append(kwargs)
        out = Path(kwargs["output_pdf_path"])
        out.write_bytes(b"%PDF stripped " + str(len(calls)).encode())
        return BBoxTextStripResult(
            changed=True,
            output_pdf_path=out,
            pages_changed=1,
            changed_page_indices=frozenset({0}),
            deadline_skipped_page_indices=deadline_pages,
        )

    return execute


def test_text_strip_step_caches_by_plan_and_input_content(tmp_path: Path) -> None:
    from retainpdf_pipeline.render.prepare.text_strip import text_strip_runner

    source = tmp_path / "base.pdf"
    source.write_bytes(b"%PDF base")
    elsewhere = tmp_path / "other-dir" / "same-base.pdf"
    elsewhere.parent.mkdir()
    os.link(source, elsewhere)
    runner = text_strip_runner(tmp_path / "render_prepare")
    calls: list[dict] = []
    rects = {0: [fitz.Rect(10, 10, 100, 40)]}

    def run(src: Path, out: Path, page_rects=rects, execute=None):
        return runner(
            execute or _fake_strip(calls),
            source_pdf_path=src,
            output_pdf_path=out,
            page_rects=page_rects,
            page_protected_rects={},
            candidate_elapsed=1.23,
            max_elapsed_seconds=30.0,
        )

    first = run(source, tmp_path / "a" / "out.pdf")
    assert len(calls) == 1 and first.changed and first.changed_page_indices == frozenset({0})
    assert first.output_pdf_path == tmp_path / "a" / "out.pdf" and first.output_pdf_path.read_bytes() == b"%PDF stripped 1"
    # Same plan, same input content behind another link → hit; timing / budget don't matter.
    second = run(elsewhere, tmp_path / "b" / "out.pdf")
    assert len(calls) == 1 and second.output_pdf_path.read_bytes() == b"%PDF stripped 1"
    second.output_pdf_path.unlink()
    assert (tmp_path / "render_prepare" / "text_strip" / "stripped.pdf").is_file()
    # Another rect → rebuild; the earlier output keeps its bytes.
    run(source, tmp_path / "c" / "out.pdf", page_rects={0: [fitz.Rect(10, 10, 100, 41)]})
    assert len(calls) == 2 and first.output_pdf_path.read_bytes() == b"%PDF stripped 1"


def test_text_strip_step_does_not_cache_a_deadline_cut_result(tmp_path: Path) -> None:
    from retainpdf_pipeline.render.prepare.text_strip import text_strip_runner

    source = tmp_path / "base.pdf"
    source.write_bytes(b"%PDF base")
    runner = text_strip_runner(tmp_path / "render_prepare")
    calls: list[dict] = []
    kwargs = dict(source_pdf_path=source, page_rects={0: [fitz.Rect(1, 1, 2, 2)]}, page_protected_rects={})
    cut = runner(_fake_strip(calls, deadline_pages=frozenset({3})), output_pdf_path=tmp_path / "x.pdf", **kwargs)
    assert cut.deadline_skipped_page_indices == frozenset({3}) and cut.output_pdf_path.read_bytes().startswith(b"%PDF")
    runner(_fake_strip(calls), output_pdf_path=tmp_path / "y.pdf", **kwargs)
    assert len(calls) == 2, "an incomplete result is never reused"
