from __future__ import annotations

from pathlib import Path

from services.rendering.source.compression.analysis import source_pdf_has_vector_graphics
from services.rendering.source.compression.ghostscript import compress_pdf_with_ghostscript_file
from services.rendering.source.compression.pdf_copy import build_image_compressed_pdf_copy
from services.rendering.source.compression.pdf_copy import compress_pdf_images_only


def compress_pdf_with_ghostscript(
    pdf_path: Path,
    *,
    dpi: int = 200,
    source_pdf_path: Path | None = None,
    render_mode: str | None = None,
    start_page: int = 0,
    end_page: int = -1,
) -> bool:
    if dpi <= 0 or not pdf_path.exists():
        return False
    if render_mode == "overlay" and source_pdf_path and source_pdf_has_vector_graphics(
        source_pdf_path,
        start_page=start_page,
        end_page=end_page,
    ):
        print(
            "skip Ghostscript: vector-heavy source PDF detected for overlay mode",
            flush=True,
        )
        return False

    return compress_pdf_with_ghostscript_file(pdf_path, dpi=dpi)
