"""生成导出文件右下角的水印「logo + RetainPDF」（2026-11-20）。改了 logo、字样、颜色才重新跑，产物提交进仓库。

    backend/.venv/bin/python backend/pipeline/devtools/build_watermark_stamp.py

产出（`retainpdf_pipeline/render/output/watermark/`）：
- `stamp.pdf`：一页纯矢量的水印，盖 PDF 用（`render/output/watermark/pdf.py`）。字样用 Typst 导出 SVG 时画成了路径，
  所以水印里没有文字：复制、搜索、全文检索都不会混进 "RetainPDF"，运行时也不需要这个字体。
- `stamp.png`：同一枚水印的透明底位图（8 倍），Word 导出用（Word 里浮动图片放矢量要另配位图，直接用位图）。

要本机装了 typst 和 Helvetica Neue（macOS 自带）；生成以后运行时都不需要。
"""

from __future__ import annotations

import re
import subprocess
import sys
import tempfile
from pathlib import Path

import fitz

REPO_ROOT = Path(__file__).resolve().parents[3]
LOGO_SVG = REPO_ROOT / "resources" / "brand" / "RetainPDF-logo.svg"
OUT_DIR = REPO_ROOT / "backend" / "pipeline" / "retainpdf_pipeline" / "render" / "output" / "watermark"

COLOR = "#262626"
OPACITY = 0.32  # 白底上是浅灰，压在图上也看得见、不抢正文
LOGO_HEIGHT = 12.0  # 基准尺寸（pt），盖的时候按页面大小缩放
GAP = 3.0
WORD_FONT = "Helvetica Neue"
WORD_SIZE = 10.5
PNG_SCALE = 8


def _faded(svg: str) -> str:
    """填充、描边都改成水印色并加透明度。描边去掉（半透明时描边和填充叠出一圈深边）。"""
    svg = re.sub(r'fill="#[0-9a-fA-F]{3,6}"', f'fill="{COLOR}" fill-opacity="{OPACITY}"', svg)
    svg = re.sub(r'stroke="#[0-9a-fA-F]{3,6}"', 'stroke="none"', svg)
    return svg


def _svg_page(svg: str) -> fitz.Document:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "part.svg"
        path.write_text(svg, encoding="utf-8")
        with fitz.open(path) as doc:
            return fitz.open("pdf", doc.convert_to_pdf())


def _word_svg() -> str:
    with tempfile.TemporaryDirectory() as tmp:
        source = Path(tmp) / "word.typ"
        source.write_text(
            "#set page(width: auto, height: auto, margin: 0pt, fill: none)\n"
            f'#text(font: "{WORD_FONT}", weight: "medium", size: {WORD_SIZE}pt, fill: rgb("{COLOR}"), tracking: 0.15pt)[RetainPDF]\n',
            encoding="utf-8",
        )
        target = Path(tmp) / "word.svg"
        subprocess.run(["typst", "compile", str(source), str(target)], check=True)
        return target.read_text(encoding="utf-8")


def build() -> None:
    logo = _svg_page(_faded(LOGO_SVG.read_text(encoding="utf-8")))
    word = _svg_page(_faded(_word_svg()))
    logo_rect, word_rect = logo[0].rect, word[0].rect
    logo_width = LOGO_HEIGHT * logo_rect.width / logo_rect.height
    word_height = word_rect.height
    width = logo_width + GAP + word_rect.width
    stamp = fitz.open()
    page = stamp.new_page(width=width, height=LOGO_HEIGHT)
    page.show_pdf_page(fitz.Rect(0, 0, logo_width, LOGO_HEIGHT), logo, 0)
    top = (LOGO_HEIGHT - word_height) / 2
    page.show_pdf_page(fitz.Rect(logo_width + GAP, top, width, top + word_height), word, 0)
    if page.get_text().strip():
        raise SystemExit("水印里不该有文字（字样应当是路径）")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stamp.save(OUT_DIR / "stamp.pdf", garbage=4, deflate=True, clean=True)
    # 位图从存好的 stamp.pdf 重新打开再渲：存盘（garbage）以后原来的 page 对象失效，会按默认的信纸大小渲出一张几乎全透明的大图
    with fitz.open(OUT_DIR / "stamp.pdf") as saved:
        saved[0].get_pixmap(matrix=fitz.Matrix(PNG_SCALE, PNG_SCALE), alpha=True).save(OUT_DIR / "stamp.png")
    print(f"stamp {width:.1f}x{LOGO_HEIGHT:.1f}pt -> {OUT_DIR}")


if __name__ == "__main__":
    build()
    sys.exit(0)
