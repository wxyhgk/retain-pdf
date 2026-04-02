from __future__ import annotations

import shutil
from pathlib import Path

from services.rendering.compress.analysis import source_pdf_has_vector_graphics
from services.rendering.compress.ghostscript import compress_pdf_with_ghostscript_file
from services.rendering.compress.image_pipeline import compress_pdf_images_only_impl


def _compress_pdf_images_only_impl(
    pdf_path: Path,
    *,
    dpi: int = 200,
) -> bool:
    return compress_pdf_images_only_impl(pdf_path, dpi=dpi)


def build_image_compressed_pdf_copy(
    source_pdf_path: Path,
    output_pdf_path: Path,
    *,
    dpi: int = 200,
) -> bool:
    if dpi <= 0 or not source_pdf_path.exists():
        return False
    if source_pdf_path.resolve() == output_pdf_path.resolve():
        return _compress_pdf_images_only_impl(output_pdf_path, dpi=dpi)

    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_pdf_path, output_pdf_path)
    changed = _compress_pdf_images_only_impl(output_pdf_path, dpi=dpi)
    if not changed:
        output_pdf_path.unlink(missing_ok=True)
        return False
    return True


def compress_pdf_images_only(
    pdf_path: Path,
    *,
    dpi: int = 200,
) -> bool:
    return _compress_pdf_images_only_impl(pdf_path, dpi=dpi)


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
