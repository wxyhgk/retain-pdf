from __future__ import annotations

from pathlib import Path

from common.config import TYPST_DEFAULT_FONT_FAMILY
from rendering.typst_renderer.compiler import compile_typst_overlay_pdf
from rendering.typst_renderer.shared import TYPST_OVERLAY_DIR
from rendering.typst_renderer.shared import force_plain_text_item_at_index
from rendering.typst_renderer.shared import force_plain_text_items
from rendering.typst_renderer.shared import strip_formula_commands_for_item_at_index


def sanitize_items_for_typst_compile(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    stem: str,
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
) -> list[dict]:
    work_dir = work_dir or TYPST_OVERLAY_DIR
    try:
        compile_typst_overlay_pdf(
            page_width,
            page_height,
            translated_items,
            stem=stem,
            font_family=font_family,
            font_paths=font_paths,
            work_dir=work_dir,
        )
        return translated_items
    except RuntimeError as page_error:
        bad_indices: list[int] = []
        for index in range(len(translated_items)):
            try:
                compile_typst_overlay_pdf(
                    page_width,
                    page_height,
                    [translated_items[index]],
                    stem=f"{stem}-probe-{index:03d}",
                    font_family=font_family,
                    font_paths=font_paths,
                    work_dir=work_dir,
                )
            except RuntimeError:
                bad_indices.append(index)

        if bad_indices:
            print(f"typst selective fallback: {stem} block_indices={bad_indices}", flush=True)
            patched_items = translated_items
            for index in bad_indices:
                patched_items = strip_formula_commands_for_item_at_index(patched_items, index)
            try:
                compile_typst_overlay_pdf(
                    page_width,
                    page_height,
                    patched_items,
                    stem=f"{stem}-selective-strip",
                    font_family=font_family,
                    font_paths=font_paths,
                    work_dir=work_dir,
                )
                return patched_items
            except RuntimeError:
                pass

            patched_items = translated_items
            for index in bad_indices:
                patched_items = force_plain_text_item_at_index(patched_items, index)
            try:
                compile_typst_overlay_pdf(
                    page_width,
                    page_height,
                    patched_items,
                    stem=f"{stem}-selective-plain",
                    font_family=font_family,
                    font_paths=font_paths,
                    work_dir=work_dir,
                )
                return patched_items
            except RuntimeError:
                pass

        print(f"typst page fallback to plain text: {stem}", flush=True)
        print(str(page_error), flush=True)
        patched_items = force_plain_text_items(translated_items)
        compile_typst_overlay_pdf(
            page_width,
            page_height,
            patched_items,
            stem=f"{stem}-plain",
            font_family=font_family,
            font_paths=font_paths,
            work_dir=work_dir,
        )
        return patched_items


def compile_overlay_pdf_resilient(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    stem: str,
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
) -> Path:
    work_dir = work_dir or TYPST_OVERLAY_DIR
    sanitized_items = sanitize_items_for_typst_compile(
        page_width,
        page_height,
        translated_items,
        stem=stem,
        font_family=font_family,
        font_paths=font_paths,
        work_dir=work_dir,
    )
    return compile_typst_overlay_pdf(
        page_width,
        page_height,
        sanitized_items,
        stem=f"{stem}-final",
        font_family=font_family,
        font_paths=font_paths,
        work_dir=work_dir,
    )


def sanitize_page_specs_for_typst_book_background(
    page_specs: list[tuple[int, float, float, list[dict]]],
    stem: str,
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
) -> list[tuple[int, float, float, list[dict]]]:
    work_dir = work_dir or TYPST_OVERLAY_DIR
    sanitized_specs: list[tuple[int, float, float, list[dict]]] = []
    for page_index, (source_page_idx, page_width, page_height, translated_items) in enumerate(page_specs):
        sanitized_items = sanitize_items_for_typst_compile(
            page_width,
            page_height,
            translated_items,
            stem=f"{stem}-page-{page_index:03d}",
            font_family=font_family,
            font_paths=font_paths,
            work_dir=work_dir,
        )
        sanitized_specs.append((source_page_idx, page_width, page_height, sanitized_items))
    return sanitized_specs
