"""导出水印（2026-11-20）：素材和位置。

- `stamp.pdf`：矢量水印，盖 PDF 用；`stamp.png`：透明底位图，Word 用。都由 devtools/build_watermark_stamp.py 生成。
- `stamp_rect`：看到的页面上水印放在哪（右下角），PDF（本包的 `pdf.py`）和 Word 导出共用这一套。
"""

from __future__ import annotations

from pathlib import Path

import fitz

WATERMARK_DIR = Path(__file__).resolve().parent
STAMP_PDF = WATERMARK_DIR / "stamp.pdf"
STAMP_PNG = WATERMARK_DIR / "stamp.png"
# 水印高度按页面短边的比例（A4 约 10pt），夹在可读和不碍事之间
HEIGHT_SHARE = 0.017
MIN_HEIGHT, MAX_HEIGHT = 7.0, 16.0


def stamp_aspect() -> float:
    with fitz.open(STAMP_PDF) as stamp:
        return stamp[0].rect.width / stamp[0].rect.height


def stamp_rect(visible: fitz.Rect, aspect: float) -> fitz.Rect:
    """看到的页面上水印放在哪：右下角，离右边、下边各留一点空。"""
    height = min(MAX_HEIGHT, max(MIN_HEIGHT, min(visible.width, visible.height) * HEIGHT_SHARE))
    width = height * aspect
    margin_x = max(10.0, height * 1.2)
    margin_y = max(8.0, height * 0.9)
    return fitz.Rect(visible.x1 - margin_x - width, visible.y1 - margin_y - height, visible.x1 - margin_x, visible.y1 - margin_y)
