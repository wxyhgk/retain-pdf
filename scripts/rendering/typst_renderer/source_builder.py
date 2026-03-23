from __future__ import annotations

import os
from pathlib import Path

from config import fonts
from rendering.models import RenderBlock
from rendering.render_payloads import build_render_blocks
from rendering.typst_renderer.shared import CMARKER_VERSION
from rendering.typst_renderer.shared import MITEX_VERSION
from rendering.typst_renderer.shared import escape_typst_string


def _build_typst_block(block_id: str, block: RenderBlock) -> str:
    var_prefix = block_id.replace("-", "_")
    x0, y0, x1, y1 = block.inner_bbox
    width = max(8.0, x1 - x0)
    height = max(8.0, y1 - y0)
    font_size = max(1.0, block.font_size_pt)
    leading = max(0.1, block.leading_em)

    if block.render_kind == "plain_line":
        text_name = f"{var_prefix}_txt"
        base_name = f"{var_prefix}_base"
        scaled_name = f"{var_prefix}_scaled"
        plain_text = block.plain_text
        return (
            f'#let {text_name} = "{escape_typst_string(plain_text)}"\n'
            f"#let {base_name} = box[#{{ set text(size: {font_size}pt); {text_name} }}]\n"
            "#context {\n"
            f"  let base-size = measure({base_name})\n"
            f"  let scaled-font = if base-size.width > {width}pt {{ {font_size}pt * ({width}pt / base-size.width) }} else {{ {font_size}pt }}\n"
            f"  let {scaled_name} = box[#{{ set text(size: scaled-font); {text_name} }}]\n"
            f"  let size = measure({scaled_name})\n"
            f"  place(top + left, dx: {x0}pt, dy: {y0}pt + ({height}pt - size.height) / 2, {scaled_name})\n"
            "}"
        )

    markdown_name = f"{var_prefix}_md"
    body_name = f"{var_prefix}_body"
    markdown = block.markdown_text
    return (
        f'#let {markdown_name} = "{escape_typst_string(markdown)}"\n'
        f"#let {body_name} = block(width: {width}pt)[#{{ set text(size: {font_size}pt); set par(leading: {leading}em); cmarker.render({markdown_name}, math: mitex) }}]\n"
        "#context {\n"
        f"  let size = measure({body_name})\n"
        f"  let y = if size.height > {height}pt {{ {y0}pt }} else {{ {y0}pt + ({height}pt - size.height) / 2 }}\n"
        f"  place(top + left, dx: {x0}pt, dy: y, {body_name})\n"
        "}"
    )


def _build_cover_rect(block_id: str, block: RenderBlock) -> str:
    rect_name = f"{block_id.replace('-', '_')}_cover"
    x0, y0, x1, y1 = block.bbox
    width = max(8.0, x1 - x0)
    height = max(8.0, y1 - y0)
    return (
        f"#let {rect_name} = rect(width: {width}pt, height: {height}pt, fill: white)\n"
        "#context {\n"
        f"  place(top + left, dx: {x0}pt, dy: {y0}pt, {rect_name})\n"
        "}"
    )


def build_typst_overlay_source(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
) -> str:
    return build_typst_book_overlay_source([(page_width, page_height, translated_items)], font_family=font_family)


def build_typst_book_overlay_source(
    page_specs: list[tuple[float, float, list[dict]]],
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
) -> str:
    lines = [
        f'#set text(font: "{font_family}", size: {fonts.DEFAULT_FONT_SIZE}pt)',
        f'#import "@preview/cmarker:{CMARKER_VERSION}"',
        f'#import "@preview/mitex:{MITEX_VERSION}": mitex',
        '#show math.equation.where(block: false): set math.frac(style: "horizontal")',
    ]

    for page_index, (page_width, page_height, translated_items) in enumerate(page_specs):
        render_blocks = build_render_blocks(translated_items)
        lines.append(f"#set page(width: {page_width}pt, height: {page_height}pt, margin: 0pt)")
        for index, block in enumerate(render_blocks):
            lines.append(_build_typst_block(f"p{page_index}_{block.block_id}_{index}", block))
        if page_index + 1 < len(page_specs):
            lines.append("#pagebreak()")

    return "\n".join(lines) + "\n"


def build_typst_book_background_source(
    source_pdf_path: Path,
    page_specs: list[tuple[int, float, float, list[dict]]],
    work_dir: Path,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
) -> str:
    source_rel = os.path.relpath(source_pdf_path, work_dir)
    lines = [
        f'#set text(font: "{font_family}", size: {fonts.DEFAULT_FONT_SIZE}pt)',
        f'#import "@preview/cmarker:{CMARKER_VERSION}"',
        f'#import "@preview/mitex:{MITEX_VERSION}": mitex',
        '#show math.equation.where(block: false): set math.frac(style: "horizontal")',
    ]

    for page_index, (source_page_idx, page_width, page_height, translated_items) in enumerate(page_specs):
        render_blocks = build_render_blocks(translated_items)
        lines.append(f"#set page(width: {page_width}pt, height: {page_height}pt, margin: 0pt)")
        lines.append(
            f'#place(top + left, dx: 0pt, dy: 0pt, image("{source_rel}", page: {source_page_idx + 1}, width: {page_width}pt))'
        )
        for index, block in enumerate(render_blocks):
            block_id = f"bgp{page_index}_{block.block_id}_{index}"
            lines.append(_build_cover_rect(block_id, block))
            lines.append(_build_typst_block(block_id, block))
        if page_index + 1 < len(page_specs):
            lines.append("#pagebreak()")

    return "\n".join(lines) + "\n"
