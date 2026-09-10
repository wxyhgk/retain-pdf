from __future__ import annotations

from retainpdf_pipeline.render.output.typst.block_config import SingleLineFitConfig


def typst_block_fill_arg(*, fill: str = "") -> str:
    return fill


def typst_single_line_fit_call(
    markdown_name: str,
    config: SingleLineFitConfig,
    *,
    font_weight: str,
    justify_text: str,
) -> str:
    return (
        f'pdftr_fit_single_line_markdown({markdown_name}, max_size: {config.max_font_pt}pt, '
        f'min_size: {config.min_font_pt}pt, fit_width: {config.width_pt}pt, '
        f'fit_height: {config.height_pt}pt, weight: "{font_weight}", justify: {justify_text})'
    )


def typst_markdown_fit_call(
    markdown_name: str,
    *,
    max_font_size_pt: float,
    min_font_size_pt: float,
    max_leading_em: float,
    min_leading_em: float,
    fit_height_pt: float,
    font_weight: str,
    first_line_indent_pt: float,
    justify_text: str,
) -> str:
    return (
        f'pdftr_fit_markdown({markdown_name}, max_size: {max_font_size_pt}pt, '
        f'min_size: {min_font_size_pt}pt, max_leading: {max_leading_em}em, '
        f'min_leading: {min_leading_em}em, fit_height: {fit_height_pt}pt, '
        f'weight: "{font_weight}", first_line_indent: {first_line_indent_pt}pt, justify: {justify_text})'
    )


def typst_markdown_block(
    body_name: str,
    *,
    width_pt: float,
    height_pt: float,
    block_fill: str,
    body_expr: str,
    content_top_inset_pt: float = 0.0,
    content_bottom_inset_pt: float = 0.0,
) -> str:
    if content_top_inset_pt > 0 or content_bottom_inset_pt > 0:
        body_expr = (
            f"pad(top: {max(0.0, content_top_inset_pt)}pt, "
            f"bottom: {max(0.0, content_bottom_inset_pt)}pt)"
            f"[#{{ {body_expr} }}]"
        )
    return f"#let {body_name} = block(width: {width_pt}pt, height: {height_pt}pt{block_fill})[#{{ {body_expr} }}]\n"


def typst_plain_markdown_expr(
    markdown_name: str,
    *,
    font_size_pt: float,
    leading_em: float,
    font_weight: str | None = None,
    text_fill: str | None = None,
    first_line_indent_pt: float,
    justify_text: str,
) -> str:
    text_args = [f"size: {font_size_pt}pt"]
    if font_weight is not None:
        text_args.append(f'weight: "{font_weight}"')
    if text_fill is not None:
        text_args.append(f"fill: {text_fill}")
    return (
        f"set text({', '.join(text_args)}); "
        f"set par(leading: {leading_em}em, justify: {justify_text}); "
        f"if {first_line_indent_pt}pt > 0pt {{ h({first_line_indent_pt}pt) }}; "
        f"cmarker.render({markdown_name}, math: mitex)"
    )


def typst_plain_text_expr(
    text_name: str,
    *,
    font_size_pt: float,
    leading_em: float,
    font_weight: str | None = None,
    text_fill: str | None = None,
    first_line_indent_pt: float,
    justify_text: str,
) -> str:
    text_args = [f"size: {font_size_pt}pt"]
    if font_weight is not None:
        text_args.append(f'weight: "{font_weight}"')
    if text_fill is not None:
        text_args.append(f"fill: {text_fill}")
    return (
        f"set text({', '.join(text_args)}); "
        f"set par(leading: {leading_em}em, justify: {justify_text}); "
        f"if {first_line_indent_pt}pt > 0pt {{ h({first_line_indent_pt}pt) }}; "
        f"{text_name}"
    )


def typst_preserved_lines_expr(
    lines_name: str,
    *,
    font_size_pt: float,
    leading_em: float,
    font_weight: str | None = None,
    text_fill: str | None = None,
    justify_text: str,
) -> str:
    text_args = [f"size: {font_size_pt}pt"]
    if font_weight is not None:
        text_args.append(f'weight: "{font_weight}"')
    if text_fill is not None:
        text_args.append(f"fill: {text_fill}")
    gap_em = max(0.0, float(leading_em or 0.0))
    return (
        f"set text({', '.join(text_args)}); "
        f"set par(leading: {leading_em}em, justify: {justify_text}); "
        f"stack(dir: ttb, spacing: {gap_em}em, ..{lines_name}.map(line => block(line)))"
    )


def typst_place_context(*, x_pt: float, y_pt: float, body_name: str) -> str:
    return "#context {\n" f"  place(top + left, dx: {x_pt}pt, dy: {y_pt}pt, {body_name})\n" "}\n"
