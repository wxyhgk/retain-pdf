import os
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import fitz

from common.config import DEFAULT_FONT_SIZE, OUTPUT_DIR
from rendering.models import RenderBlock
from rendering.pdf_overlay import save_optimized_pdf
from rendering.pdf_overlay import redact_translated_text_areas
from rendering.pdf_overlay import strip_page_links
from rendering.render_payloads import build_render_blocks
from rendering.render_payloads import prepare_render_payloads_by_page


TYPST_BIN = "/snap/bin/typst"
TYPST_OVERLAY_DIR = OUTPUT_DIR / "typst_overlay"
TYPST_TEXT_FONT = "Noto Serif CJK SC"
CMARKER_VERSION = "0.1.8"
MITEX_VERSION = "0.2.6"


def _escape_typst_string(text: str) -> str:
    return text.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def _force_plain_text_items(translated_items: list[dict]) -> list[dict]:
    forced: list[dict] = []
    for item in translated_items:
        cloned = dict(item)
        cloned["_force_plain_line"] = True
        forced.append(cloned)
    return forced


def _default_compile_workers(page_count: int) -> int:
    cpu_count = os.cpu_count() or 1
    return max(1, min(page_count, cpu_count, 24))


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
        command = (
            f'#let {text_name} = "{_escape_typst_string(plain_text)}"\n'
            f"#let {base_name} = box[#{{ set text(size: {font_size}pt); {text_name} }}]\n"
            "#context {\n"
            f"  let base-size = measure({base_name})\n"
            f"  let scaled-font = if base-size.width > {width}pt {{ {font_size}pt * ({width}pt / base-size.width) }} else {{ {font_size}pt }}\n"
            f"  let {scaled_name} = box[#{{ set text(size: scaled-font); {text_name} }}]\n"
            f"  let size = measure({scaled_name})\n"
            f"  place(top + left, dx: {x0}pt, dy: {y0}pt + ({height}pt - size.height) / 2, {scaled_name})\n"
            "}"
        )
        return command

    markdown_name = f"{var_prefix}_md"
    body_name = f"{var_prefix}_body"
    markdown = block.markdown_text
    command = (
        f'#let {markdown_name} = "{_escape_typst_string(markdown)}"\n'
        f"#let {body_name} = block(width: {width}pt)[#{{ set text(size: {font_size}pt); set par(leading: {leading}em); cmarker.render({markdown_name}, math: mitex) }}]\n"
        "#context {\n"
        f"  let size = measure({body_name})\n"
        f"  place(top + left, dx: {x0}pt, dy: {y0}pt + ({height}pt - size.height) / 2, {body_name})\n"
        "}"
    )
    return command


def build_typst_overlay_source(page_width: float, page_height: float, translated_items: list[dict]) -> str:
    return build_typst_book_overlay_source([(page_width, page_height, translated_items)])


def build_typst_book_overlay_source(
    page_specs: list[tuple[float, float, list[dict]]],
) -> str:
    lines = [
        f'#set text(font: "{TYPST_TEXT_FONT}", size: {DEFAULT_FONT_SIZE}pt)',
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


def compile_typst_overlay_pdf(page_width: float, page_height: float, translated_items: list[dict], stem: str) -> Path:
    TYPST_OVERLAY_DIR.mkdir(parents=True, exist_ok=True)
    typ_path = TYPST_OVERLAY_DIR / f"{stem}.typ"
    pdf_path = TYPST_OVERLAY_DIR / f"{stem}.pdf"
    typ_path.write_text(build_typst_overlay_source(page_width, page_height, translated_items), encoding="utf-8")
    proc = subprocess.run([TYPST_BIN, "compile", str(typ_path), str(pdf_path)], capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout).strip())
    return pdf_path


def compile_typst_book_overlay_pdf(
    page_specs: list[tuple[float, float, list[dict]]],
    stem: str,
) -> Path:
    TYPST_OVERLAY_DIR.mkdir(parents=True, exist_ok=True)
    typ_path = TYPST_OVERLAY_DIR / f"{stem}.typ"
    pdf_path = TYPST_OVERLAY_DIR / f"{stem}.pdf"
    typ_path.write_text(build_typst_book_overlay_source(page_specs), encoding="utf-8")
    proc = subprocess.run([TYPST_BIN, "compile", str(typ_path), str(pdf_path)], capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout).strip())
    return pdf_path


def overlay_translated_items_on_page(page: fitz.Page, translated_items: list[dict], stem: str) -> None:
    redact_translated_text_areas(page, translated_items)
    try:
        overlay_pdf = compile_typst_overlay_pdf(page.rect.width, page.rect.height, translated_items, stem=stem)
    except RuntimeError:
        overlay_pdf = compile_typst_overlay_pdf(
            page.rect.width,
            page.rect.height,
            _force_plain_text_items(translated_items),
            stem=f"{stem}-plain",
        )
    overlay_doc = fitz.open(overlay_pdf)
    try:
        page.show_pdf_page(page.rect, overlay_doc, 0, overlay=True)
    finally:
        overlay_doc.close()


def _compile_overlay_with_fallback(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    stem: str,
) -> Path:
    try:
        return compile_typst_overlay_pdf(page_width, page_height, translated_items, stem=stem)
    except RuntimeError:
        return compile_typst_overlay_pdf(
            page_width,
            page_height,
            _force_plain_text_items(translated_items),
            stem=f"{stem}-plain",
        )


def overlay_translated_pages_on_doc(
    doc: fitz.Document,
    translated_pages: dict[int, list[dict]],
    stem: str,
    compile_workers: int | None = None,
) -> None:
    translated_pages = prepare_render_payloads_by_page(translated_pages)
    ordered_page_indices = sorted(page_idx for page_idx in translated_pages if 0 <= page_idx < len(doc))
    if not ordered_page_indices:
        return

    page_specs: list[tuple[int, float, float, list[dict], str]] = []
    for overlay_idx, page_idx in enumerate(ordered_page_indices):
        page = doc[page_idx]
        page_specs.append(
            (page_idx, page.rect.width, page.rect.height, translated_pages[page_idx], f"{stem}-{overlay_idx:03d}")
        )

    overlay_paths: dict[int, Path] = {}
    max_workers = compile_workers or _default_compile_workers(len(page_specs))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {
            executor.submit(
                _compile_overlay_with_fallback,
                page_width,
                page_height,
                items,
                page_stem,
            ): page_idx
            for page_idx, page_width, page_height, items, page_stem in page_specs
        }
        for future in as_completed(future_map):
            page_idx = future_map[future]
            overlay_paths[page_idx] = future.result()

    for page_idx in ordered_page_indices:
        page = doc[page_idx]
        strip_page_links(page)
        redact_translated_text_areas(page, translated_pages[page_idx])
        overlay_doc = fitz.open(overlay_paths[page_idx])
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
    strip_page_links(page)
    overlay_translated_items_on_page(page, translated_items, stem=f"page-{page_idx + 1}")

    save_optimized_pdf(temp_doc, output_pdf_path)
    temp_doc.close()
    source_doc.close()


def build_book_typst_pdf(
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    compile_workers: int | None = None,
) -> None:
    doc = fitz.open(source_pdf_path)
    try:
        overlay_translated_pages_on_doc(doc, translated_pages, stem="book-overlay", compile_workers=compile_workers)
        save_optimized_pdf(doc, output_pdf_path)
    finally:
        doc.close()
