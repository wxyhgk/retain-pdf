from __future__ import annotations

from pathlib import Path
from typing import Callable

import fitz

from retainpdf_pipeline.foundation.config import fonts
from retainpdf_pipeline.render.output.pdf_writer import save_fast_pdf
from retainpdf_pipeline.render.output.pdf_writer import save_optimized_pdf
from retainpdf_pipeline.render.layout.payload.prepare import prepare_render_payloads_by_page
from retainpdf_pipeline.render.document.page_map import RenderPageMap
from retainpdf_pipeline.render.document.metadata import copy_toc
from retainpdf_pipeline.render.document.metadata import copy_toc_for_page_map
from retainpdf_pipeline.render.output.typst.compiler import compile_typst_book_background_pdf
from retainpdf_pipeline.render.output.typst.sanitize import sanitize_page_specs_for_typst_book_background
from retainpdf_pipeline.render.output.typst.shared import default_typst_temp_root
from retainpdf_pipeline.render.output.typst.shared import prepare_typst_work_dir
from retainpdf_pipeline.render.policy import apply_render_page_policy_fields
from retainpdf_pipeline.render.policy import apply_render_pages_policy_fields

TypstRepairRequestFn = Callable[..., str]


def resolve_typst_temp_root(output_pdf_path: Path, temp_root: Path | None) -> Path:
    typst_temp_root = temp_root or default_typst_temp_root(output_pdf_path)
    typst_temp_root.mkdir(parents=True, exist_ok=True)
    return typst_temp_root


def prepare_single_page_items(
    translated_items: list[dict],
    page_idx: int,
    *,
    source_pdf_path: Path | None = None,
) -> list[dict]:
    prepared_pages = prepare_render_payloads_by_page({page_idx: translated_items}, source_pdf_path=source_pdf_path)
    prepared_items = prepared_pages.get(page_idx, translated_items)
    return apply_render_page_policy_fields(prepared_items)


def collect_background_page_specs(
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    *,
    prepared: bool = False,
) -> list[tuple[int, float, float, list[dict]]]:
    prepared_pages = (
        apply_render_pages_policy_fields(translated_pages)
        if prepared
        else prepare_translated_pages_for_render(source_pdf_path, translated_pages)
    )
    source_doc = fitz.open(source_pdf_path)
    try:
        ordered_page_indices = sorted(page_idx for page_idx in prepared_pages if 0 <= page_idx < len(source_doc))
        return [
            (
                page_idx,
                source_doc[page_idx].rect.width,
                source_doc[page_idx].rect.height,
                prepared_pages[page_idx],
            )
            for page_idx in ordered_page_indices
        ]
    finally:
        source_doc.close()


def prepare_translated_pages_for_render(
    source_pdf_path: Path | None,
    translated_pages: dict[int, list[dict]],
    *,
    first_line_indent_lookup: dict[str, float] | None = None,
    effective_inner_bbox_lookup: dict[str, list[float]] | None = None,
    skip_policy_page_indices: frozenset[int] = frozenset(),
) -> dict[int, list[dict]]:
    prepared_pages = prepare_render_payloads_by_page(
        translated_pages,
        source_pdf_path=source_pdf_path,
        first_line_indent_lookup=first_line_indent_lookup,
        effective_inner_bbox_lookup=effective_inner_bbox_lookup,
    )
    return apply_render_pages_policy_fields(prepared_pages)


def compile_background_pdf_resilient(
    source_pdf_path: Path,
    page_specs: list[tuple[int, float, float, list[dict]]],
    *,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    work_dir: Path,
    request_chat_content_fn: TypstRepairRequestFn | None = None,
) -> Path:
    try:
        return compile_typst_book_background_pdf(
            source_pdf_path=source_pdf_path,
            page_specs=page_specs,
            stem="book-background-overlay",
            font_family=font_family,
            font_paths=font_paths,
            work_dir=work_dir,
            request_chat_content_fn=request_chat_content_fn,
        )
    except RuntimeError as exc:
        print("typst background book compile failed; sanitizing pages", flush=True)
        print(str(exc), flush=True)
        sanitized_page_specs = sanitize_page_specs_for_typst_book_background(
            page_specs,
            stem="book-background-overlay",
            api_key=api_key,
            model=model,
            base_url=base_url,
            font_family=font_family,
            font_paths=font_paths,
            work_dir=work_dir,
        )
        return compile_typst_book_background_pdf(
            source_pdf_path=source_pdf_path,
            page_specs=sanitized_page_specs,
            stem="book-background-overlay-sanitized",
            font_family=font_family,
            font_paths=font_paths,
            work_dir=work_dir,
        )


def build_dual_doc_pages(
    source_doc: fitz.Document,
    translated_doc: fitz.Document,
    dual_doc: fitz.Document,
    *,
    start_page: int = 0,
    end_page: int = -1,
) -> None:
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


def save_background_pdf_to_output(
    background_pdf: Path,
    output_pdf_path: Path,
    *,
    source_pdf_path: Path | None = None,
    page_map: RenderPageMap | None = None,
    fast_save: bool = False,
) -> None:
    background_doc = fitz.open(background_pdf)
    source_doc = fitz.open(source_pdf_path) if source_pdf_path else None
    try:
        if source_doc is not None:
            if page_map is not None:
                copy_toc_for_page_map(source_doc, background_doc, page_map=page_map)
            else:
                copy_toc(source_doc, background_doc)
        if fast_save:
            save_fast_pdf(background_doc, output_pdf_path)
        else:
            save_optimized_pdf(background_doc, output_pdf_path)
    finally:
        if source_doc is not None:
            source_doc.close()
        background_doc.close()


def prepare_background_work_dir(output_pdf_path: Path, temp_root: Path | None) -> Path:
    typst_temp_root = resolve_typst_temp_root(output_pdf_path, temp_root)
    return prepare_typst_work_dir(typst_temp_root, "background-book")
