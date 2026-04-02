from __future__ import annotations

from pathlib import Path

from foundation.config import fonts
from foundation.config import paths
from services.rendering.typst.compiler import compile_typst_book_overlay_pdf
from services.rendering.typst.sanitize import compile_overlay_pdf_resilient
from services.rendering.typst.shared import prepare_typst_work_dir


def compile_page_overlay_pdf(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    stem: str,
    *,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    include_cover_rect: bool = False,
    font_paths: list[Path] | None = None,
    temp_root: Path | None = None,
    work_subdir: str = "page-overlays",
) -> Path:
    base_dir = temp_root or paths.OUTPUT_DIR
    base_dir.mkdir(parents=True, exist_ok=True)
    work_dir = prepare_typst_work_dir(base_dir, work_subdir, stem)
    return compile_overlay_pdf_resilient(
        page_width,
        page_height,
        translated_items,
        stem=stem,
        api_key=api_key,
        model=model,
        base_url=base_url,
        font_family=font_family,
        include_cover_rect=include_cover_rect,
        font_paths=font_paths,
        work_dir=work_dir,
    )


def compile_book_overlay_pdf(
    page_specs: list[tuple[float, float, list[dict]]],
    stem: str,
    *,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    include_cover_rect: bool = False,
    font_paths: list[Path] | None = None,
    temp_root: Path | None = None,
) -> Path:
    base_dir = temp_root or paths.OUTPUT_DIR
    base_dir.mkdir(parents=True, exist_ok=True)
    work_dir = prepare_typst_work_dir(base_dir, "book-overlays")
    return compile_typst_book_overlay_pdf(
        page_specs,
        stem=stem,
        font_family=font_family,
        include_cover_rect=include_cover_rect,
        font_paths=font_paths,
        work_dir=work_dir,
    )
