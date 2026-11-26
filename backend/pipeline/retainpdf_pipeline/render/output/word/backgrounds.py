from __future__ import annotations

from pathlib import Path

import fitz

from retainpdf_base.io import atomic_write_bytes


def render_page_backgrounds(source_pdf_path: Path, output_dir: Path, *, dpi: int) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    scale = dpi / 72.0
    matrix = fitz.Matrix(scale, scale)
    paths: list[Path] = []
    with fitz.open(source_pdf_path) as doc:
        for page_index, page in enumerate(doc):
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            path = output_dir / f"page-{page_index + 1:03d}.png"
            # 原子写（底座包唯一的那份）：同一个 dpi 的两份导出（带水印、不带水印）共用这个目录、同时在写同一批图，
            # 原地写的话另一份的 node 可能读到写了一半的图（R3）。内容一样，谁后换名都对。缓存图不必落盘到底。
            atomic_write_bytes(path, pix.tobytes("png"), durable=False)
            paths.append(path)
    return paths
