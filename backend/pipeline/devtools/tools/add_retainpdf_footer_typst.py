#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import subprocess
from pathlib import Path

import fitz


DEFAULT_FOOTER_TEXT = "Translated By RetainPDF"
DEFAULT_FOOTER_URL = "GitHub: https://github.com/wxyhgk/retain-pdf"
DEFAULT_FOOTER_HEIGHT_PT = 34.0


def _escape_typst_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _page_sizes(pdf_path: Path) -> list[tuple[float, float]]:
    with fitz.open(pdf_path) as doc:
        return [(float(page.rect.width), float(page.rect.height)) for page in doc]


def _typst_source(
    *,
    input_pdf_path: str,
    page_sizes: list[tuple[float, float]],
    footer_text: str,
    footer_url: str,
    footer_height_pt: float,
) -> str:
    input_pdf_literal = _escape_typst_string(input_pdf_path)
    footer_text_literal = _escape_typst_string(footer_text)
    footer_url_literal = _escape_typst_string(footer_url)
    lines = [
        "#set document(title: \"RetainPDF branded export\")",
        "#set text(font: \"Noto Sans CJK SC\", size: 8pt)",
        "#let footer-height = " + f"{footer_height_pt:.3f}" + "pt",
        "#let brand-footer() = block(width: 100%, height: footer-height, inset: (x: 14pt, y: 0pt))[",
        "  #line(length: 100%, stroke: rgb(\"#d6d8dc\") + 0.45pt)",
        "  #v(6pt)",
        "  #grid(",
        "    columns: (1fr, auto),",
        "    gutter: 12pt,",
        "    align: horizon,",
        "    text(fill: rgb(\"#5f6368\"), weight: 500)[" + footer_text_literal + "],",
        "    text(fill: rgb(\"#8a8f98\"))[" + footer_url_literal + "],",
        "  )",
        "]",
        "",
    ]
    for idx, (width, height) in enumerate(page_sizes):
        lines.extend(
            [
                f"#set page(width: {width:.3f}pt, height: {height + footer_height_pt:.3f}pt, margin: 0pt)",
                "#block(width: 100%, height: 100%)[",
                f'  #image("{input_pdf_literal}", page: {idx + 1}, width: {width:.3f}pt, height: {height:.3f}pt)',
                "  #brand-footer()",
                "]",
                "#pagebreak()",
                "",
            ]
        )
    if page_sizes:
        lines[-2] = ""
    return "\n".join(lines)


def add_footer(
    *,
    input_pdf: Path,
    output_pdf: Path,
    footer_text: str,
    footer_url: str,
    footer_height_pt: float,
) -> None:
    page_sizes = _page_sizes(input_pdf)
    if not page_sizes:
        raise RuntimeError(f"PDF has no pages: {input_pdf}")
    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    typst_root = Path.cwd().resolve()
    typ_path = output_pdf.with_suffix(".retainpdf-footer.typ")
    typst_input_pdf = os.path.relpath(input_pdf, typ_path.parent).replace(os.sep, "/")
    typ_path.write_text(
        _typst_source(
            input_pdf_path=typst_input_pdf,
            page_sizes=page_sizes,
            footer_text=footer_text,
            footer_url=footer_url,
            footer_height_pt=footer_height_pt,
        ),
        encoding="utf-8",
    )
    try:
        subprocess.run(
            [
                "typst",
                "compile",
                "--root",
                str(typst_root),
                str(typ_path),
                str(output_pdf),
            ],
            check=True,
        )
    finally:
        typ_path.unlink(missing_ok=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a visual PDF copy with a RetainPDF footer strip using Typst."
    )
    parser.add_argument("input_pdf", type=Path)
    parser.add_argument("--output", type=Path, default=None)
    parser.add_argument("--text", default=DEFAULT_FOOTER_TEXT)
    parser.add_argument("--url", default=DEFAULT_FOOTER_URL)
    parser.add_argument("--height-pt", type=float, default=DEFAULT_FOOTER_HEIGHT_PT)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_pdf = args.input_pdf.resolve()
    output_pdf = args.output
    if output_pdf is None:
        output_pdf = input_pdf.with_name(f"{input_pdf.stem}.retainpdf-footer{input_pdf.suffix}")
    add_footer(
        input_pdf=input_pdf,
        output_pdf=output_pdf.resolve(),
        footer_text=args.text,
        footer_url=args.url,
        footer_height_pt=args.height_pt,
    )
    print(output_pdf.resolve())


if __name__ == "__main__":
    main()
