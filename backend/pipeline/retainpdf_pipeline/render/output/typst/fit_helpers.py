from __future__ import annotations

# probe=True 时生成的是 fit 报告专用的「探针」版本：缩字算法逐行不变，只在选定字号之后
# 追加一次 metadata 输出（见 fit_probe_emit_helper）。probe=False 的输出必须与改动前逐字节
# 一致——正式渲染只用这一版，PDF 版面不能因为 fit 报告而变化。

FIT_PROBE_LABEL = "pdftr-fit"
# 探针里量「整段不换行」的自然尺寸；只拼进 probe 版本
NATURAL_MD = (
    "      let natural = measure(box[#{{ set text(size: {size}, weight: weight); "
    "if first_line_indent > 0pt {{ h(first_line_indent) }}; cmarker.render(markdown, math: mitex) }}])"
)


def fit_probe_emit_helper() -> list[str]:
    """探针 metadata 输出函数，只出现在探针源码里。

    natural：最终字号下整段不换行排成一行的尺寸（宽 = 总行长，高 = 单行高），用来估算
    还差多少字符；needed-height：最终字号下按实际宽度换行后的总高度；region：文字真正
    可用的框（超出它就是溢出）；allowed-height：缩字时的目标高度（可能比 region 小）。
    """
    return [
        "#let pdftr_fit_emit(fit_id, kind, base, min, final, leading, tier, natural, needed-height, allowed-height, region) = {",
        "  if fit_id != none {",
        "    [#metadata((",
        "      id: fit_id, kind: kind, base: base.pt(), min: min.pt(), final: final.pt(),",
        "      leading: if type(leading) == length { leading.em } else { leading }, tier: tier,",
        "      natural_w: natural.width.pt(), line_h: natural.height.pt(),",
        "      needed_h: needed-height.pt(), allowed_h: allowed-height.pt(),",
        "      region_w: region.width.pt(), region_h: region.height.pt(),",
        f"    )) <{FIT_PROBE_LABEL}>]",
        "  }",
        "}",
    ]


def _fit_size_helper() -> list[str]:
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
    ]


def _fit_id_param(probe: bool) -> str:
    return ", fit_id: none" if probe else ""


def _single_line_fit_helper(*, probe: bool) -> list[str]:
    lines = [
        '#let pdftr_fit_single_line_markdown(markdown, max_size: 10pt, min_size: 9pt, fit_width: none, fit_height: none, weight: "regular", justify: false, eps: 0.08pt'
        + _fit_id_param(probe)
        + ") = {",
        "  layout(size => {",
        "    let allowed-width = if fit_width == none { size.width } else { calc.min(size.width, fit_width) }",
        "    let allowed-height = if fit_height == none { size.height } else { calc.min(size.height, fit_height) }",
        "    let render(text_size) = box(inset: 0pt, clip: false)[#{",
        "      set text(size: text_size, weight: weight)",
        "      set par(leading: 1em, justify: justify)",
        "      cmarker.render(markdown, math: mitex)",
        "    }]",
        "    let fits(text_size) = {",
        "      let measured = measure(render(text_size))",
        "      measured.width <= allowed-width and measured.height <= allowed-height",
        "    }",
        "    let chosen-size = if fits(max_size) {",
        "      max_size",
        "    } else {",
        "      if not fits(min_size) {",
        "        let emergency-min-size = calc.max(4.2pt, min_size * 0.55)",
        "        pdftr_fit_size(emergency-min-size, min_size, eps, size_pt => fits(size_pt))",
        "      } else {",
        "        pdftr_fit_size(min_size, max_size, eps, size_pt => fits(size_pt))",
        "      }",
        "    }",
        "    box(width: allowed-width, height: allowed-height, inset: 0pt, clip: false)[#{",
        "      set text(size: chosen-size, weight: weight)",
        "      set par(leading: 1em, justify: justify)",
        "      cmarker.render(markdown, math: mitex)",
        "    }]",
    ]
    if probe:
        lines.extend(
            [
                '    let tier = if fits(max_size) { "base" } else if not fits(min_size) { "emergency" } else { "shrink" }',
                "    let wrapped = measure(block(width: allowed-width)[#{",
                "      set text(size: chosen-size, weight: weight)",
                "      set par(leading: 1em, justify: justify)",
                "      cmarker.render(markdown, math: mitex)",
                "    }])",
                "    let natural = measure(render(chosen-size))",
                '    pdftr_fit_emit(fit_id, "single_line", max_size, min_size, chosen-size, 1em, tier,',
                "      natural, wrapped.height, allowed-height, (width: allowed-width, height: allowed-height))",
            ]
        )
    lines.extend(
        [
            "  })",
            "}",
        ]
    )
    return lines


def _page_spec_markdown_fit_helper(*, probe: bool) -> list[str]:
    lines = [
        "#let pdftr_fit_markdown(markdown, max_size: 10pt, min_size: 9pt, max_leading: 0.66em, min_leading: 0.54em, fit_height: none, weight: \"regular\", first_line_indent: 0pt, justify: false, eps: 0.08pt"
        + _fit_id_param(probe)
        + ") = {",
        "  layout(size => {",
        "    let allowed-height = if fit_height == none { size.height } else { calc.min(size.height, fit_height) }",
        "    let render(text_size, leading) = block(width: size.width)[#{",
        "      set text(size: text_size, weight: weight)",
        "      set par(leading: leading, justify: justify)",
        "      if first_line_indent > 0pt { h(first_line_indent) }",
        "      cmarker.render(markdown, math: mitex)",
        "    }]",
        "    let fits(text_size, leading) = measure(width: size.width, render(text_size, leading)).height <= allowed-height",
        "    if fits(max_size, max_leading) {",
        "      render(max_size, max_leading)",
    ]
    if probe:
        lines.extend(
            [
                NATURAL_MD.format(size="max_size"),
                '      pdftr_fit_emit(fit_id, "markdown", max_size, min_size, max_size, max_leading, "base", natural,',
                "        measure(width: size.width, render(max_size, max_leading)).height, allowed-height, size)",
            ]
        )
    lines.extend(
        [
            "    } else {",
            "      let chosen-size = pdftr_fit_size(min_size, max_size, eps, size_pt => fits(size_pt, min_leading))",
            "      render(chosen-size, min_leading)",
        ]
    )
    if probe:
        lines.extend(
            [
                NATURAL_MD.format(size="chosen-size"),
                '      pdftr_fit_emit(fit_id, "markdown", max_size, min_size, chosen-size, min_leading, "shrink", natural,',
                "        measure(width: size.width, render(chosen-size, min_leading)).height, allowed-height, size)",
            ]
        )
    lines.extend(
        [
            "    }",
            "  })",
            "}",
        ]
    )
    return lines


def _render_block_markdown_fit_helper(*, probe: bool) -> list[str]:
    lines = [
        '#let pdftr_fit_markdown(markdown, max_size: 10pt, min_size: 9pt, max_leading: 0.66em, min_leading: 0.54em, fit_height: none, weight: "regular", first_line_indent: 0pt, justify: false, eps: 0.08pt'
        + _fit_id_param(probe)
        + ") = {",
        "  layout(size => {",
        "    let allowed-height = if fit_height == none { size.height } else { calc.min(size.height, fit_height) }",
        "    let render(text_size, leading) = block(width: size.width)[#{",
        "      set text(size: text_size, weight: weight)",
        "      set par(leading: leading, justify: justify)",
        "      if first_line_indent > 0pt { h(first_line_indent) }",
        "      cmarker.render(markdown, math: mitex)",
        "    }]",
        "    let fits(text_size, leading) = measure(width: size.width, render(text_size, leading)).height <= allowed-height",
        "    if fits(max_size, max_leading) {",
        "      render(max_size, max_leading)",
    ]
    if probe:
        lines.extend(
            [
                NATURAL_MD.format(size="max_size"),
                '      pdftr_fit_emit(fit_id, "markdown", max_size, min_size, max_size, max_leading, "base", natural,',
                "        measure(width: size.width, render(max_size, max_leading)).height, allowed-height, size)",
            ]
        )
    lines.extend(
        [
            "    } else {",
            "      let fallback_min_size = min_size",
            "      let fallback_min_leading = min_leading",
            "      let emergency_min_size = calc.max(4.2pt, min_size * 0.65)",
            "      let emergency_min_leading = calc.max(0.20em, min_leading * 0.75)",
            "      let chosen_leading = if fits(min_size, max_leading) { max_leading } else { min_leading }",
            "      let chosen_size = if not fits(min_size, chosen_leading) {",
            "        let fallback_leading = fallback_min_leading",
            "        let emergency_leading = emergency_min_leading",
            "        if not fits(fallback_min_size, fallback_leading) {",
            "          pdftr_fit_size(emergency_min_size, fallback_min_size, eps, size_pt => fits(size_pt, emergency_leading))",
            "        } else {",
            "          pdftr_fit_size(fallback_min_size, min_size, eps, size_pt => fits(size_pt, fallback_leading))",
            "        }",
            "      } else {",
            "        pdftr_fit_size(min_size, max_size, eps, size_pt => fits(size_pt, chosen_leading))",
            "      }",
            "      let leading_floor = if fits(chosen_size, min_leading) { min_leading } else if fits(chosen_size, emergency_min_leading) { emergency_min_leading } else { emergency_min_leading }",
            "      let leading_cap = if fits(chosen_size, max_leading) { max_leading } else { chosen_leading }",
            "      let final_leading = if fits(chosen_size, leading_cap) {",
            "        leading_cap",
            "      } else {",
            "        pdftr_fit_leading(leading_floor, leading_cap, 0.01em, leading => fits(chosen_size, leading))",
            "      }",
            "      render(chosen_size, final_leading)",
        ]
    )
    if probe:
        lines.extend(
            [
                "      let tier = if fits(min_size, chosen_leading) { \"shrink\" } else if fits(fallback_min_size, fallback_min_leading) { \"shrink\" } else { \"emergency\" }",
                NATURAL_MD.format(size="chosen_size"),
                '      pdftr_fit_emit(fit_id, "markdown", max_size, min_size, chosen_size, final_leading, tier, natural,',
                "        measure(width: size.width, render(chosen_size, final_leading)).height, allowed-height, size)",
            ]
        )
    lines.extend(
        [
            "    }",
            "  })",
            "}",
        ]
    )
    return lines


def page_spec_fit_helpers(*, probe: bool = False) -> list[str]:
    lines: list[str] = []
    if probe:
        lines.extend(fit_probe_emit_helper())
    lines.extend(_fit_size_helper())
    lines.extend(_single_line_fit_helper(probe=probe))
    lines.extend(_page_spec_markdown_fit_helper(probe=probe))
    return lines


def render_block_fit_helpers(*, probe: bool = False) -> list[str]:
    lines: list[str] = []
    if probe:
        lines.extend(fit_probe_emit_helper())
    lines.extend(_fit_size_helper())
    lines.extend(
        [
            "#let pdftr_fit_leading(lo, hi, eps, fits) = {",
            "  if hi - lo <= eps {",
            "    lo",
            "  } else {",
            "    let mid = lo + (hi - lo) / 2",
            "    if fits(mid) {",
            "      pdftr_fit_leading(mid, hi, eps, fits)",
            "    } else {",
            "      pdftr_fit_leading(lo, mid, eps, fits)",
            "    }",
            "  }",
            "}",
            "#let pdftr_floor_size(value, floor) = if value < floor { floor } else { value }",
            "#let pdftr_floor_leading(value, floor) = if value < floor { floor } else { value }",
        ]
    )
    lines.extend(_single_line_fit_helper(probe=probe))
    lines.extend(_render_block_markdown_fit_helper(probe=probe))
    return lines


__all__ = [
    "FIT_PROBE_LABEL",
    "fit_probe_emit_helper",
    "page_spec_fit_helpers",
    "render_block_fit_helpers",
]
