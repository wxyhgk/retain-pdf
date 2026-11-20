"""导出水印（2026-11-20）：每页看到的右下角盖「logo + RetainPDF」，旋转过的页也是正的；水印里没有文字；整本只多一点体积。"""

from __future__ import annotations

import tomllib
from pathlib import Path

import fitz
import pytest

from retainpdf_pipeline.render.output.watermark import STAMP_PDF
from retainpdf_pipeline.render.output.watermark import STAMP_PNG
from retainpdf_pipeline.render.output.watermark import stamp_rect
from retainpdf_pipeline.render.output.watermark.pdf import watermark_pdf

PIPELINE_ROOT = Path(__file__).resolve().parents[3]


def _ink(page: fitz.Page, clip: fitz.Rect) -> int:
    """看到的页面上这一块里不是白的像素有多少。"""
    pix = page.get_pixmap(clip=clip)
    samples = pix.samples
    return sum(1 for i in range(0, len(samples), pix.n) if samples[i] < 235)


@pytest.mark.parametrize("rotation", [0, 90, 180, 270])
def test_the_stamp_sits_upright_in_the_visible_bottom_right_corner(tmp_path: Path, rotation: int) -> None:
    source = tmp_path / "in.pdf"
    with fitz.open() as doc:
        doc.new_page(width=595, height=842).set_rotation(rotation)
        doc.save(source)
    out = tmp_path / "out.pdf"
    assert watermark_pdf(source, out) == 1
    with fitz.open(out) as doc:
        page = doc[0]
        r = page.rect
        corner = fitz.Rect(r.x1 - 110, r.y1 - 40, r.x1, r.y1)
        assert _ink(page, corner) > 50
        assert _ink(page, fitz.Rect(r.x0, r.y0, r.x1, r.y1 - 40)) == 0, "只在右下角"
        # 正着的：页面上那一块和水印原图比，比和倒过来的水印像
        with fitz.open(STAMP_PDF) as stamp:
            where = stamp_rect(r, stamp[0].rect.width / stamp[0].rect.height)
            scale = 4
            seen = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=where, colorspace=fitz.csGRAY)
            sx, sy = seen.width / stamp[0].rect.width, seen.height / stamp[0].rect.height
            upright = stamp[0].get_pixmap(matrix=fitz.Matrix(sx, sy), colorspace=fitz.csGRAY)
            flipped = stamp[0].get_pixmap(matrix=fitz.Matrix(sx, sy).prerotate(180), colorspace=fitz.csGRAY)

        def diff(a: fitz.Pixmap, b: fitz.Pixmap) -> int:
            n = min(len(a.samples), len(b.samples))
            return sum(abs(x - y) for x, y in zip(a.samples[:n], b.samples[:n]))

        assert diff(seen, upright) < diff(seen, flipped)


def test_the_stamp_adds_no_text_and_little_size(tmp_path: Path) -> None:
    source = tmp_path / "in.pdf"
    with fitz.open() as doc:
        for i in range(40):
            doc.new_page().insert_text((72, 72), f"Page {i + 1} body text.")
        doc.save(source, garbage=3, deflate=True)
    out = tmp_path / "out.pdf"
    watermark_pdf(source, out)
    with fitz.open(source) as before, fitz.open(out) as after:
        assert [p.get_text() for p in after] == [p.get_text() for p in before], "复制、搜索不会混进 RetainPDF"
    assert out.stat().st_size - source.stat().st_size < 40 * 1024, "每页引用同一个水印对象"


def test_the_stamp_assets_ship_with_the_package() -> None:
    assert STAMP_PDF.is_file() and STAMP_PNG.is_file()
    with fitz.open(STAMP_PDF) as stamp:
        assert stamp.page_count == 1 and not stamp[0].get_text().strip()
        # 位图和矢量是同一枚水印：宽高比一样（11-20 第一版位图是按信纸大小渲的，几乎全透明）
        png = fitz.Pixmap(str(STAMP_PNG))
        assert png.alpha and abs(png.width / png.height - stamp[0].rect.width / stamp[0].rect.height) < 0.05
    data = tomllib.loads((PIPELINE_ROOT / "pyproject.toml").read_text(encoding="utf-8"))["tool"]["setuptools"]["package-data"]
    assert {"*.pdf", "*.png"} <= set(data["retainpdf_pipeline.render.output.watermark"])
