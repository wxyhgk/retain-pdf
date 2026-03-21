import time
from pathlib import Path

import fitz

from common.config import DEFAULT_FONT_PATH
from ocr.json_extractor import load_ocr_json
from rendering.pdf_overlay import apply_translated_items_to_page
from rendering.pdf_overlay import save_optimized_pdf
from rendering.render_payloads import prepare_render_payloads_by_page
from rendering.typst_page_renderer import build_book_typst_pdf
from rendering.typst_page_renderer import overlay_translated_pages_on_doc
from translation.deepseek_client import DEFAULT_BASE_URL
from pipeline.book_translation_flow import translate_book_pages
from pipeline.book_translation_flow import translate_book_with_global_continuations
from translation.translations import load_translations


def resolve_page_range(total_pages: int, start_page: int, end_page: int) -> tuple[int, int]:
    start = max(0, start_page)
    stop = total_pages - 1 if end_page < 0 else min(end_page, total_pages - 1)
    if start > stop:
        raise RuntimeError(f"Invalid page range: start_page={start}, end_page={stop}")
    return start, stop


def find_last_title_cutoff(data: dict) -> tuple[int | None, int | None]:
    pages = data.get("pdf_info", [])
    last_page_idx = None
    last_block_idx = None
    for page_idx, page in enumerate(pages):
        for block_idx, block in enumerate(page.get("para_blocks", [])):
            if block.get("type") == "title":
                last_page_idx = page_idx
                last_block_idx = block_idx
    return last_page_idx, last_block_idx


def is_editable_pdf(doc: fitz.Document, start_page: int, end_page: int) -> bool:
    sample_pages = range(start_page, min(end_page, start_page + 2) + 1)
    words = 0
    for page_idx in sample_pages:
        if 0 <= page_idx < len(doc):
            words += len(doc[page_idx].get_text("words"))
    return words >= 20


def translate_book_pipeline(
    *,
    source_json_path: Path,
    output_dir: Path,
    api_key: str,
    start_page: int = 0,
    end_page: int = -1,
    batch_size: int = 8,
    workers: int = 1,
    mode: str = "fast",
    classify_batch_size: int = 12,
    skip_title_translation: bool = False,
    model: str = "deepseek-chat",
    base_url: str = DEFAULT_BASE_URL,
) -> dict:
    data = load_ocr_json(source_json_path)
    pages = data.get("pdf_info", [])
    if not pages:
        raise RuntimeError("No pages found in OCR JSON.")

    start, stop = resolve_page_range(len(pages), start_page, end_page)
    page_indices = range(start, stop + 1)
    sci_cutoff_page_idx = None
    sci_cutoff_block_idx = None
    if mode == "sci":
        sci_cutoff_page_idx, sci_cutoff_block_idx = find_last_title_cutoff(data)
    translated_pages_map, summaries = translate_book_pages(
        data=data,
        output_dir=output_dir,
        page_indices=page_indices,
        api_key=api_key,
        batch_size=batch_size,
        workers=workers,
        model=model,
        base_url=base_url,
        mode=mode,
        classify_batch_size=classify_batch_size,
        skip_title_translation=skip_title_translation,
        progress_prefix="page",
        sci_cutoff_page_idx=sci_cutoff_page_idx,
        sci_cutoff_block_idx=sci_cutoff_block_idx,
    )
    total_items = sum(item["total_items"] for item in summaries)
    translated_items = sum(item["translated_items"] for item in summaries)
    return {
        "output_dir": output_dir,
        "start_page": start,
        "end_page": stop,
        "page_count": len(summaries),
        "total_items": total_items,
        "translated_items": translated_items,
        "translated_pages_map": translated_pages_map,
        "summaries": summaries,
    }


def build_book_from_translations(
    *,
    source_pdf_path: Path,
    translations_dir: Path,
    output_pdf_path: Path,
    start_page: int = 0,
    end_page: int = -1,
    compile_workers: int | None = None,
    extract_selected_pages: bool = False,
) -> int:
    translated_pages: dict[int, list[dict]] = {}
    for path in sorted(translations_dir.glob("page-*-deepseek.json")):
        stem = path.stem
        if not stem.startswith("page-"):
            continue
        page_part = stem.split("-")[1]
        if not page_part.isdigit():
            continue
        page_idx = int(page_part) - 1
        translated_pages[page_idx] = load_translations(path)

    if not translated_pages:
        raise RuntimeError(f"No translation files found in {translations_dir}")

    start = max(0, start_page)
    stop = max(translated_pages) if end_page < 0 else end_page
    selected_pages = {
        page_idx: items
        for page_idx, items in translated_pages.items()
        if start <= page_idx <= stop
    }
    if not selected_pages:
        raise RuntimeError(f"No translated pages selected in range {start}..{stop}")

    if extract_selected_pages:
        source_doc = fitz.open(source_pdf_path)
        temp_doc = fitz.open()
        try:
            temp_doc.insert_pdf(source_doc, from_page=start, to_page=stop)
            remapped_pages = {
                page_idx - start: items
                for page_idx, items in selected_pages.items()
            }
            overlay_translated_pages_on_doc(
                temp_doc,
                remapped_pages,
                stem="book-overlay",
                compile_workers=compile_workers,
            )
            save_optimized_pdf(temp_doc, output_pdf_path)
        finally:
            temp_doc.close()
            source_doc.close()
        return stop - start + 1

    build_book_typst_pdf(
        source_pdf_path=source_pdf_path,
        output_pdf_path=output_pdf_path,
        translated_pages=selected_pages,
        compile_workers=compile_workers,
    )
    return len(selected_pages)


def build_book_pipeline(
    *,
    source_pdf_path: Path,
    translations_dir: Path,
    output_pdf_path: Path,
    start_page: int = 0,
    end_page: int = -1,
    compile_workers: int | None = None,
    extract_selected_pages: bool = False,
) -> dict:
    pages_rendered = build_book_from_translations(
        source_pdf_path=source_pdf_path,
        translations_dir=translations_dir,
        output_pdf_path=output_pdf_path,
        start_page=start_page,
        end_page=end_page,
        compile_workers=compile_workers,
        extract_selected_pages=extract_selected_pages,
    )
    return {
        "output_pdf_path": output_pdf_path,
        "pages_rendered": pages_rendered,
        "extract_selected_pages": extract_selected_pages,
    }


def run_book_pipeline(
    *,
    source_json_path: Path,
    source_pdf_path: Path,
    output_dir: Path,
    output_pdf_path: Path,
    api_key: str,
    start_page: int,
    end_page: int,
    batch_size: int,
    workers: int,
    model: str,
    base_url: str,
    mode: str,
    classify_batch_size: int,
    skip_title_translation: bool,
    render_mode: str,
    compile_workers: int | None = None,
) -> dict:
    data = load_ocr_json(source_json_path)
    pages = data.get("pdf_info", [])
    if not pages:
        raise RuntimeError("No pages found in OCR JSON.")

    start_idx, end_idx = resolve_page_range(len(pages), start_page, end_page)
    sci_cutoff_page_idx = None
    sci_cutoff_block_idx = None
    if mode == "sci":
        sci_cutoff_page_idx, sci_cutoff_block_idx = find_last_title_cutoff(data)
    doc = fitz.open(source_pdf_path)
    translated_pages_map: dict[int, list[dict]] = {}
    translated_items_total = 0
    translated_pages = 0
    translate_started = time.perf_counter()
    try:
        effective_render_mode = render_mode
        if effective_render_mode == "auto":
            effective_render_mode = "compact" if is_editable_pdf(doc, start_idx, end_idx) else "typst"
            print(f"auto render mode selected: {effective_render_mode}")

        page_indices = range(start_idx, end_idx + 1)
        translated_pages_map, summaries = translate_book_with_global_continuations(
            data=data,
            output_dir=output_dir,
            page_indices=page_indices,
            api_key=api_key,
            batch_size=batch_size,
            workers=max(1, workers),
            model=model,
            base_url=base_url,
            mode=mode,
            classify_batch_size=max(1, classify_batch_size),
            skip_title_translation=skip_title_translation,
            sci_cutoff_page_idx=sci_cutoff_page_idx,
            sci_cutoff_block_idx=sci_cutoff_block_idx,
        )
        render_pages_map = prepare_render_payloads_by_page(translated_pages_map)
        for page_idx, summary in zip(sorted(translated_pages_map), summaries):
            translated_items_total += summary["translated_items"]
            translated_pages += 1
            print(f"page {page_idx + 1}: translated {summary['translated_items']}/{summary['total_items']}")
            if effective_render_mode != "typst" and 0 <= page_idx < len(doc):
                page = doc[page_idx]
                apply_translated_items_to_page(page, render_pages_map[page_idx], DEFAULT_FONT_PATH)

        if effective_render_mode == "typst":
            overlay_translated_pages_on_doc(
                doc,
                translated_pages_map,
                stem="run-book-overlay",
                compile_workers=compile_workers,
            )

        translate_elapsed = time.perf_counter() - translate_started
        save_started = time.perf_counter()
        save_optimized_pdf(doc, output_pdf_path)
        save_elapsed = time.perf_counter() - save_started
    finally:
        doc.close()

    total_elapsed = time.perf_counter() - translate_started
    return {
        "output_dir": output_dir,
        "output_pdf_path": output_pdf_path,
        "pages_processed": translated_pages,
        "translated_items_total": translated_items_total,
        "translate_elapsed": translate_elapsed,
        "save_elapsed": save_elapsed,
        "total_elapsed": total_elapsed,
    }
