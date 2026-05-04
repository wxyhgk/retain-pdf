from __future__ import annotations

import os
from pathlib import Path

from foundation.config import fonts
from services.rendering.api.render_payloads import build_render_blocks
from services.rendering.core.models import RenderBlock
from services.rendering.typst.shared import CMARKER_VERSION
from services.rendering.typst.shared import MITEX_VERSION
from services.rendering.typst.shared import escape_typst_string


def _fit_markdown_typst_helpers() -> list[str]:
    return [
        "#let pdftr_fit_size(lo, hi, eps, fits) = {",
        "  if hi - lo <= eps {",
        "    lo",
        "  } else {",
        "    let mid = lo + (hi - lo) / 2",
        "    if fits(mid) {",
        "      pdftr_fit_size(mid, hi, eps, fits)",
        "    } else {",
        "      pdftr_fit_size(lo, mid, eps, fits)",
        "    }",
        "  }",
        "}",
        "#let pdftr_floor_size(value, floor) = if value < floor { floor } else { value }",
        "#let pdftr_floor_leading(value, floor) = if value < floor { floor } else { value }",
        '#let pdftr_fit_markdown(markdown, max_size: 10pt, min_size: 9pt, max_leading: 0.66em, min_leading: 0.54em, fit_height: none, weight: "regular", eps: 0.08pt) = {',
        "  layout(size => {",
        "    let allowed-height = if fit_height == none { size.height } else { calc.min(size.height, fit_height) }",
        "    let render(text_size, leading) = block(width: size.width)[#{",
        "      set text(size: text_size, weight: weight)",
        "      set par(leading: leading)",
        "      cmarker.render(markdown, math: mitex)",
        "    }]",
        "    let fits(text_size, leading) = measure(width: size.width, render(text_size, leading)).height <= allowed-height",
        "    if fits(max_size, max_leading) {",
        "      render(max_size, max_leading)",
        "    } else {",
        "      let fallback_min_size = pdftr_floor_size(min_size - 1.6pt, 5.4pt)",
        "      let fallback_min_leading = pdftr_floor_leading(min_leading - 0.12em, 0.14em)",
        "      let emergency_min_size = pdftr_floor_size(fallback_min_size - 1.2pt, 4.8pt)",
        "      let emergency_min_leading = pdftr_floor_leading(fallback_min_leading - 0.08em, 0.10em)",
        "      let chosen_leading = if fits(min_size, max_leading) { max_leading } else { min_leading }",
        "      let chosen_size = if not fits(min_size, chosen_leading) {",
        "        let fallback_leading = pdftr_floor_leading(chosen_leading - 0.12em, fallback_min_leading)",
        "        let emergency_leading = pdftr_floor_leading(fallback_leading - 0.08em, emergency_min_leading)",
        "        if not fits(fallback_min_size, fallback_leading) {",
        "          if not fits(emergency_min_size, emergency_leading) {",
        "            emergency_min_size",
        "          } else {",
        "            pdftr_fit_size(emergency_min_size, fallback_min_size, eps, size_pt => fits(size_pt, emergency_leading))",
        "          }",
        "        } else {",
        "          pdftr_fit_size(fallback_min_size, min_size, eps, size_pt => fits(size_pt, fallback_leading))",
        "        }",
        "      } else {",
        "        pdftr_fit_size(min_size, max_size, eps, size_pt => fits(size_pt, chosen_leading))",
        "      }",
        "      let final_leading = if fits(min_size, chosen_leading) {",
        "        chosen_leading",
        "      } else if fits(fallback_min_size, pdftr_floor_leading(chosen_leading - 0.12em, fallback_min_leading)) {",
        "        pdftr_floor_leading(chosen_leading - 0.12em, fallback_min_leading)",
        "      } else {",
        "        emergency_min_leading",
        "      }",
        "      render(chosen_size, final_leading)",
        "    }",
        "  })",
        "}",
    ]


def _typst_rgb(color: tuple[float, float, float]) -> str:
    r, g, b = color
    return f"rgb({int(max(0, min(1, r)) * 255)}, {int(max(0, min(1, g)) * 255)}, {int(max(0, min(1, b)) * 255)})"


def _build_typst_block(block_id: str, block: RenderBlock) -> str:
    var_prefix = block_id.replace("-", "_")
    x0, y0, x1, y1 = block.inner_bbox
    width = max(8.0, x1 - x0)
    height = max(8.0, y1 - y0)
    font_size = max(1.0, block.font_size_pt)
    leading = max(0.1, block.leading_em)
    font_weight = block.font_weight if str(block.font_weight or "").strip() else "regular"
    text_fill = _typst_rgb(block.text_color)

    if block.render_kind == "plain_line":
        text_name = f"{var_prefix}_txt"
        base_name = f"{var_prefix}_base"
        scaled_name = f"{var_prefix}_scaled"
        plain_text = block.plain_text
        return (
            f'#let {text_name} = "{escape_typst_string(plain_text)}"\n'
            f'#let {base_name} = box[#{{ set text(size: {font_size}pt, weight: "{font_weight}", fill: {text_fill}); {text_name} }}]\n'
            "#context {\n"
            f"  let base-size = measure({base_name})\n"
            f"  let scaled-font = if base-size.width > {width}pt {{ {font_size}pt * ({width}pt / base-size.width) }} else {{ {font_size}pt }}\n"
            f'  let {scaled_name} = box[#{{ set text(size: scaled-font, weight: "{font_weight}", fill: {text_fill}); {text_name} }}]\n'
            f"  place(top + left, dx: {x0}pt, dy: {y0}pt, {scaled_name})\n"
            "}"
        )

    markdown_name = f"{var_prefix}_md"
    body_name = f"{var_prefix}_body"
    markdown = block.markdown_text
    if block.fit_to_box:
        fit_min_font = max(1.0, min(block.fit_min_font_size_pt or font_size, font_size))
        fit_min_leading = max(0.1, min(block.fit_min_leading_em or leading, leading))
        fit_height = max(8.0, min(height, block.fit_max_height_pt or height))
        return (
            f'#let {markdown_name} = "{escape_typst_string(markdown)}"\n'
            f'#let {body_name} = block(width: {width}pt, height: {fit_height}pt)[#{{ set text(fill: {text_fill}); pdftr_fit_markdown({markdown_name}, max_size: {font_size}pt, min_size: {fit_min_font}pt, max_leading: {leading}em, min_leading: {fit_min_leading}em, fit_height: {fit_height}pt, weight: "{font_weight}") }}]\n'
            "#context {\n"
            f"  place(top + left, dx: {x0}pt, dy: {y0}pt, {body_name})\n"
            "}"
        )
    return (
        f'#let {markdown_name} = "{escape_typst_string(markdown)}"\n'
        f'#let {body_name} = block(width: {width}pt)[#{{ set text(size: {font_size}pt, weight: "{font_weight}", fill: {text_fill}); set par(leading: {leading}em); cmarker.render({markdown_name}, math: mitex) }}]\n'
        "#context {\n"
        f"  place(top + left, dx: {x0}pt, dy: {y0}pt, {body_name})\n"
        "}"
    )


def _build_cover_rect(block_id: str, block: RenderBlock) -> str:
    rect_name = f"{block_id.replace('-', '_')}_cover"
    x0, y0, x1, y1 = block.cover_bbox
    width = max(8.0, x1 - x0)
    height = max(8.0, y1 - y0)
    cover_fill = _typst_rgb(block.cover_fill)
    return (
        f"#let {rect_name} = rect(width: {width}pt, height: {height}pt, fill: {cover_fill})\n"
        "#context {\n"
        f"  place(top + left, dx: {x0}pt, dy: {y0}pt, {rect_name})\n"
        "}"
    )


def build_typst_overlay_source(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    include_cover_rect: bool = True,
) -> str:
    return build_typst_book_overlay_source(
        [(page_width, page_height, translated_items)],
        font_family=font_family,
        include_cover_rect=include_cover_rect,
    )


def build_typst_book_overlay_source(
    page_specs: list[tuple[float, float, list[dict]]],
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    include_cover_rect: bool = True,
) -> str:
    lines = [
        f'#set text(font: "{font_family}", size: {fonts.DEFAULT_FONT_SIZE}pt)',
        f'#import "@preview/cmarker:{CMARKER_VERSION}"',
        f'#import "@preview/mitex:{MITEX_VERSION}": mitex',
        '#show math.equation.where(block: false): set math.frac(style: "horizontal")',
    ]
    lines.extend(_fit_markdown_typst_helpers())

    for page_index, (page_width, page_height, translated_items) in enumerate(page_specs):
        render_blocks = build_render_blocks(translated_items, page_width=page_width, page_height=page_height)
        lines.append(f"#set page(width: {page_width}pt, height: {page_height}pt, margin: 0pt, fill: none)")
        for index, block in enumerate(render_blocks):
            block_id = f"p{page_index}_{block.block_id}_{index}"
            if include_cover_rect:
                lines.append(_build_cover_rect(block_id, block))
            lines.append(_build_typst_block(block_id, block))
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
    lines.extend(_fit_markdown_typst_helpers())

    for page_index, (source_page_idx, page_width, page_height, translated_items) in enumerate(page_specs):
        render_blocks = build_render_blocks(translated_items, page_width=page_width, page_height=page_height)
        lines.append(f"#set page(width: {page_width}pt, height: {page_height}pt, margin: 0pt, fill: none)")
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
