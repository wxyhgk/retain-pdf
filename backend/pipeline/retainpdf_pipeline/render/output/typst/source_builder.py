from __future__ import annotations

from pathlib import Path

from retainpdf_pipeline.foundation.config import fonts
from retainpdf_pipeline.render.output.typst.block_renderer import build_typst_block
from retainpdf_pipeline.render.output.typst.source_pages import build_book_background_source_lines
from retainpdf_pipeline.render.output.typst.source_pages import build_book_overlay_source_lines


def build_typst_overlay_source(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    include_cover_rect: bool = False,
) -> str:
    return build_typst_book_overlay_source(
        [(page_width, page_height, translated_items)],
        font_family=font_family,
        include_cover_rect=include_cover_rect,
    )


def build_typst_book_overlay_source(
    page_specs: list[tuple[float, float, list[dict]]],
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    include_cover_rect: bool = False,
) -> str:
    lines = build_book_overlay_source_lines(
        page_specs,
        font_family=font_family,
        block_builder=lambda block_id, block: build_typst_block(
            block_id,
            block,
            include_fill=include_cover_rect,
        ),
    )
    return "\n".join(lines) + "\n"


def build_typst_book_background_source(
    source_pdf_path: Path,
    page_specs: list[tuple[int, float, float, list[dict]]],
    work_dir: Path,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
) -> str:
    lines = build_book_background_source_lines(
        source_pdf_path,
        page_specs,
        work_dir=work_dir,
        font_family=font_family,
        block_builder=lambda block_id, block: build_typst_block(block_id, block, include_fill=True),
    )
    return "\n".join(lines) + "\n"
