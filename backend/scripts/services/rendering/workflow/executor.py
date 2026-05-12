from __future__ import annotations

from pathlib import Path

from foundation.config import fonts
from foundation.config import runtime
from runtime.pipeline.render_plan import RenderPlan
from services.rendering.workflow.context import RenderExecutionContext
from services.rendering.workflow.modes import run_background_typst_render
from services.rendering.workflow.modes import run_dual_render
from services.rendering.workflow.modes import run_overlay_render
from services.rendering.workflow.modes import run_selected_pages_overlay_render
from services.rendering.source.render_source import build_render_source_pdf


def execute_render_plan(
    *,
    render_plan: RenderPlan,
    output_pdf_path: Path,
    start_page: int,
    end_page: int,
    compile_workers: int | None = None,
    extract_selected_pages: bool = False,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    typst_font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    pdf_compress_dpi: int = runtime.DEFAULT_PDF_COMPRESS_DPI,
) -> int:
    start = max(0, start_page)
    stop = max(render_plan.selected_pages) if end_page < 0 else end_page
    render_source_pdf = build_render_source_pdf(
        source_pdf_path=render_plan.render_inputs.source_pdf_path,
        output_pdf_path=output_pdf_path,
        pdf_compress_dpi=pdf_compress_dpi,
        start_page=start,
        end_page=stop,
    )

    context = RenderExecutionContext(
        output_pdf_path=output_pdf_path,
        start_page=start,
        end_page=stop,
        compile_workers=compile_workers,
        api_key=api_key,
        model=model,
        base_url=base_url,
        typst_font_family=typst_font_family,
        pdf_compress_dpi=pdf_compress_dpi,
    )
    render_diagnostics: dict[str, object] = {}
    try:
        pages_rendered, render_diagnostics = _dispatch_render_mode(
            mode=render_plan.effective_render_mode,
            source_pdf_path=render_source_pdf.path,
            translated_pages=render_plan.selected_pages,
            context=context,
            extract_selected_pages=extract_selected_pages,
        )
        return pages_rendered
    finally:
        execute_render_plan.last_render_diagnostics = render_diagnostics
        for temp_source_path in render_source_pdf.temp_paths:
            temp_source_path.unlink(missing_ok=True)


def _dispatch_render_mode(
    *,
    mode: str,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    context: RenderExecutionContext,
    extract_selected_pages: bool,
) -> tuple[int, dict[str, object]]:
    if mode == "dual":
        return run_dual_render(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            context=context,
        )

    if extract_selected_pages:
        return run_selected_pages_overlay_render(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            context=context,
        )

    if mode == "overlay":
        return run_overlay_render(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            context=context,
        )

    if mode in {"typst", "typst_visual"}:
        return run_background_typst_render(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            context=context,
            visual_only_background=mode == "typst_visual",
        )

    return run_overlay_render(
        source_pdf_path=source_pdf_path,
        translated_pages=translated_pages,
        context=context,
    )
