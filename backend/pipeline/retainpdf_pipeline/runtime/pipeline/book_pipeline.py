from __future__ import annotations
import time
from pathlib import Path

from retainpdf_pipeline.foundation.config import fonts
from retainpdf_pipeline.foundation.config import runtime
from retainpdf_pipeline.foundation.config.output_layout import ARTIFACTS_DIR_NAME
from retainpdf_pipeline.render.render_mode import is_editable_pdf
from retainpdf_pipeline.render.render_mode import resolve_effective_render_mode
from retainpdf_pipeline.render.render_stage import build_book_from_translations
from retainpdf_pipeline.render.render_stage import build_book_pipeline
from retainpdf_pipeline.render.render_stage import run_render_stage
from retainpdf_pipeline.translate.translation_stage import translate_book_pipeline
from retainpdf_pipeline.render.analysis.document import build_render_document_analysis
from retainpdf_pipeline.render.source.prewarm import prewarm_manifest_path_from_artifacts_dir
from retainpdf_pipeline.render.source.prewarm import RenderPrewarmHandle
from retainpdf_pipeline.render.source.prewarm import RenderPrewarmSpec
from retainpdf_pipeline.render.source.prewarm import start_render_source_prewarm
from retainpdf_pipeline.translate.public import resolve_page_range
from retainpdf_pipeline.translate.public import write_translation_debug_index
from retainpdf_pipeline.translate.public import write_translation_diagnostics
from retainpdf_pipeline.translate.public import GlossaryEntry
from retainpdf_pipeline.translate.public import blocking_untranslated_items
from retainpdf_pipeline.translate.public import enforce_no_blocking_review_errors


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
    math_mode: str = "direct_typst",
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
    context_mode: str = "needed",
    glossary_mode: str = "matched",
    memory_mode: str = "matched",
    compile_workers: int | None = None,
    typst_font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    pdf_compress_dpi: int = runtime.DEFAULT_PDF_COMPRESS_DPI,
    source_cleanup_strategy: str = "pikepdf_text_strip",
    invocation: dict | None = None,
    render_visual_prewarm_handle: RenderPrewarmHandle | None = None,
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
        context_mode=context_mode,
        glossary_mode=glossary_mode,
        memory_mode=memory_mode,
        invocation=invocation,
    )
    translate_elapsed = time.perf_counter() - total_started
    diagnostics_path = output_dir.parent / ARTIFACTS_DIR_NAME / "translation_diagnostics.json"
    debug_index_path = output_dir.parent / ARTIFACTS_DIR_NAME / "translation_debug_index.json"
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
    write_translation_debug_index(
        debug_index_path,
        translation_summary.get("translated_pages_map", {}),
    )

    translated_pages = translation_summary["page_count"]
    translated_items_total = translation_summary["translated_items"]
    for page_summary in translation_summary["summaries"]:
        print(f"page {page_summary['page_idx'] + 1}: translated {page_summary['translated_items']}/{page_summary['total_items']}")
    blocking_untranslated = blocking_untranslated_items(translation_summary["translated_pages_map"])
    if blocking_untranslated:
        preview = ", ".join(
            f"p{int(item['page_idx']) + 1}:{item['item_id']}:{item['reason']}"
            for item in blocking_untranslated[:8]
        )
        raise RuntimeError(
            f"translation export gate blocked: unresolved_translation_count={len(blocking_untranslated)} preview={preview}"
        )
    enforce_no_blocking_review_errors(translation_summary.get("translation_review"))

    render_prewarm_manifest_path = prewarm_manifest_path_from_artifacts_dir(output_dir.parent / ARTIFACTS_DIR_NAME)
    render_preprocess_started = time.perf_counter()
    render_document_analysis = _try_build_render_document_analysis(
        source_pdf_path=source_pdf_path,
        translated_pages=translation_summary["translated_pages_map"],
        start_page=translation_summary["start_page"],
        end_page=translation_summary["end_page"],
    )
    if render_visual_prewarm_handle is not None:
        render_visual_prewarm_handle.wait()
    effective_prewarm_render_mode = resolve_effective_render_mode(
        render_mode=render_mode,
        source_pdf_path=source_pdf_path,
        start_page=translation_summary["start_page"],
        end_page=translation_summary["end_page"],
        translated_pages_map=translation_summary["translated_pages_map"],
        document_analysis=render_document_analysis,
    )
    render_preprocess_handle = start_render_source_prewarm(
        RenderPrewarmSpec(
            source_pdf_path=source_pdf_path,
            output_pdf_path=output_pdf_path,
            artifacts_dir=output_dir.parent / ARTIFACTS_DIR_NAME,
            translated_pages=translation_summary["translated_pages_map"],
            render_mode=render_mode,
            start_page=translation_summary["start_page"],
            end_page=translation_summary["end_page"],
            pdf_compress_dpi=pdf_compress_dpi,
            source_cleanup_strategy=source_cleanup_strategy,
            document_analysis=render_document_analysis,
            include_source_cleanup=effective_prewarm_render_mode != "overlay",
        )
    )
    render_preprocess_handle.wait()
    render_preprocess_elapsed = time.perf_counter() - render_preprocess_started

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
        source_cleanup_strategy=source_cleanup_strategy,
        render_prewarm_manifest_path=render_prewarm_manifest_path,
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
        "render_preprocess_elapsed": render_preprocess_elapsed,
        "render_diagnostics": render_summary.get("render_diagnostics", {}),
        "total_elapsed": total_elapsed,
        "effective_render_mode": render_summary["effective_render_mode"],
        "translation_diagnostics_path": str(diagnostics_path) if diagnostics_summary else "",
        "translation_debug_index_path": str(debug_index_path),
        "translation_provider_family": diagnostics_summary.get("provider_family", ""),
        "translation_peak_inflight_requests": diagnostics_summary.get("concurrency_observed", {}).get(
            "peak_inflight_all_llm_requests",
            0,
        ),
        "translation_timeout_attempts": diagnostics_summary.get("request_counts", {}).get("timeout_attempts", 0),
        "translation_retrying_items": diagnostics_summary.get("retry_summary", {}).get("retrying_request_labels", 0),
        "invocation": translation_summary.get("invocation", invocation or {}),
    }


def _try_build_render_document_analysis(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    start_page: int,
    end_page: int,
):
    try:
        return build_render_document_analysis(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            start_page=start_page,
            end_page=end_page,
        )
    except Exception as exc:
        print(f"render document analysis: skipped {type(exc).__name__}: {exc}", flush=True)
        return None
