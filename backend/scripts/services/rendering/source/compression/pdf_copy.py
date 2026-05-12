from __future__ import annotations

import shutil
from pathlib import Path

from services.rendering.source.compression.image_pipeline import compress_pdf_images_only_impl


def compress_pdf_images_only(
    pdf_path: Path,
    *,
    dpi: int = 200,
) -> bool:
    try:
        return compress_pdf_images_only_impl(pdf_path, dpi=dpi)
    except Exception as exc:
        print(
            f"image-only compress: skipped for {pdf_path} "
            f"reason={type(exc).__name__}: {exc}",
            flush=True,
        )
        return False


def build_image_compressed_pdf_copy(
    source_pdf_path: Path,
    output_pdf_path: Path,
    *,
    dpi: int = 200,
) -> bool:
    if dpi <= 0 or not source_pdf_path.exists():
        return False
    if source_pdf_path.resolve() == output_pdf_path.resolve():
        return compress_pdf_images_only(output_pdf_path, dpi=dpi)

    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_pdf_path, output_pdf_path)
    changed = compress_pdf_images_only(output_pdf_path, dpi=dpi)
    if not changed:
        output_pdf_path.unlink(missing_ok=True)
        return False
    return True


__all__ = [
    "build_image_compressed_pdf_copy",
    "compress_pdf_images_only",
]
