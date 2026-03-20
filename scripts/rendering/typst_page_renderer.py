import subprocess
from pathlib import Path

import fitz

from common.config import DEFAULT_FONT_SIZE, OUTPUT_DIR
from rendering.pdf_overlay import save_optimized_pdf
from rendering.render_payloads import RenderBlock
from rendering.render_payloads import build_render_blocks


TYPST_BIN = "/snap/bin/typst"
TYPST_OVERLAY_DIR = OUTPUT_DIR / "typst_overlay"
TYPST_TEXT_FONT = "Droid Sans Fallback"
CMARKER_VERSION = "0.1.8"
MITEX_VERSION = "0.2.6"


def _escape_typst_string(text: str) -> str:
    return text.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")

def _build_typst_block(block_id: str, block: RenderBlock) -> str:
    x0, y0, x1, y1 = block.bbox
    width = max(8.0, x1 - x0)
    height = max(8.0, y1 - y0)
    markdown_name = f"{block_id}_md"
    body_name = f"{block_id}_body"
    markdown = block.markdown_text

    command = (
        f'#let {markdown_name} = "{_escape_typst_string(markdown)}"\n'
        f"#let {body_name} = block(width: {width}pt)[#cmarker.render({markdown_name}, math: mitex)]\n"
        "#context {\n"
        f"  let size = measure({body_name})\n"
        f"  place(top + left, dx: {x0}pt, dy: {y0}pt + ({height}pt - size.height) / 2, {body_name})\n"
        "}"
    )
    return command


def build_typst_overlay_source(page_width: float, page_height: float, translated_items: list[dict]) -> str:
    render_blocks = build_render_blocks(translated_items)
    lines = [
        f"#set page(width: {page_width}pt, height: {page_height}pt, margin: 0pt)",
        f'#set text(font: "{TYPST_TEXT_FONT}", size: {DEFAULT_FONT_SIZE}pt)',
        f'#import "@preview/cmarker:{CMARKER_VERSION}"',
        f'#import "@preview/mitex:{MITEX_VERSION}": mitex',
        '#show math.equation.where(block: false): set math.frac(style: "horizontal")',
    ]
    commands: list[str] = []

    for index, block in enumerate(render_blocks):
        commands.append(_build_typst_block(f"b{index}", block))

    lines.extend(commands)
    return "\n".join(lines) + "\n"


def compile_typst_overlay_pdf(page_width: float, page_height: float, translated_items: list[dict], stem: str) -> Path:
    TYPST_OVERLAY_DIR.mkdir(parents=True, exist_ok=True)
    typ_path = TYPST_OVERLAY_DIR / f"{stem}.typ"
    pdf_path = TYPST_OVERLAY_DIR / f"{stem}.pdf"
    typ_path.write_text(build_typst_overlay_source(page_width, page_height, translated_items), encoding="utf-8")
    proc = subprocess.run([TYPST_BIN, "compile", str(typ_path), str(pdf_path)], capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout).strip())
    return pdf_path


def overlay_translated_items_on_page(page: fitz.Page, translated_items: list[dict], stem: str) -> None:
    for block in build_render_blocks(translated_items):
        page.draw_rect(fitz.Rect(block.bbox), color=(1, 1, 1), fill=(1, 1, 1), overlay=True)

    overlay_pdf = compile_typst_overlay_pdf(page.rect.width, page.rect.height, translated_items, stem=stem)
    overlay_doc = fitz.open(overlay_pdf)
    try:
        page.show_pdf_page(page.rect, overlay_doc, 0, overlay=True)
    finally:
        overlay_doc.close()


def build_single_page_typst_pdf(
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_items: list[dict],
    page_idx: int,
) -> None:
    source_doc = fitz.open(source_pdf_path)
    temp_doc = fitz.open()
    temp_doc.insert_pdf(source_doc, from_page=page_idx, to_page=page_idx)
    page = temp_doc[0]
    overlay_translated_items_on_page(page, translated_items, stem=f"page-{page_idx + 1}")

    save_optimized_pdf(temp_doc, output_pdf_path)
    temp_doc.close()
    source_doc.close()


def build_book_typst_pdf(
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
) -> None:
    doc = fitz.open(source_pdf_path)
    try:
        for page_idx, translated_items in sorted(translated_pages.items()):
            if page_idx < 0 or page_idx >= len(doc):
                continue
            overlay_translated_items_on_page(doc[page_idx], translated_items, stem=f"book-page-{page_idx + 1}")
        save_optimized_pdf(doc, output_pdf_path)
    finally:
        doc.close()
