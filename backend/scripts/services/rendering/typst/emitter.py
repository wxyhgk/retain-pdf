from __future__ import annotations

import os
from pathlib import Path

from foundation.config import fonts
from services.rendering.core.models import RenderLayoutBlock
from services.rendering.core.models import RenderPageSpec
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
        '#let pdftr_fit_single_line_markdown(markdown, max_size: 10pt, min_size: 9pt, fit_width: none, fit_height: none, weight: "regular", eps: 0.08pt) = {',
        "  layout(size => {",
        "    let allowed-width = if fit_width == none { size.width } else { calc.min(size.width, fit_width) }",
        "    let allowed-height = if fit_height == none { size.height } else { calc.min(size.height, fit_height) }",
        "    let render(text_size) = box(inset: 0pt, clip: false)[#{",
        "      set text(size: text_size, weight: weight)",
        "      set par(leading: 1em)",
        "      cmarker.render(markdown, math: mitex)",
        "    }]",
        "    let fits(text_size) = {",
        "      let measured = measure(render(text_size))",
        "      measured.width <= allowed-width and measured.height <= allowed-height",
        "    }",
        "    let chosen-size = if fits(max_size) {",
        "      max_size",
        "    } else {",
        "      pdftr_fit_size(min_size, max_size, eps, size_pt => fits(size_pt))",
        "    }",
        "    box(width: allowed-width, height: allowed-height, inset: 0pt, clip: false)[#{",
        "      set text(size: chosen-size, weight: weight)",
        "      set par(leading: 1em)",
        "      cmarker.render(markdown, math: mitex)",
        "    }]",
        "  })",
        "}",
        "#let pdftr_fit_markdown(markdown, max_size: 10pt, min_size: 9pt, max_leading: 0.66em, min_leading: 0.54em, fit_height: none, eps: 0.08pt) = {",
        "  layout(size => {",
        "    let allowed-height = if fit_height == none { size.height } else { calc.min(size.height, fit_height) }",
        "    let render(text_size, leading) = block(width: size.width)[#{",
        "      set text(size: text_size)",
        "      set par(leading: leading)",
        "      cmarker.render(markdown, math: mitex)",
        "    }]",
        "    let fits(text_size, leading) = measure(width: size.width, render(text_size, leading)).height <= allowed-height",
        "    if fits(max_size, max_leading) {",
        "      render(max_size, max_leading)",
        "    } else {",
        "      let chosen-size = pdftr_fit_size(min_size, max_size, eps, size_pt => fits(size_pt, min_leading))",
        "      render(chosen-size, min_leading)",
        "    }",
        "  })",
        "}",
    ]


def _build_layout_block(block_id: str, block: RenderLayoutBlock) -> str:
    var_prefix = block_id.replace("-", "_")
    x0, y0, x1, y1 = block.content_rect
    width = max(8.0, x1 - x0)
    height = max(8.0, y1 - y0)
    font_size = max(1.0, block.font_size_pt)
    leading = max(0.1, block.leading_em)
    font_weight = block.font_weight if str(block.font_weight or "").strip() else "regular"

    if block.content_kind == "plain":
        text_name = f"{var_prefix}_txt"
        body_name = f"{var_prefix}_body"
        return (
            f'#let {text_name} = "{escape_typst_string(block.plain_text)}"\n'
            f'#let {body_name} = box[#{{ set text(size: {font_size}pt, weight: "{font_weight}"); {text_name} }}]\n'
            "#context {\n"
            f"  place(top + left, dx: {x0}pt, dy: {y0}pt, {body_name})\n"
            "}"
        )

    markdown_name = f"{var_prefix}_md"
    body_name = f"{var_prefix}_body"
    if block.fit_to_box:
        if block.fit_single_line:
            fit_min_font = max(1.0, min(block.fit_min_font_size_pt or font_size, font_size))
            fit_max_font = max(font_size, block.fit_max_font_size_pt or font_size)
            fit_height = max(8.0, max(min(height, block.fit_max_height_pt or height), block.fit_target_height_pt or 0.0))
            fit_width = max(width, block.fit_target_width_pt or 0.0)
            place_y = y0 - max(0.0, block.fit_shift_up_pt or 0.0)
            fit_call = (
                f'pdftr_fit_single_line_markdown({markdown_name}, max_size: {fit_max_font}pt, min_size: {fit_min_font}pt, fit_width: {fit_width}pt, fit_height: {fit_height}pt, weight: "{font_weight}")'
            )
            return (
                f'#let {markdown_name} = "{escape_typst_string(block.content_text)}"\n'
                f'#let {body_name} = block(width: {fit_width}pt, height: {fit_height}pt)[#{{ {fit_call} }}]\n'
                "#context {\n"
                f"  place(top + left, dx: {x0}pt, dy: {place_y}pt, {body_name})\n"
                "}"
            )
        fit_min_font = max(1.0, min(block.fit_min_font_size_pt or font_size, font_size))
        fit_min_leading = max(0.1, min(block.fit_min_leading_em or leading, leading))
        fit_height = max(8.0, min(height, block.fit_max_height_pt or height))
        return (
            f'#let {markdown_name} = "{escape_typst_string(block.content_text)}"\n'
            f"#let {body_name} = block(width: {width}pt, height: {height}pt)[#{{ pdftr_fit_markdown({markdown_name}, max_size: {font_size}pt, min_size: {fit_min_font}pt, max_leading: {leading}em, min_leading: {fit_min_leading}em, fit_height: {fit_height}pt) }}]\n"
            "#context {\n"
            f"  place(top + left, dx: {x0}pt, dy: {y0}pt, {body_name})\n"
            "}"
        )
    return (
        f'#let {markdown_name} = "{escape_typst_string(block.content_text)}"\n'
        f"#let {body_name} = block(width: {width}pt)[#{{ set text(size: {font_size}pt); set par(leading: {leading}em); cmarker.render({markdown_name}, math: mitex) }}]\n"
        "#context {\n"
        f"  place(top + left, dx: {x0}pt, dy: {y0}pt, {body_name})\n"
        "}"
    )


def build_typst_source_from_page_specs(
    *,
    background_pdf_path: Path,
    page_specs: list[RenderPageSpec],
    work_dir: Path,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
) -> str:
    source_rel = os.path.relpath(background_pdf_path, work_dir)
    lines = [
        f'#set text(font: "{font_family}", size: {fonts.DEFAULT_FONT_SIZE}pt)',
        f'#import "@preview/cmarker:{CMARKER_VERSION}"',
        f'#import "@preview/mitex:{MITEX_VERSION}": mitex',
        '#show math.equation.where(block: false): set math.frac(style: "horizontal")',
    ]
    lines.extend(_fit_markdown_typst_helpers())

    for page_offset, spec in enumerate(page_specs):
        lines.append(f"#set page(width: {spec.page_width_pt}pt, height: {spec.page_height_pt}pt, margin: 0pt, fill: none)")
        lines.append(
            f'#place(top + left, dx: 0pt, dy: 0pt, image("{source_rel}", page: {spec.page_index + 1}, width: {spec.page_width_pt}pt))'
        )
        for block_index, block in enumerate(spec.blocks):
            block_id = f"rp{page_offset}_{block.block_id}_{block_index}"
            lines.append(_build_layout_block(block_id, block))
        if page_offset + 1 < len(page_specs):
            lines.append("#pagebreak()")
    return "\n".join(lines) + "\n"
