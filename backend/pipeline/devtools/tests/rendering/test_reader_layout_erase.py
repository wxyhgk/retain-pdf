"""阅读页版面的 ``erase``：渲染源里抹掉、又不在 covers 下面的原字（rpr_fit/reader_layout.py 的 page_erase，2026-11-28）。

阅读页拿原文页做底、先画这些框，就不用下载底图。"""

import fitz
import pytest

from retainpdf_pipeline.render.output.rpr_fit.reader_layout import page_erase

HEADING = (40, 120)  # 一行英文小标题：不在译文块里，去字 PDF 抹掉了


def _pages(*, background_fill=None, keep_heading=False, hidden=False):
    """(原文页, 底图页)：原文有正文一行（译文块盖着）、小标题一行；底图里正文和小标题都抹了。"""
    original = fitz.open()
    page = original.new_page(width=300, height=400)
    if background_fill is not None:
        page.draw_rect(fitz.Rect(0, 100, 300, 140), color=None, fill=background_fill)
    page.insert_text((20, 50), "body text under the cover", fontsize=12)
    page.insert_text(HEADING, "INTRODUCTION", fontsize=12, render_mode=3 if hidden else 0)
    stripped = fitz.open()
    bg = stripped.new_page(width=300, height=400)
    if background_fill is not None:
        bg.draw_rect(fitz.Rect(0, 100, 300, 140), color=None, fill=background_fill)
    if keep_heading:
        bg.insert_text(HEADING, "INTRODUCTION", fontsize=12)
    return original, stripped


COVERS = [{"block": "p001-b0001", "rect": [10, 30, 280, 80], "fill": [1, 1, 1]}]


def test_a_stripped_line_outside_the_covers_is_erased_with_the_background_colour():
    original, stripped = _pages()
    [erase] = page_erase(original[0], stripped[0], COVERS)
    rect = fitz.Rect(erase["rect"])
    heading = original[0].search_for("INTRODUCTION")[0]
    assert rect.contains(heading), "the box covers the heading's glyphs"
    assert erase["fill"] == [1.0, 1.0, 1.0]


def test_the_fill_is_the_colour_behind_the_stripped_text():
    original, stripped = _pages(background_fill=(0.9, 0.95, 1.0))
    [erase] = page_erase(original[0], stripped[0], COVERS)
    assert erase["fill"] == pytest.approx([0.9, 0.95, 1.0], abs=0.01)


def test_lines_under_a_cover_are_left_to_the_cover():
    original, stripped = _pages()
    covers = COVERS + [{"block": "p001-b0002", "rect": [30, 100, 200, 130], "fill": [1, 1, 1]}]
    assert page_erase(original[0], stripped[0], covers) == []


def test_text_still_on_the_background_is_not_erased():
    original, stripped = _pages(keep_heading=True)
    assert page_erase(original[0], stripped[0], COVERS) == []


def test_an_invisible_text_layer_that_was_stripped_is_not_erased():
    # 扫描件的隐藏文字层：抹不抹页面看着都一样，不盖底色
    original, stripped = _pages(hidden=True)
    assert page_erase(original[0], stripped[0], COVERS) == []


def test_the_reader_keeps_regular_where_the_pdf_uses_the_light_instance(tmp_path):
    # 下载的 PDF 用细体（RetainPDFSerifSC-W300），阅读页的 HTML 页照旧用常规体：字簇的 font 还是细体的 key，
    # 那个 key 的字体文件从常规体切
    import json
    from pathlib import Path

    from fontTools.ttLib import TTFont

    from retainpdf_pipeline.render.output.rpr_fit.reader_layout import save_reader_layout

    fonts_dir = Path(__file__).resolve().parents[5] / "resources" / "fonts"
    if not (fonts_dir / "SourceHanSerifSC-Regular.otf").is_file():
        pytest.skip("no Source Han Serif in resources/fonts")
    layout = tmp_path / "engine" / "layout.json"
    layout.parent.mkdir()
    layout.write_text(json.dumps({
        "schema": "rpr_layout_v1",
        "fonts": [{"key": "RetainPDFSerifSC-W300", "postscript": "RetainPDFSerifSC-W300", "family": "RetainPDF Serif SC",
                   "weight": 300, "mono": False, "file": "RetainPDFSerifSC-W300.otf"}],
        "pages": [{"index": 0, "width": 300, "height": 400, "covers": [], "blocks": [{
            "id": "p001-b0001", "fontSize": 10, "weight": "regular", "color": [0, 0, 0],
            "lines": [{"text": "中文", "x": 10, "baseline": 20, "width": 20, "justified": False,
                       "items": [{"x": 10, "t": "中", "font": "RetainPDFSerifSC-W300"}, {"x": 20, "t": "文", "font": "RetainPDFSerifSC-W300"}]}]}]}],
    }), encoding="utf-8")
    out = tmp_path / "rendered" / "translated.pdf"
    out.parent.mkdir()
    saved = save_reader_layout(layout_path=layout, output_pdf_path=out, engine_version="0", engine_commit="x", font_dirs=[fonts_dir])
    assert saved["fonts_skipped"] == ""
    manifest = json.loads((out.parent / "reader-layout" / "manifest.json").read_text(encoding="utf-8"))
    [face] = manifest["fonts"]
    assert face["key"] == "RetainPDFSerifSC-W300" and face["file"] == "fonts/RetainPDFSerifSC-W300.woff2"
    assert face["postscript"] == "SourceHanSerifSC-Regular" and face["weight"] == 400
    assert face["source_file"] == "SourceHanSerifSC-Regular.otf"
    subset = TTFont(str(out.parent / "reader-layout" / face["file"]))
    assert subset["OS/2"].usWeightClass == 400 and {chr(cp) for cp in subset.getBestCmap()} >= {"中", "文"}
