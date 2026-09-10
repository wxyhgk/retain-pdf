from __future__ import annotations

from pathlib import Path

import fitz


def render_page_backgrounds(source_pdf_path: Path, output_dir: Path, *, dpi: int) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    scale = dpi / 72.0
    matrix = fitz.Matrix(scale, scale)
    paths: list[Path] = []
    with fitz.open(source_pdf_path) as doc:
        for page_index, page in enumerate(doc):
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            path = output_dir / f"page-{page_index + 1:03d}.png"
            pix.save(path)
            paths.append(path)
    return paths
