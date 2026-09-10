from __future__ import annotations

import os
from pathlib import Path
from typing import Callable

from retainpdf_pipeline.foundation.config import fonts
from retainpdf_pipeline.render.layout.model.models import RenderBlock
from retainpdf_pipeline.render.layout.payload.blocks import build_render_blocks
from retainpdf_pipeline.render.output.typst import block_config as typst_config
from retainpdf_pipeline.render.output.typst.fit_helpers import render_block_fit_helpers
from retainpdf_pipeline.services.pipeline_shared.events import emit_render_page_progress


BuildTypstBlockFn = Callable[[str, RenderBlock], str]


def typst_book_prelude(font_family: str) -> list[str]:
    lines = [
        f'#set text(font: "{font_family}", size: {fonts.DEFAULT_FONT_SIZE}pt)',
    ]
    lines.extend(typst_config.typst_package_imports())
    lines.extend(render_block_fit_helpers())
    return lines


def append_overlay_page_source(
    lines: list[str],
    *,
    page_index: int,
    page_count: int,
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    block_builder: BuildTypstBlockFn,
) -> None:
    render_blocks = build_render_blocks(translated_items, page_width=page_width, page_height=page_height)
    lines.append(f"#set page(width: {page_width}pt, height: {page_height}pt, margin: 0pt, fill: none)")
    for index, block in enumerate(render_blocks):
        block_id = f"p{page_index}_{block.block_id}_{index}"
        lines.append(block_builder(block_id, block))
    if page_index + 1 < page_count:
        lines.append("#pagebreak()")


def append_background_page_source(
    lines: list[str],
    *,
    page_index: int,
    page_count: int,
    source_page_idx: int,
    source_rel: str,
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    block_builder: BuildTypstBlockFn,
) -> None:
    render_blocks = build_render_blocks(translated_items, page_width=page_width, page_height=page_height)
    lines.append(f"#set page(width: {page_width}pt, height: {page_height}pt, margin: 0pt, fill: none)")
    lines.append(
        f'#place(top + left, dx: 0pt, dy: 0pt, image("{source_rel}", page: {source_page_idx + 1}, width: {page_width}pt))'
    )
    for index, block in enumerate(render_blocks):
        block_id = f"bgp{page_index}_{block.block_id}_{index}"
        lines.append(block_builder(block_id, block))
    if page_index + 1 < page_count:
        lines.append("#pagebreak()")


def build_book_overlay_source_lines(
    page_specs: list[tuple[float, float, list[dict]]],
    *,
    font_family: str,
    block_builder: BuildTypstBlockFn,
) -> list[str]:
    lines = typst_book_prelude(font_family)
    page_count = len(page_specs)
    for page_index, (page_width, page_height, translated_items) in enumerate(page_specs):
        append_overlay_page_source(
            lines,
            page_index=page_index,
            page_count=page_count,
            page_width=page_width,
            page_height=page_height,
            translated_items=translated_items,
            block_builder=block_builder,
        )
        emit_render_page_progress(
            current=page_index + 1,
            total=page_count,
            message=f"正在生成整本 Typst overlay，第 {page_index + 1}/{page_count} 页",
            payload={"render_stage": "whole_book_overlay_source_build", "page_index": page_index},
        )
    return lines


def build_book_background_source_lines(
    source_pdf_path: Path,
    page_specs: list[tuple[int, float, float, list[dict]]],
    *,
    work_dir: Path,
    font_family: str,
    block_builder: BuildTypstBlockFn,
) -> list[str]:
    source_rel = os.path.relpath(source_pdf_path, work_dir)
    lines = typst_book_prelude(font_family)
    page_count = len(page_specs)
    for page_index, (source_page_idx, page_width, page_height, translated_items) in enumerate(page_specs):
        append_background_page_source(
            lines,
            page_index=page_index,
            page_count=page_count,
            source_page_idx=source_page_idx,
            source_rel=source_rel,
            page_width=page_width,
            page_height=page_height,
            translated_items=translated_items,
            block_builder=block_builder,
        )
        emit_render_page_progress(
            current=page_index + 1,
            total=page_count,
            message=f"正在生成整本 Typst 背景渲染，第 {page_index + 1}/{page_count} 页",
            payload={"render_stage": "whole_book_background_source_build", "page_index": source_page_idx},
        )
    return lines


__all__ = [
    "BuildTypstBlockFn",
    "append_background_page_source",
    "append_overlay_page_source",
    "build_book_background_source_lines",
    "build_book_overlay_source_lines",
    "typst_book_prelude",
]
