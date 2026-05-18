from __future__ import annotations

from pathlib import Path

from foundation.config import fonts
from foundation.config import runtime
from runtime.pipeline.render_plan import build_render_plan
from runtime.pipeline.render_execution import execute_render_plan
from services.pipeline_shared.events import emit_stage_progress
from services.pipeline_shared.events import emit_stage_transition
from services.rendering.source.prewarm import prewarm_manifest_path_from_translations_dir
from services.rendering.workflow import render_translated_pages_map


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
    prewarm_manifest_path = render_prewarm_manifest_path or prewarm_manifest_path_from_translations_dir(
        render_plan.render_inputs.translations_dir
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
) -> dict:
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
    emit_stage_transition(
        stage="rendering",
        message="开始渲染翻译 PDF",
        progress_current=0,
        progress_total=render_plan.render_total,
        payload={"effective_render_mode": render_plan.effective_render_mode},
    )
    prewarm_manifest_path = render_prewarm_manifest_path or prewarm_manifest_path_from_translations_dir(
        render_plan.render_inputs.translations_dir
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
    }
