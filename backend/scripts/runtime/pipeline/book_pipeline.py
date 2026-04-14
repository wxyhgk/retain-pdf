from __future__ import annotations
import time
from pathlib import Path

from foundation.config import fonts
from foundation.config import runtime
from foundation.config.output_layout import ARTIFACTS_DIR_NAME
from runtime.pipeline.render_mode import is_editable_pdf
from runtime.pipeline.render_mode import resolve_page_range
from runtime.pipeline.render_stage import build_book_from_translations
from runtime.pipeline.render_stage import build_book_pipeline
from runtime.pipeline.render_stage import run_render_stage
from runtime.pipeline.translation_stage import translate_book_pipeline
from services.translation.diagnostics import write_translation_diagnostics
from services.translation.terms import GlossaryEntry


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
    math_mode: str = "placeholder",
    classify_batch_size: int = 12,
    skip_title_translation: bool,
    render_mode: str,
    rule_profile_name: str = "general_sci",
    custom_rules_text: str = "",
    glossary_id: str = "",
    glossary_name: str = "",
    glossary_resource_entry_count: int = 0,
    glossary_inline_entry_count: int = 0,
    glossary_overridden_entry_count: int = 0,
    glossary_entries: list[GlossaryEntry] | None = None,
    compile_workers: int | None = None,
    typst_font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    pdf_compress_dpi: int = runtime.DEFAULT_PDF_COMPRESS_DPI,
    invocation: dict | None = None,
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
        math_mode=math_mode,
        classify_batch_size=max(1, classify_batch_size),
        skip_title_translation=skip_title_translation,
        model=model,
        base_url=base_url,
        source_pdf_path=source_pdf_path,
        rule_profile_name=rule_profile_name,
        custom_rules_text=custom_rules_text,
        glossary_id=glossary_id,
        glossary_name=glossary_name,
        glossary_resource_entry_count=glossary_resource_entry_count,
        glossary_inline_entry_count=glossary_inline_entry_count,
        glossary_overridden_entry_count=glossary_overridden_entry_count,
        glossary_entries=glossary_entries or [],
        invocation=invocation,
    )
    translate_elapsed = time.perf_counter() - total_started
    diagnostics_path = output_dir.parent / ARTIFACTS_DIR_NAME / "translation_diagnostics.json"
    translation_run_diagnostics = translation_summary.get("translation_run_diagnostics")
    diagnostics_summary = (
        write_translation_diagnostics(
            diagnostics_path,
            translation_run_diagnostics,
            glossary=translation_summary.get("glossary"),
            translated_pages_map=translation_summary.get("translated_pages_map"),
        )
        if translation_run_diagnostics is not None
        else {}
    )

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
        api_key=api_key,
        model=model,
        base_url=base_url,
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
        "rule_profile_name": translation_summary.get("rule_profile_name", ""),
        "custom_rules_text": translation_summary.get("custom_rules_text", ""),
        "glossary": translation_summary.get("glossary", {}),
        "translate_elapsed": translate_elapsed,
        "save_elapsed": save_elapsed,
        "total_elapsed": total_elapsed,
        "effective_render_mode": render_summary["effective_render_mode"],
        "translation_diagnostics_path": str(diagnostics_path) if diagnostics_summary else "",
        "translation_provider_family": diagnostics_summary.get("provider_family", ""),
        "translation_peak_inflight_requests": diagnostics_summary.get("concurrency_observed", {}).get(
            "peak_inflight_all_llm_requests",
            0,
        ),
        "translation_timeout_attempts": diagnostics_summary.get("request_counts", {}).get("timeout_attempts", 0),
        "translation_retrying_items": diagnostics_summary.get("retry_summary", {}).get("retrying_request_labels", 0),
        "invocation": translation_summary.get("invocation", invocation or {}),
    }
