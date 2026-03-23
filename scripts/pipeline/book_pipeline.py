import time
from pathlib import Path

from config import fonts
from config import runtime
from pipeline.render_mode import is_editable_pdf
from pipeline.render_mode import resolve_page_range
from pipeline.render_stage import build_book_from_translations
from pipeline.render_stage import build_book_pipeline
from pipeline.render_stage import run_render_stage
from pipeline.translation_stage import translate_book_pipeline


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
    typst_font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    pdf_compress_dpi: int = runtime.DEFAULT_PDF_COMPRESS_DPI,
) -> dict:
    total_started = time.perf_counter()
    translation_summary = translate_book_pipeline(
        source_json_path=source_json_path,
        output_dir=output_dir,
        api_key=api_key,
        start_page=start_page,
        end_page=end_page,
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
    render_summary = run_render_stage(
        source_pdf_path=source_pdf_path,
        translations_dir=output_dir,
        output_pdf_path=output_pdf_path,
        start_page=translation_summary["start_page"],
        end_page=translation_summary["end_page"],
        render_mode=render_mode,
        translated_pages_map=translation_summary["translated_pages_map"],
        compile_workers=compile_workers,
        extract_selected_pages=False,
        typst_font_family=typst_font_family,
        pdf_compress_dpi=pdf_compress_dpi,
    )
    save_elapsed = time.perf_counter() - save_started
    total_elapsed = time.perf_counter() - total_started
    return {
        "output_dir": output_dir,
        "output_pdf_path": render_summary["output_pdf_path"],
        "pages_processed": translated_pages,
        "translated_items_total": translated_items_total,
        "translate_elapsed": translate_elapsed,
        "save_elapsed": save_elapsed,
        "total_elapsed": total_elapsed,
        "effective_render_mode": render_summary["effective_render_mode"],
    }
