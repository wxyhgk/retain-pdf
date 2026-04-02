from __future__ import annotations

from pathlib import Path

from foundation.config import fonts
from services.rendering.typst.compiler import compile_typst_overlay_pdf
from services.rendering.typst.shared import TYPST_OVERLAY_DIR
from services.rendering.typst.shared import force_plain_text_items
from services.rendering.typst.sanitize_steps import find_bad_item_indices
from services.rendering.typst.sanitize_steps import try_selective_formula_strip
from services.rendering.typst.sanitize_steps import try_selective_llm_repair
from services.rendering.typst.sanitize_steps import try_selective_plain_text


def sanitize_items_for_typst_compile(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    stem: str,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    include_cover_rect: bool = True,
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
            include_cover_rect=include_cover_rect,
            font_paths=font_paths,
            work_dir=work_dir,
        )
        return translated_items
    except RuntimeError as page_error:
        bad_indices = find_bad_item_indices(
            page_width,
            page_height,
            translated_items,
            stem=stem,
            font_family=font_family,
            include_cover_rect=include_cover_rect,
            font_paths=font_paths,
            work_dir=work_dir,
        )

        if bad_indices:
            print(f"typst selective fallback: {stem} block_indices={bad_indices}", flush=True)
            patched_items = try_selective_formula_strip(
                page_width,
                page_height,
                translated_items,
                bad_indices,
                stem=stem,
                font_family=font_family,
                include_cover_rect=include_cover_rect,
                font_paths=font_paths,
                work_dir=work_dir,
            )
            if patched_items is not None:
                return patched_items

            llm_patched_items = try_selective_llm_repair(
                page_width,
                page_height,
                translated_items,
                bad_indices,
                stem=stem,
                api_key=api_key,
                model=model,
                base_url=base_url,
                font_family=font_family,
                include_cover_rect=include_cover_rect,
                font_paths=font_paths,
                work_dir=work_dir,
            )
            if llm_patched_items is not None:
                return llm_patched_items

            patched_items = try_selective_plain_text(
                page_width,
                page_height,
                translated_items,
                bad_indices,
                stem=stem,
                font_family=font_family,
                include_cover_rect=include_cover_rect,
                font_paths=font_paths,
                work_dir=work_dir,
            )
            if patched_items is not None:
                return patched_items

        print(f"typst page fallback to plain text: {stem}", flush=True)
        print(str(page_error), flush=True)
        patched_items = force_plain_text_items(translated_items)
        compile_typst_overlay_pdf(
            page_width,
            page_height,
            patched_items,
            stem=f"{stem}-plain",
            font_family=font_family,
            include_cover_rect=include_cover_rect,
            font_paths=font_paths,
            work_dir=work_dir,
        )
        return patched_items


def compile_overlay_pdf_resilient(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    stem: str,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    include_cover_rect: bool = True,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
) -> Path:
    work_dir = work_dir or TYPST_OVERLAY_DIR
    sanitized_items = sanitize_items_for_typst_compile(
        page_width,
        page_height,
        translated_items,
        stem=stem,
        api_key=api_key,
        model=model,
        base_url=base_url,
        font_family=font_family,
        include_cover_rect=include_cover_rect,
        font_paths=font_paths,
        work_dir=work_dir,
    )
    return compile_typst_overlay_pdf(
        page_width,
        page_height,
        sanitized_items,
        stem=f"{stem}-final",
        font_family=font_family,
        include_cover_rect=include_cover_rect,
        font_paths=font_paths,
        work_dir=work_dir,
    )


def sanitize_page_specs_for_typst_book_background(
    page_specs: list[tuple[int, float, float, list[dict]]],
    stem: str,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
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
            api_key=api_key,
            model=model,
            base_url=base_url,
            font_family=font_family,
            include_cover_rect=True,
            font_paths=font_paths,
            work_dir=work_dir,
        )
        sanitized_specs.append((source_page_idx, page_width, page_height, sanitized_items))
    return sanitized_specs


def sanitize_page_specs_for_typst_book_overlay(
    page_specs: list[tuple[int, float, float, list[dict], str]],
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
) -> list[tuple[int, float, float, list[dict], str]]:
    work_dir = work_dir or TYPST_OVERLAY_DIR
    sanitized_specs: list[tuple[int, float, float, list[dict], str]] = []
    for page_idx, page_width, page_height, translated_items, page_stem in page_specs:
        sanitized_items = sanitize_items_for_typst_compile(
            page_width,
            page_height,
            translated_items,
            stem=page_stem,
            api_key=api_key,
            model=model,
            base_url=base_url,
            font_family=font_family,
            font_paths=font_paths,
            work_dir=work_dir / "page-overlays" / page_stem,
        )
        sanitized_specs.append((page_idx, page_width, page_height, sanitized_items, page_stem))
    return sanitized_specs
