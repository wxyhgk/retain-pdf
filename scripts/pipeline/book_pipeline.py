import time
from pathlib import Path

import fitz

from common.config import DEFAULT_FONT_PATH
from common.config import DEFAULT_PDF_COMPRESS_DPI
from common.config import TYPST_DEFAULT_FONT_FAMILY
from ocr.json_extractor import load_ocr_json
from rendering.pdf_overlay import apply_translated_items_to_page
from rendering.pdf_overlay import save_optimized_pdf
from rendering.pdf_compress import compress_pdf_with_ghostscript
from rendering.pdf_overlay import strip_page_links
from rendering.render_payloads import prepare_render_payloads_by_page
from rendering.typst_page_renderer import build_dual_book_pdf
from rendering.typst_page_renderer import build_book_typst_background_pdf
from rendering.typst_page_renderer import build_book_typst_pdf
from rendering.typst_page_renderer import overlay_translated_pages_on_doc
from translation.deepseek_client import DEFAULT_BASE_URL
from translation.policy_config import build_book_translation_policy_config
from pipeline.book_translation_flow import translate_book_with_global_continuations
from translation.translations import load_translations


def resolve_page_range(total_pages: int, start_page: int, end_page: int) -> tuple[int, int]:
    start = max(0, start_page)
    stop = total_pages - 1 if end_page < 0 else min(end_page, total_pages - 1)
    if start > stop:
        raise RuntimeError(f"Invalid page range: start_page={start}, end_page={stop}")
    return start, stop

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
    source_pdf_path: Path | None = None,
) -> dict:
    data = load_ocr_json(source_json_path)
    pages = data.get("pdf_info", [])
    if not pages:
        raise RuntimeError("No pages found in OCR JSON.")

    start, stop = resolve_page_range(len(pages), start_page, end_page)
    page_indices = range(start, stop + 1)
    policy_config = build_book_translation_policy_config(
        data=data,
        mode=mode,
        skip_title_translation=skip_title_translation,
        source_pdf_path=source_pdf_path,
        api_key=api_key,
        model=model,
        base_url=base_url,
        output_dir=output_dir,
    )
    if policy_config.domain_context.get("domain") or policy_config.domain_context.get("translation_guidance"):
        print(
            f"sci domain: {policy_config.domain_context.get('domain', '').strip() or 'unknown'}",
            flush=True,
        )
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
        sci_cutoff_page_idx=policy_config.sci_cutoff_page_idx,
        sci_cutoff_block_idx=policy_config.sci_cutoff_block_idx,
        policy_config=policy_config,
        domain_guidance=policy_config.domain_guidance,
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
        "domain_context": policy_config.domain_context,
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
    render_mode: str = "typst",
    typst_font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    pdf_compress_dpi: int = DEFAULT_PDF_COMPRESS_DPI,
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

    if render_mode == "dual":
        build_dual_book_pdf(
            source_pdf_path=source_pdf_path,
            output_pdf_path=output_pdf_path,
            translated_pages=selected_pages,
            start_page=start,
            end_page=stop,
            compile_workers=compile_workers,
            font_family=typst_font_family,
        )
        compress_pdf_with_ghostscript(output_pdf_path, dpi=pdf_compress_dpi)
        return len(selected_pages)

    if render_mode == "direct":
        doc = fitz.open(source_pdf_path)
        try:
            render_pages_map = prepare_render_payloads_by_page(selected_pages)
            for page_idx in sorted(render_pages_map):
                if 0 <= page_idx < len(doc):
                    page = doc[page_idx]
                    strip_page_links(page)
                    apply_translated_items_to_page(page, render_pages_map[page_idx], DEFAULT_FONT_PATH)
            save_optimized_pdf(doc, output_pdf_path)
        finally:
            doc.close()
        compress_pdf_with_ghostscript(output_pdf_path, dpi=pdf_compress_dpi)
        return len(selected_pages)

    if render_mode == "typst":
        try:
            print("typst background render selected", flush=True)
            build_book_typst_background_pdf(
                source_pdf_path=source_pdf_path,
                output_pdf_path=output_pdf_path,
                translated_pages=selected_pages,
                font_family=typst_font_family,
            )
        except RuntimeError as exc:
            print("typst background render failed; falling back to overlay route", flush=True)
            print(str(exc), flush=True)
            build_book_typst_pdf(
                source_pdf_path=source_pdf_path,
                output_pdf_path=output_pdf_path,
                translated_pages=selected_pages,
                compile_workers=compile_workers,
                font_family=typst_font_family,
            )
        compress_pdf_with_ghostscript(output_pdf_path, dpi=pdf_compress_dpi)
        return len(selected_pages)

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
                font_family=typst_font_family,
            )
            save_optimized_pdf(temp_doc, output_pdf_path)
        finally:
            temp_doc.close()
            source_doc.close()
        compress_pdf_with_ghostscript(output_pdf_path, dpi=pdf_compress_dpi)
        return stop - start + 1

    build_book_typst_pdf(
        source_pdf_path=source_pdf_path,
        output_pdf_path=output_pdf_path,
        translated_pages=selected_pages,
        compile_workers=compile_workers,
        font_family=typst_font_family,
    )
    compress_pdf_with_ghostscript(output_pdf_path, dpi=pdf_compress_dpi)
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
    render_mode: str = "typst",
    typst_font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    pdf_compress_dpi: int = DEFAULT_PDF_COMPRESS_DPI,
) -> dict:
    pages_rendered = build_book_from_translations(
        source_pdf_path=source_pdf_path,
        translations_dir=translations_dir,
        output_pdf_path=output_pdf_path,
        start_page=start_page,
        end_page=end_page,
        compile_workers=compile_workers,
        extract_selected_pages=extract_selected_pages,
        render_mode=render_mode,
        typst_font_family=typst_font_family,
        pdf_compress_dpi=pdf_compress_dpi,
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
    typst_font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    pdf_compress_dpi: int = DEFAULT_PDF_COMPRESS_DPI,
) -> dict:
    data = load_ocr_json(source_json_path)
    pages = data.get("pdf_info", [])
    if not pages:
        raise RuntimeError("No pages found in OCR JSON.")

    start_idx, end_idx = resolve_page_range(len(pages), start_page, end_page)
    effective_render_mode = render_mode
    if effective_render_mode == "auto":
        doc = fitz.open(source_pdf_path)
        try:
            effective_render_mode = "direct" if is_editable_pdf(doc, start_idx, end_idx) else "typst"
        finally:
            doc.close()
        print(f"auto render mode selected: {effective_render_mode}")

    total_started = time.perf_counter()
    translation_summary = translate_book_pipeline(
        source_json_path=source_json_path,
        output_dir=output_dir,
        api_key=api_key,
        start_page=start_idx,
        end_page=end_idx,
        batch_size=batch_size,
        workers=max(1, workers),
        mode=mode,
        classify_batch_size=max(1, classify_batch_size),
        skip_title_translation=skip_title_translation,
        model=model,
        base_url=base_url,
        source_pdf_path=source_pdf_path,
    )
    translate_elapsed = time.perf_counter() - total_started

    translated_pages = translation_summary["page_count"]
    translated_items_total = translation_summary["translated_items"]
    for page_summary in translation_summary["summaries"]:
        print(f"page {page_summary['page_idx'] + 1}: translated {page_summary['translated_items']}/{page_summary['total_items']}")

    save_started = time.perf_counter()
    if effective_render_mode in {"compact", "direct"}:
        doc = fitz.open(source_pdf_path)
        try:
            translated_pages_map = translation_summary["translated_pages_map"]
            render_pages_map = prepare_render_payloads_by_page(translated_pages_map)
            for page_idx in sorted(translated_pages_map):
                if 0 <= page_idx < len(doc):
                    page = doc[page_idx]
                    apply_translated_items_to_page(page, render_pages_map[page_idx], DEFAULT_FONT_PATH)
            save_optimized_pdf(doc, output_pdf_path)
        finally:
            doc.close()
        compress_pdf_with_ghostscript(output_pdf_path, dpi=pdf_compress_dpi)
    else:
        build_book_pipeline(
            source_pdf_path=source_pdf_path,
            translations_dir=output_dir,
            output_pdf_path=output_pdf_path,
            start_page=start_idx,
            end_page=end_idx,
            compile_workers=compile_workers,
            extract_selected_pages=False,
            render_mode=effective_render_mode,
            typst_font_family=typst_font_family,
            pdf_compress_dpi=pdf_compress_dpi,
        )
    save_elapsed = time.perf_counter() - save_started
    total_elapsed = time.perf_counter() - total_started
    return {
        "output_dir": output_dir,
        "output_pdf_path": output_pdf_path,
        "pages_processed": translated_pages,
        "translated_items_total": translated_items_total,
        "translate_elapsed": translate_elapsed,
        "save_elapsed": save_elapsed,
        "total_elapsed": total_elapsed,
    }
