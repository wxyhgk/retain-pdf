from __future__ import annotations

import re

from retainpdf_pipeline.render.layout.model.models import RenderBlock
from retainpdf_pipeline.render.layout.inline_content.core.markdown import build_direct_typst_passthrough_text
from retainpdf_pipeline.render.layout.payload.formula_safety import formula_safety_insets_pt
from retainpdf_pipeline.render.layout.payload.formula_safety import has_long_inline_math_layout_risk
from retainpdf_pipeline.render.output.typst.block_fit import fit_dimensions
from retainpdf_pipeline.render.output.typst import block_config as typst_config
from retainpdf_pipeline.render.output.typst.block_fields import typst_block_fields
from retainpdf_pipeline.render.output.typst.block_fields import typst_rgb
from retainpdf_pipeline.render.output.typst.block_markup import typst_markdown_block
from retainpdf_pipeline.render.output.typst.block_markup import typst_markdown_fit_call
from retainpdf_pipeline.render.output.typst.block_markup import typst_place_context
from retainpdf_pipeline.render.output.typst.block_markup import typst_plain_markdown_expr
from retainpdf_pipeline.render.output.typst.block_markup import typst_plain_text_expr
from retainpdf_pipeline.render.output.typst.block_markup import typst_preserved_lines_expr
from retainpdf_pipeline.render.output.typst.block_markup import typst_single_line_fit_call
from retainpdf_pipeline.render.output.typst.shared import escape_typst_string

PLAIN_LINE_FIT_MAX_CHARS = 40
TOC_ENTRY_FONT_PT = 9.6
TOC_ENTRY_MIN_FONT_PT = 6.8
TOC_PAGE_COLUMN_MIN_PT = 20.0
TOC_PAGE_COLUMN_MAX_PT = 36.0
TOC_TITLE_PAGE_GAP_PT = 4.0
TOC_LEADER_DOT_WIDTH_RATIO = 0.26


def _toc_text_units(text: str) -> float:
    units = 0.0
    for char in str(text or ""):
        if char.isspace():
            units += 0.35
        elif "\u4e00" <= char <= "\u9fff":
            units += 1.08
        elif char.isascii() and char.isalnum():
            units += 0.62
        elif char == ".":
            units += 0.34
        else:
            units += 0.56
    return units


def _toc_leader_text(prefix_title: str, page_label: str, *, width_pt: float, font_size_pt: float) -> str:
    if not str(page_label or "").strip():
        return ""
    available_units = max(8.0, (width_pt / max(font_size_pt, 1.0)) * 0.84)
    used_units = _toc_text_units(prefix_title) + _toc_text_units(page_label)
    spare_units = available_units - used_units
    if spare_units <= 1.4:
        return "..."
    dot_count = int(spare_units / 0.34)
    return "." * max(3, min(48, dot_count))


def _toc_estimated_text_width_pt(text: str, font_size_pt: float) -> float:
    return _toc_text_units(text) * max(font_size_pt, 1.0) * 0.54


def sanitize_typst_markdown_for_compile(markdown: str) -> str:
    text = str(markdown or "")
    text = re.sub(r"\$\s*\^\s*\{\s*\\(?:circled|textcircled)\s*R\s*\}\s*\$", "®", text)
    text = re.sub(r"\$\s*\^\s*\{\s*\\(?:circled|textcircled)\s*\{\s*R\s*\}\s*\}\s*\$", "®", text)
    text = re.sub(r"\$\s*\^\s*\{\s*\\(?:textregistered|registered)\s*\}\s*\$", "®", text)
    text = re.sub(r"\$\s*\^\s*\{\s*®\s*\}\s*\$", "®", text)
    text = text.replace("$^®$", "®").replace("$^{®}$", "®")
    text = text.replace(r"$^\circled{R}$", "®").replace(r"$^\textcircled{R}$", "®")
    text = re.sub(r"\\langlen\b", r"\\langle n", text)
    text = text.replace(r"\circled{\times}", r"\otimes")
    text = text.replace(r"\circled{\parallel}", r"\circ")
    text = text.replace(r"\textcircled{\times}", r"\otimes")
    text = text.replace(r"\textcircled{\parallel}", r"\circ")
    return text


def _typst_string_array(values: list[str]) -> str:
    return "(" + ", ".join(f'"{escape_typst_string(value)}"' for value in values) + ("," if len(values) == 1 else "") + ")"


def _build_preserved_line_box_typst(block_id: str, block: RenderBlock, *, text_fill: str, block_fill: str) -> str:
    parts: list[str] = []
    font_weight = block.font_weight if str(block.font_weight or "").strip() else "regular"
    if block.use_cover_fill:
        cover_name = f"{block_id.replace('-', '_')}_cover"
        cover_x0, cover_y0, cover_x1, cover_y1 = [float(value) for value in block.cover_bbox]
        cover_width = max(typst_config.MIN_BLOCK_SIZE_PT, cover_x1 - cover_x0)
        cover_height = max(typst_config.MIN_BLOCK_SIZE_PT, cover_y1 - cover_y0)
        parts.extend(
            [
                f"#let {cover_name} = rect(width: {cover_width}pt, height: {cover_height}pt, fill: {typst_rgb(block.cover_fill)})",
                typst_place_context(x_pt=cover_x0, y_pt=cover_y0, body_name=cover_name).rstrip(),
            ]
        )
    for index, line in enumerate(block.preserved_line_boxes or []):
        if len(line.bbox) != 4 or not str(line.text or "").strip():
            continue
        line_markdown = build_direct_typst_passthrough_text(str(line.text or ""))
        x0, y0, x1, y1 = [float(value) for value in line.bbox]
        width = max(typst_config.MIN_BLOCK_SIZE_PT, x1 - x0)
        height = max(typst_config.MIN_BLOCK_SIZE_PT, y1 - y0)
        max_font_pt = round(max(1.0, min(block.font_size_pt, height * 0.86)), 2)
        text_units = max(1, len(line_markdown.strip()))
        dense_single_line = text_units / max(width, 1.0) > 0.38
        min_scale = 0.36 if dense_single_line else 0.58
        min_floor = 4.8 if dense_single_line else 1.0
        min_font_pt = round(max(min_floor, min(max_font_pt, height * min_scale)), 2)
        line_name = f"{block_id.replace('-', '_')}_line_{index}_md"
        body_name = f"{block_id.replace('-', '_')}_line_{index}_body"
        parts.extend(
            [
                f'#let {line_name} = "{escape_typst_string(line_markdown)}"',
                f"#let {body_name} = block(width: {width}pt, height: {height}pt{block_fill})[#{{ "
                f"set text(fill: {text_fill}); "
                f'pdftr_fit_single_line_markdown({line_name}, max_size: {max_font_pt}pt, '
                f'min_size: {min_font_pt}pt, fit_width: {width}pt, fit_height: {height}pt, '
                f'weight: "{font_weight}", justify: false) }}]',
                typst_place_context(x_pt=x0, y_pt=y0, body_name=body_name).rstrip(),
            ]
        )
    return "\n".join(parts) + ("\n" if parts else "")


def _build_toc_entry_typst(block_id: str, block: RenderBlock, *, text_fill: str) -> str:
    parts: list[str] = []
    font_weight = block.font_weight if str(block.font_weight or "").strip() else "regular"
    for index, entry in enumerate(block.toc_entries or []):
        if len(entry.bbox) != 4 or not str(entry.title or "").strip():
            continue
        x0, y0, x1, y1 = [float(value) for value in entry.bbox]
        width = max(typst_config.MIN_BLOCK_SIZE_PT, x1 - x0)
        height = max(typst_config.MIN_BLOCK_SIZE_PT, y1 - y0)
        indent = round(max(0, int(entry.level or 1) - 1) * min(18.0, width * 0.06), 2)
        max_font_pt = round(max(1.0, min(TOC_ENTRY_FONT_PT, height * 0.82)), 2)
        min_font_pt = round(max(1.0, min(max_font_pt, TOC_ENTRY_MIN_FONT_PT, height * 0.58)), 2)
        prefix = f"{entry.number} " if str(entry.number or "").strip() else ""
        line_width = round(max(8.0, width - indent), 2)
        prefix_title = build_direct_typst_passthrough_text(f"{prefix}{entry.title}")
        page_label = str(entry.page_label or "").strip()
        title_name = f"{block_id.replace('-', '_')}_toc_{index}_title"
        page_name = f"{block_id.replace('-', '_')}_toc_{index}_page"
        body_name = f"{block_id.replace('-', '_')}_toc_{index}_body"
        title_y = round(max(0.0, height * 0.08), 2)
        leader_y = round(height * 0.55, 2)
        parts.extend(
            [
                f'#let {title_name} = "{escape_typst_string(prefix_title)}"',
                f'#let {page_name} = "{escape_typst_string(page_label)}"',
                f"#let {body_name} = block(width: {line_width}pt, height: {height}pt)[#{{ "
                f"set text(size: {max_font_pt}pt, weight: \"{font_weight}\", fill: {text_fill}); "
                "set par(leading: 0.15em, justify: false); "
                "layout(size => { "
                f"let page-body = box[#{{ {page_name} }}]; "
                "let page-size = measure(page-body); "
                f"let title-body = box[#{{ cmarker.render({title_name}, math: mitex) }}]; "
                "let title-size = measure(title-body); "
                "let title-max = calc.max(8pt, size.width - page-size.width - 8pt); "
                "let title-width = calc.min(title-size.width, title-max); "
                "let leader-start = title-width + 2pt; "
                "let leader-end = size.width - page-size.width - 4pt; "
                "let leader-len = calc.max(0pt, leader-end - leader-start); "
                f"place(top + left, dx: 0pt, dy: {title_y}pt, box(width: title-width, clip: false)[#{{ title-body }}]); "
                f"if leader-len > 2pt {{ place(top + left, dx: leader-start, dy: {leader_y}pt, "
                "line(length: leader-len, stroke: (paint: rgb(120, 120, 120), thickness: 0.45pt, dash: (1pt, 2pt)))) }; "
                f"place(top + left, dx: size.width - page-size.width, dy: {title_y}pt, page-body) "
                "}) }]",
                typst_place_context(x_pt=x0 + indent, y_pt=y0, body_name=body_name).rstrip(),
            ]
        )
    return "\n".join(parts) + ("\n" if parts else "")


def build_typst_block(block_id: str, block: RenderBlock, *, include_fill: bool = False) -> str:
    fields = typst_block_fields(
        block_id,
        block.inner_bbox,
        font_size_pt=block.font_size_pt,
        leading_em=block.leading_em,
        font_weight=block.font_weight,
    )
    text_fill = typst_rgb(block.text_color)
    block_fill = typst_config.cover_fill_arg(
        include_fill=include_fill,
        use_cover_fill=block.use_cover_fill,
        cover_fill=typst_rgb(block.cover_fill),
    )

    if block.render_kind in {"plain", "plain_line"}:
        plain_text = block.plain_text
        if len(plain_text) > PLAIN_LINE_FIT_MAX_CHARS:
            text_name = f"{fields.var_prefix}_txt"
            body_name = f"{fields.var_prefix}_body"
            body_expr = typst_plain_text_expr(
                text_name,
                font_size_pt=fields.font_size,
                leading_em=fields.leading,
                font_weight=fields.font_weight,
                text_fill=text_fill,
                first_line_indent_pt=typst_config.first_line_indent_pt(block.first_line_indent_pt),
                justify_text=typst_config.typst_bool(block.justify_text),
            )
            parts = [
                f'#let {text_name} = "{escape_typst_string(plain_text)}"',
                typst_markdown_block(
                    body_name,
                    width_pt=fields.width,
                    height_pt=fields.height,
                    block_fill=block_fill,
                    body_expr=body_expr,
                ),
                typst_place_context(x_pt=fields.x0, y_pt=fields.y0, body_name=body_name),
            ]
            return "\n".join(parts) + "\n"
        text_name = f"{fields.var_prefix}_txt"
        base_name = f"{fields.var_prefix}_base"
        scaled_name = f"{fields.var_prefix}_scaled"
        parts = [
            f'#let {text_name} = "{escape_typst_string(plain_text)}"',
            f'#let {base_name} = box[#{{ set text(size: {fields.font_size}pt, weight: "{fields.font_weight}", fill: {text_fill}); {text_name} }}]',
            "#context {",
            f"  let base-size = measure({base_name})",
            f"  let scaled-font = if base-size.width > {fields.width}pt {{ {fields.font_size}pt * ({fields.width}pt / base-size.width) }} else {{ {fields.font_size}pt }}",
            f'  let {scaled_name} = block(width: {fields.width}pt, height: {fields.height}pt{block_fill})[#{{ set text(size: scaled-font, weight: "{fields.font_weight}", fill: {text_fill}); {text_name} }}]',
            f"  place(top + left, dx: {fields.x0}pt, dy: {fields.y0}pt, {scaled_name})",
            "}",
        ]
        return "\n".join(parts) + "\n"

    markdown_name = f"{fields.var_prefix}_md"
    body_name = f"{fields.var_prefix}_body"
    markdown = sanitize_typst_markdown_for_compile(block.markdown_text)
    formula_insets = formula_safety_insets_pt(
        markdown,
        block.math_map,
        font_size_pt=fields.font_size,
        box_height_pt=fields.height,
    )
    long_inline_math_risk = has_long_inline_math_layout_risk(
        markdown,
        block.math_map,
        font_size_pt=fields.font_size,
        box_width_pt=fields.width,
    )
    content_fit_height = max(typst_config.MIN_BLOCK_SIZE_PT, fields.height - formula_insets.total_pt)
    first_line_indent = typst_config.first_line_indent_pt(block.first_line_indent_pt)
    justify_text = typst_config.typst_bool(block.justify_text and not long_inline_math_risk)
    if block.toc_entries:
        return _build_toc_entry_typst(block_id, block, text_fill=text_fill)
    if block.preserve_line_breaks and block.preserved_line_boxes:
        return _build_preserved_line_box_typst(block_id, block, text_fill=text_fill, block_fill=block_fill)
    if block.preserve_line_breaks and "\n" in markdown:
        lines_name = f"{fields.var_prefix}_lines"
        line_values = [line.strip() for line in markdown.splitlines() if line.strip()]
        body_expr = typst_preserved_lines_expr(
            lines_name,
            font_size_pt=fields.font_size,
            leading_em=fields.leading,
            font_weight=fields.font_weight,
            text_fill=text_fill,
            justify_text="false",
        )
        parts = [
            f"#let {lines_name} = {_typst_string_array(line_values)}",
            typst_markdown_block(
                body_name,
                width_pt=fields.width,
                height_pt=fields.height,
                block_fill=block_fill,
                body_expr=body_expr,
                content_top_inset_pt=formula_insets.top_pt,
                content_bottom_inset_pt=formula_insets.bottom_pt,
            ),
            typst_place_context(x_pt=fields.x0, y_pt=fields.y0, body_name=body_name),
        ]
        return "\n".join(parts) + "\n"
    if block.fit_to_box:
        if block.fit_single_line:
            single_line_fit = typst_config.single_line_fit_config(
                width_pt=fields.width,
                height_pt=content_fit_height,
                font_size_pt=fields.font_size,
                fit_min_font_size_pt=block.fit_min_font_size_pt,
                fit_max_font_size_pt=block.fit_max_font_size_pt,
                fit_max_height_pt=min(content_fit_height, block.fit_max_height_pt or content_fit_height),
                fit_target_width_pt=block.fit_target_width_pt,
                fit_target_height_pt=min(content_fit_height, block.fit_target_height_pt or content_fit_height),
                fit_shift_up_pt=block.fit_shift_up_pt,
            )
            fit_call = typst_single_line_fit_call(
                markdown_name,
                single_line_fit,
                font_weight=fields.font_weight,
                justify_text=justify_text,
            )
            parts = [
                f'#let {markdown_name} = "{escape_typst_string(markdown)}"',
                typst_markdown_block(
                    body_name,
                    width_pt=single_line_fit.width_pt,
                    height_pt=fields.height,
                    block_fill=block_fill,
                    body_expr=f"set text(fill: {text_fill}); {fit_call}",
                    content_top_inset_pt=formula_insets.top_pt,
                    content_bottom_inset_pt=formula_insets.bottom_pt,
                ),
                typst_place_context(x_pt=fields.x0, y_pt=fields.y0 - single_line_fit.shift_up_pt, body_name=body_name),
            ]
            return "\n".join(parts) + "\n"
        fit = fit_dimensions(
            width=fields.width,
            height=content_fit_height,
            font_size=fields.font_size,
            leading=fields.leading,
            fit_min_font_size_pt=(
                min(block.fit_min_font_size_pt or fields.font_size, fields.font_size * 0.72)
                if long_inline_math_risk
                else block.fit_min_font_size_pt
            ),
            fit_min_leading_em=(
                max(block.fit_min_leading_em or fields.leading, min(fields.leading, 0.62))
                if long_inline_math_risk
                else block.fit_min_leading_em
            ),
            fit_max_height_pt=min(content_fit_height, block.fit_max_height_pt or content_fit_height),
        )
        fit_call = typst_markdown_fit_call(
            markdown_name,
            max_font_size_pt=fields.font_size,
            min_font_size_pt=fit["fit_min_font"],
            max_leading_em=fields.leading,
            min_leading_em=fit["fit_min_leading"],
            fit_height_pt=fit["fit_target_height"],
            font_weight=fields.font_weight,
            first_line_indent_pt=first_line_indent,
            justify_text=justify_text,
        )
        parts = [
            f'#let {markdown_name} = "{escape_typst_string(markdown)}"',
            typst_markdown_block(
                body_name,
                width_pt=fit["width"],
                height_pt=fields.height,
                block_fill=block_fill,
                body_expr=f"set text(fill: {text_fill}); {fit_call}",
                content_top_inset_pt=formula_insets.top_pt,
                content_bottom_inset_pt=formula_insets.bottom_pt,
            ),
            typst_place_context(x_pt=fields.x0, y_pt=fields.y0, body_name=body_name),
        ]
        return "\n".join(parts) + "\n"
    body_expr = typst_plain_markdown_expr(
        markdown_name,
        font_size_pt=fields.font_size,
        leading_em=fields.leading,
        font_weight=fields.font_weight,
        text_fill=text_fill,
        first_line_indent_pt=first_line_indent,
        justify_text=justify_text,
    )
    parts = [
        f'#let {markdown_name} = "{escape_typst_string(markdown)}"',
        typst_markdown_block(
            body_name,
            width_pt=fields.width,
            height_pt=fields.height,
            block_fill=block_fill,
            body_expr=body_expr,
            content_top_inset_pt=formula_insets.top_pt,
            content_bottom_inset_pt=formula_insets.bottom_pt,
        ),
        typst_place_context(x_pt=fields.x0, y_pt=fields.y0, body_name=body_name),
    ]
    return "\n".join(parts) + "\n"


def build_typst_cover_rect(block_id: str, block: RenderBlock) -> str:
    rect_name = f"{block_id.replace('-', '_')}_cover"
    x0, y0, x1, y1 = block.cover_bbox
    width = max(typst_config.MIN_BLOCK_SIZE_PT, x1 - x0)
    height = max(typst_config.MIN_BLOCK_SIZE_PT, y1 - y0)
    cover_fill = typst_rgb(block.cover_fill)
    parts = [
        f"#let {rect_name} = rect(width: {width}pt, height: {height}pt, fill: {cover_fill})",
        typst_place_context(x_pt=x0, y_pt=y0, body_name=rect_name),
    ]
    return "\n".join(parts) + "\n"
