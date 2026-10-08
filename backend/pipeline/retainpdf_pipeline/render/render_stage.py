from __future__ import annotations

import os
from pathlib import Path

from retainpdf_pipeline.foundation.config import fonts
from retainpdf_pipeline.foundation.config import runtime
from retainpdf_pipeline.render.render_plan import build_render_plan
from retainpdf_pipeline.render.render_execution import execute_render_plan
from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_progress
from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_transition
from retainpdf_pipeline.services.pipeline_shared.events import reset_render_page_progress
from retainpdf_pipeline.render.source.prewarm import prewarm_manifest_path_from_translations_dir
from retainpdf_pipeline.render.workflow.fit_report import fit_report_result
from retainpdf_pipeline.render.workflow.fit_report import render_fit_report_scope
from retainpdf_pipeline.render.workflow.engine_dispatch import render_engine_summary


def render_no_cache_enabled() -> bool:
    return str(os.environ.get("RETAINPDF_RENDER_NO_CACHE") or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def build_book_from_translations(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    translations_dir: Path | None = None,
    translation_manifest_path: Path | None = None,
    start_page: int = 0,
    end_page: int = -1,
    compile_workers: int | None = None,
    extract_selected_pages: bool = False,
    render_mode: str = "typst",
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    typst_font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    pdf_compress_dpi: int = runtime.DEFAULT_PDF_COMPRESS_DPI,
    source_cleanup_strategy: str | None = None,
    render_prewarm_manifest_path: Path | None = None,
    render_engine: str = "typst",
) -> int:
    render_plan = build_render_plan(
        source_pdf_path=source_pdf_path,
        output_pdf_path=output_pdf_path,
        translations_dir=translations_dir,
        translation_manifest_path=translation_manifest_path,
        start_page=start_page,
        end_page=end_page,
        render_mode=render_mode,
    )
    prewarm_manifest_path = (
        None
        if render_no_cache_enabled()
        else render_prewarm_manifest_path or prewarm_manifest_path_from_translations_dir(
            render_plan.render_inputs.translations_dir
        )
    )
    pages_rendered = execute_render_plan(
        render_plan=render_plan,
        output_pdf_path=output_pdf_path,
        start_page=start_page,
        end_page=end_page,
        compile_workers=compile_workers,
        extract_selected_pages=extract_selected_pages,
        api_key=api_key,
        model=model,
        base_url=base_url,
        typst_font_family=typst_font_family,
        pdf_compress_dpi=pdf_compress_dpi,
        source_cleanup_strategy=source_cleanup_strategy,
        render_prewarm_manifest_path=prewarm_manifest_path,
        render_engine=render_engine,
    )
    build_book_from_translations.last_render_diagnostics = dict(
        getattr(execute_render_plan, "last_render_diagnostics", {}) or {}
    )
    return pages_rendered


def build_book_pipeline(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    translations_dir: Path | None = None,
    translation_manifest_path: Path | None = None,
    start_page: int = 0,
    end_page: int = -1,
    compile_workers: int | None = None,
    extract_selected_pages: bool = False,
    render_mode: str = "typst",
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    typst_font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    pdf_compress_dpi: int = runtime.DEFAULT_PDF_COMPRESS_DPI,
    source_cleanup_strategy: str | None = None,
    render_prewarm_manifest_path: Path | None = None,
    render_engine: str = "typst",
) -> dict:
    pages_rendered = build_book_from_translations(
        source_pdf_path=source_pdf_path,
        output_pdf_path=output_pdf_path,
        translations_dir=translations_dir,
        translation_manifest_path=translation_manifest_path,
        start_page=start_page,
        end_page=end_page,
        compile_workers=compile_workers,
        extract_selected_pages=extract_selected_pages,
        render_mode=render_mode,
        api_key=api_key,
        model=model,
        base_url=base_url,
        typst_font_family=typst_font_family,
        pdf_compress_dpi=pdf_compress_dpi,
        source_cleanup_strategy=source_cleanup_strategy,
        render_prewarm_manifest_path=render_prewarm_manifest_path,
        render_engine=render_engine,
    )
    return {
        "output_pdf_path": output_pdf_path,
        "pages_rendered": pages_rendered,
        "extract_selected_pages": extract_selected_pages,
        "render_diagnostics": dict(getattr(build_book_from_translations, "last_render_diagnostics", {}) or {}),
    }


def run_render_stage(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    translations_dir: Path | None = None,
    translation_manifest_path: Path | None = None,
    start_page: int,
    end_page: int,
    render_mode: str,
    translated_pages_map: dict[int, list[dict]] | None = None,
    compile_workers: int | None = None,
    extract_selected_pages: bool = False,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    typst_font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    pdf_compress_dpi: int = runtime.DEFAULT_PDF_COMPRESS_DPI,
    source_cleanup_strategy: str | None = None,
    render_prewarm_manifest_path: Path | None = None,
    artifacts_dir: Path | None = None,
    render_engine: str = "typst",
) -> dict:
    """artifacts_dir 给了就在其中写排版 fit 报告（fit_report.v1.json）；报告只读不改排版。"""
    render_plan = build_render_plan(
        source_pdf_path=source_pdf_path,
        output_pdf_path=output_pdf_path,
        translations_dir=translations_dir,
        translation_manifest_path=translation_manifest_path,
        start_page=start_page,
        end_page=end_page,
        render_mode=render_mode,
        translated_pages_map=translated_pages_map,
    )
    reset_render_page_progress()
    emit_stage_transition(
        stage="rendering",
        message="开始渲染翻译 PDF",
        # No page counters here: the API prefers the latest render page
        # progress, so a 0/N page event would pin the UI at 0% during the
        # render_prepare steps that follow.
        payload={
            "effective_render_mode": render_plan.effective_render_mode,
            "render_total": render_plan.render_total,
        },
    )
    prewarm_manifest_path = (
        None
        if render_no_cache_enabled()
        else render_prewarm_manifest_path or prewarm_manifest_path_from_translations_dir(
            render_plan.render_inputs.translations_dir
        )
    )
    with render_fit_report_scope(artifacts_dir) as fit_report_target:
        pages_rendered = execute_render_plan(
            render_plan=render_plan,
            output_pdf_path=output_pdf_path,
            start_page=start_page,
            end_page=end_page,
            compile_workers=compile_workers,
            extract_selected_pages=extract_selected_pages,
            api_key=api_key,
            model=model,
            base_url=base_url,
            typst_font_family=typst_font_family,
            pdf_compress_dpi=pdf_compress_dpi,
            source_cleanup_strategy=source_cleanup_strategy,
            render_prewarm_manifest_path=prewarm_manifest_path,
            render_engine=render_engine,
        )
    emit_stage_progress(
        stage="rendering",
        message="渲染页面完成",
        progress_current=pages_rendered,
        progress_total=render_plan.render_total or pages_rendered,
        payload={"effective_render_mode": render_plan.effective_render_mode},
    )
    return {
        "output_pdf_path": output_pdf_path,
        "pages_rendered": pages_rendered,
        "effective_render_mode": render_plan.effective_render_mode,
        "extract_selected_pages": extract_selected_pages,
        "render_diagnostics": dict(getattr(execute_render_plan, "last_render_diagnostics", {}) or {}),
        "fit_report": fit_report_result(fit_report_target),
        "render_engine": render_engine_summary(
            requested=render_engine,
            diagnostics=getattr(execute_render_plan, "last_render_diagnostics", {}) or {},
        ),
    }
