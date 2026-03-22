import os
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import fitz

from common.config import DEFAULT_FONT_SIZE, OUTPUT_DIR, ROOT_DIR, TYPST_DEFAULT_FONT_FAMILY
from rendering.models import RenderBlock
from rendering.pdf_overlay import save_optimized_pdf
from rendering.pdf_overlay import redact_translated_text_areas
from rendering.pdf_overlay import strip_page_links
from rendering.render_payloads import build_render_blocks
from rendering.render_payloads import prepare_render_payloads_by_page


TYPST_BIN = "/snap/bin/typst"
TYPST_OVERLAY_DIR = OUTPUT_DIR / "typst_overlay"
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
        f"  let y = if size.height > {height}pt {{ {y0}pt }} else {{ {y0}pt + ({height}pt - size.height) / 2 }}\n"
        f"  place(top + left, dx: {x0}pt, dy: y, {body_name})\n"
        "}"
    )
    return command


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
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
) -> str:
    return build_typst_book_overlay_source([(page_width, page_height, translated_items)], font_family=font_family)


def build_typst_book_overlay_source(
    page_specs: list[tuple[float, float, list[dict]]],
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
) -> str:
    lines = [
        f'#set text(font: "{font_family}", size: {DEFAULT_FONT_SIZE}pt)',
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
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
) -> str:
    source_rel = os.path.relpath(source_pdf_path, work_dir)
    lines = [
        f'#set text(font: "{font_family}", size: {DEFAULT_FONT_SIZE}pt)',
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


def _typst_compile_command(typ_path: Path, pdf_path: Path, font_paths: list[Path] | None = None) -> list[str]:
    command = [TYPST_BIN, "compile"]
    for font_path in font_paths or []:
        command.extend(["--font-path", str(font_path)])
    command.extend([str(typ_path), str(pdf_path)])
    return command


def compile_typst_overlay_pdf(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    stem: str,
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
) -> Path:
    work_dir = work_dir or TYPST_OVERLAY_DIR
    work_dir.mkdir(parents=True, exist_ok=True)
    typ_path = work_dir / f"{stem}.typ"
    pdf_path = work_dir / f"{stem}.pdf"
    typ_path.write_text(
        build_typst_overlay_source(page_width, page_height, translated_items, font_family=font_family),
        encoding="utf-8",
    )
    proc = subprocess.run(_typst_compile_command(typ_path, pdf_path, font_paths), capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout).strip())
    return pdf_path


def compile_typst_book_overlay_pdf(
    page_specs: list[tuple[float, float, list[dict]]],
    stem: str,
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
) -> Path:
    work_dir = work_dir or TYPST_OVERLAY_DIR
    work_dir.mkdir(parents=True, exist_ok=True)
    typ_path = work_dir / f"{stem}.typ"
    pdf_path = work_dir / f"{stem}.pdf"
    typ_path.write_text(build_typst_book_overlay_source(page_specs, font_family=font_family), encoding="utf-8")
    proc = subprocess.run(_typst_compile_command(typ_path, pdf_path, font_paths), capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout).strip())
    return pdf_path


def compile_typst_book_background_pdf(
    source_pdf_path: Path,
    page_specs: list[tuple[int, float, float, list[dict]]],
    stem: str,
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
) -> Path:
    work_dir = work_dir or TYPST_OVERLAY_DIR
    work_dir.mkdir(parents=True, exist_ok=True)
    typ_path = work_dir / f"{stem}.typ"
    pdf_path = work_dir / f"{stem}.pdf"
    typ_path.write_text(
        build_typst_book_background_source(source_pdf_path, page_specs, work_dir, font_family=font_family),
        encoding="utf-8",
    )
    command = [TYPST_BIN, "compile", "--root", str(ROOT_DIR)]
    for font_path in font_paths or []:
        command.extend(["--font-path", str(font_path)])
    command.extend([str(typ_path), str(pdf_path)])
    proc = subprocess.run(command, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout).strip())
    return pdf_path


def overlay_translated_items_on_page(
    page: fitz.Page,
    translated_items: list[dict],
    stem: str,
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
) -> None:
    redact_translated_text_areas(page, translated_items)
    with tempfile.TemporaryDirectory(prefix="typst-overlay-", dir=OUTPUT_DIR) as temp_dir:
        work_dir = Path(temp_dir)
        try:
            overlay_pdf = compile_typst_overlay_pdf(
                page.rect.width,
                page.rect.height,
                translated_items,
                stem=stem,
                font_family=font_family,
                font_paths=font_paths,
                work_dir=work_dir,
            )
        except RuntimeError:
            overlay_pdf = compile_typst_overlay_pdf(
                page.rect.width,
                page.rect.height,
                _force_plain_text_items(translated_items),
                stem=f"{stem}-plain",
                font_family=font_family,
                font_paths=font_paths,
                work_dir=work_dir,
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
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
) -> Path:
    work_dir = Path(tempfile.mkdtemp(prefix="typst-page-", dir=OUTPUT_DIR))
    try:
        return compile_typst_overlay_pdf(
            page_width,
            page_height,
            translated_items,
            stem=stem,
            font_family=font_family,
            font_paths=font_paths,
            work_dir=work_dir,
        )
    except RuntimeError:
        return compile_typst_overlay_pdf(
            page_width,
            page_height,
            _force_plain_text_items(translated_items),
            stem=f"{stem}-plain",
            font_family=font_family,
            font_paths=font_paths,
            work_dir=work_dir,
        )


def _compile_book_overlay_with_fallback(
    page_specs: list[tuple[float, float, list[dict]]],
    stem: str,
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
) -> Path:
    work_dir = Path(tempfile.mkdtemp(prefix="typst-book-", dir=OUTPUT_DIR))
    return compile_typst_book_overlay_pdf(
        page_specs,
        stem=stem,
        font_family=font_family,
        font_paths=font_paths,
        work_dir=work_dir,
    )


def _overlay_pages_from_single_pdf(
    doc: fitz.Document,
    ordered_page_indices: list[int],
    translated_pages: dict[int, list[dict]],
    overlay_pdf_path: Path,
) -> None:
    overlay_doc = fitz.open(overlay_pdf_path)
    try:
        for overlay_page_idx, page_idx in enumerate(ordered_page_indices):
            page = doc[page_idx]
            strip_page_links(page)
            redact_translated_text_areas(page, translated_pages[page_idx])
            page.show_pdf_page(page.rect, overlay_doc, overlay_page_idx, overlay=True)
    finally:
        overlay_doc.close()
        try:
            overlay_pdf_path.unlink(missing_ok=True)
            overlay_pdf_path.with_suffix(".typ").unlink(missing_ok=True)
            overlay_pdf_path.parent.rmdir()
        except Exception:
            pass


def _overlay_pages_via_page_fallback(
    doc: fitz.Document,
    ordered_page_indices: list[int],
    page_specs: list[tuple[int, float, float, list[dict], str]],
    translated_pages: dict[int, list[dict]],
    compile_workers: int | None = None,
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
) -> None:
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
                font_family,
                font_paths,
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
            try:
                overlay_path = overlay_paths[page_idx]
                overlay_path.unlink(missing_ok=True)
                overlay_path.with_suffix(".typ").unlink(missing_ok=True)
                overlay_path.parent.rmdir()
            except Exception:
                pass


def overlay_translated_pages_on_doc(
    doc: fitz.Document,
    translated_pages: dict[int, list[dict]],
    stem: str,
    compile_workers: int | None = None,
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
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
    book_specs = [(page_width, page_height, items) for _, page_width, page_height, items, _ in page_specs]
    try:
        overlay_pdf = _compile_book_overlay_with_fallback(
            book_specs,
            stem=stem,
            font_family=font_family,
            font_paths=font_paths,
        )
        _overlay_pages_from_single_pdf(doc, ordered_page_indices, translated_pages, overlay_pdf)
    except RuntimeError:
        print("typst book compile failed; falling back to per-page compilation")
        _overlay_pages_via_page_fallback(
            doc,
            ordered_page_indices,
            page_specs,
            translated_pages,
            compile_workers=compile_workers,
            font_family=font_family,
            font_paths=font_paths,
        )


def build_single_page_typst_pdf(
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_items: list[dict],
    page_idx: int,
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
) -> None:
    source_doc = fitz.open(source_pdf_path)
    temp_doc = fitz.open()
    temp_doc.insert_pdf(source_doc, from_page=page_idx, to_page=page_idx)
    page = temp_doc[0]
    strip_page_links(page)
    overlay_translated_items_on_page(
        page,
        translated_items,
        stem=f"page-{page_idx + 1}",
        font_family=font_family,
        font_paths=font_paths,
    )

    save_optimized_pdf(temp_doc, output_pdf_path)
    temp_doc.close()
    source_doc.close()


def build_book_typst_pdf(
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    compile_workers: int | None = None,
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
) -> None:
    doc = fitz.open(source_pdf_path)
    try:
        overlay_translated_pages_on_doc(
            doc,
            translated_pages,
            stem="book-overlay",
            compile_workers=compile_workers,
            font_family=font_family,
            font_paths=font_paths,
        )
        save_optimized_pdf(doc, output_pdf_path)
    finally:
        doc.close()


def build_dual_book_pdf(
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    start_page: int = 0,
    end_page: int = -1,
    compile_workers: int | None = None,
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
) -> None:
    source_doc = fitz.open(source_pdf_path)
    translated_doc = fitz.open(source_pdf_path)
    dual_doc = fitz.open()
    try:
        overlay_translated_pages_on_doc(
            translated_doc,
            translated_pages,
            stem="book-overlay-dual",
            compile_workers=compile_workers,
            font_family=font_family,
            font_paths=font_paths,
        )
        last_page = len(source_doc) - 1
        start_idx = max(0, start_page)
        end_idx = last_page if end_page < 0 else min(end_page, last_page)
        for page_idx in range(start_idx, end_idx + 1):
            source_page = source_doc[page_idx]
            translated_page = translated_doc[page_idx]
            page_width = source_page.rect.width + translated_page.rect.width
            page_height = max(source_page.rect.height, translated_page.rect.height)
            dual_page = dual_doc.new_page(width=page_width, height=page_height)
            dual_page.show_pdf_page(
                fitz.Rect(0, 0, source_page.rect.width, source_page.rect.height),
                source_doc,
                page_idx,
                overlay=True,
            )
            dual_page.show_pdf_page(
                fitz.Rect(
                    source_page.rect.width,
                    0,
                    source_page.rect.width + translated_page.rect.width,
                    translated_page.rect.height,
                ),
                translated_doc,
                page_idx,
                overlay=True,
            )
        save_optimized_pdf(dual_doc, output_pdf_path)
    finally:
        dual_doc.close()
        translated_doc.close()
        source_doc.close()


def build_book_typst_background_pdf(
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
) -> None:
    translated_pages = prepare_render_payloads_by_page(translated_pages)
    source_doc = fitz.open(source_pdf_path)
    try:
        ordered_page_indices = sorted(page_idx for page_idx in translated_pages if 0 <= page_idx < len(source_doc))
        page_specs = [
            (
                page_idx,
                source_doc[page_idx].rect.width,
                source_doc[page_idx].rect.height,
                translated_pages[page_idx],
            )
            for page_idx in ordered_page_indices
        ]
    finally:
        source_doc.close()

    with tempfile.TemporaryDirectory(prefix="typst-background-", dir=OUTPUT_DIR) as temp_dir:
        background_pdf = compile_typst_book_background_pdf(
            source_pdf_path=source_pdf_path,
            page_specs=page_specs,
            stem="book-background-overlay",
            font_family=font_family,
            font_paths=font_paths,
            work_dir=Path(temp_dir),
        )
        background_doc = fitz.open(background_pdf)
        try:
            save_optimized_pdf(background_doc, output_pdf_path)
        finally:
            background_doc.close()
