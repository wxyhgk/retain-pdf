"""导出的 PDF 每页右下角盖上「logo + RetainPDF」水印（2026-11-20 用户定：默认开、右下角）。

只在下载时盖（Rust 的下载出口按需生成、缓存，`?watermark=0` 取原版）：阅读页、页预览、渲染产物本身都不带水印。
水印是 `render/output/watermark/stamp.pdf`（纯矢量，字样是路径不是文字，由 `devtools/build_watermark_stamp.py` 生成，位置算法在本包的 `stamp_rect`，Word 导出共用），
每页引用同一个对象，整本只多几 KB。位置按**看到的**页面算：页面旋转过（/Rotate 90）也在看到的右下角。

    retainpdf-pipeline watermark-pdf --input-pdf in.pdf --output-pdf out.pdf
"""

from __future__ import annotations

import argparse
from pathlib import Path

import fitz

from retainpdf_pipeline.render.output.watermark import STAMP_PDF
from retainpdf_pipeline.render.output.watermark import stamp_rect


def watermark_pdf(input_pdf: Path, output_pdf: Path, *, stamp_pdf: Path = STAMP_PDF) -> int:
    """返回盖了几页。"""
    with fitz.open(stamp_pdf) as stamp, fitz.open(input_pdf) as doc:
        aspect = stamp[0].rect.width / stamp[0].rect.height
        for page in doc:
            # page.rect 是看到的（转过以后的）页面；插入用的是没转的坐标，换算回去，水印跟着页面转同样的角度（看起来是正的）
            target = stamp_rect(page.rect, aspect) * page.derotation_matrix
            page.show_pdf_page(target, stamp, 0, rotate=page.rotation, overlay=True)
        output_pdf.parent.mkdir(parents=True, exist_ok=True)
        # 对象流：不然重新存一遍就比原文件大一成（实测 632KB → 690KB，水印本身只占十几 KB）
        doc.save(output_pdf, garbage=3, deflate=True, use_objstms=1)
        return doc.page_count


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="stamp the RetainPDF watermark on every page")
    parser.add_argument("--input-pdf", type=Path, required=True)
    parser.add_argument("--output-pdf", type=Path, required=True)
    args = parser.parse_args(argv)
    watermark_pdf(args.input_pdf, args.output_pdf)


if __name__ == "__main__":
    main()
