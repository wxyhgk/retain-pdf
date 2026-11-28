from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from retainpdf_pipeline.foundation.config import layout

from retainpdf_pipeline.render.layout.title_source_size import annotate_title_source_font_sizes
from retainpdf_pipeline.render.layout.payload.toc_page_labels import hold_toc_page_labels_of_untranslated_entries
from retainpdf_pipeline.render.render_inputs import RenderInputs
from retainpdf_pipeline.render.render_mode import resolve_effective_render_mode
from retainpdf_pipeline.render.translation_loader import load_translated_pages
from retainpdf_pipeline.render.translation_loader import select_translated_pages


@dataclass(frozen=True)
class RenderPlan:
    render_inputs: RenderInputs
    selected_pages: dict[int, list[dict]]
    effective_render_mode: str
    # 目录原位替换的计划（toc_mode = replace 时；render/output/toc_replace）。正文排完由 executor 照它换字
    toc_replace: object | None = None
    toc_replace_error: str = ""

    @property
    def render_total(self) -> int:
        return len(self.selected_pages)


def plan_pages(
    *,
    source_pdf_path: Path,
    pages: dict[int, list[dict]],
    mode_probe_pages: dict[int, list[dict]] | None,
    start_page: int,
    end_page: int,
    render_mode: str,
) -> tuple[dict[int, list[dict]], str]:
    """要渲染的页与实际渲染模式。渲染阶段与提前做的渲染准备（翻译前的条目）共用这一份推导。"""
    effective_render_mode = resolve_effective_render_mode(
        render_mode=render_mode,
        source_pdf_path=source_pdf_path,
        start_page=start_page,
        end_page=end_page,
        translated_pages_map=mode_probe_pages,
    )
    selected_pages = select_translated_pages(
        pages,
        start_page=max(0, start_page),
        end_page=max(pages) if end_page < 0 else end_page,
    )
    return selected_pages, effective_render_mode


def build_render_plan(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    translations_dir: Path | None = None,
    translation_manifest_path: Path | None = None,
    start_page: int,
    end_page: int,
    render_mode: str,
    translated_pages_map: dict[int, list[dict]] | None = None,
    document_path: Path | None = None,
) -> RenderPlan:
    from retainpdf_pipeline.render.render_inputs import resolve_render_inputs

    render_inputs = resolve_render_inputs(
        source_pdf_path=source_pdf_path,
        translations_dir=translations_dir,
        translation_manifest_path=translation_manifest_path,
        document_path=document_path,
    )
    auto_pages_map = translated_pages_map
    if render_mode == "auto" and auto_pages_map is None:
        auto_pages_map = load_translated_pages(
            render_inputs.translations_dir,
            manifest_path=render_inputs.translation_manifest_path,
        )
    pages = (
        auto_pages_map
        if auto_pages_map is not None
        else load_translated_pages(
            render_inputs.translations_dir,
            manifest_path=render_inputs.translation_manifest_path,
        )
    )
    selected_pages, effective_render_mode = plan_pages(
        source_pdf_path=render_inputs.source_pdf_path,
        pages=pages,
        mode_probe_pages=auto_pages_map,
        start_page=start_page,
        end_page=end_page,
        render_mode=render_mode,
    )
    # 目录原位替换（toc_mode = replace）：定好的页，目录条目和页码小块在正文排版里当保留原文，排完再换字
    toc_replace, toc_replace_error = _plan_toc_replace(render_inputs, selected_pages)
    if toc_replace is not None:
        selected_pages = toc_replace.hold(selected_pages)
    # 目录条目没有译文要排的，它的页码小块也不擦不画（同一条绘字指令，擦页码会把标题擦掉）
    selected_pages = hold_toc_page_labels_of_untranslated_entries(selected_pages)
    # 标题按原文字号排（Typst 路线和 rpr_fit 引擎同一个值），读原 PDF 的文字层，读不到按框反推
    title_stats = annotate_title_source_font_sizes(selected_pages, render_inputs.source_pdf_path)
    if any(title_stats.values()):
        print(f"title source font sizes: {title_stats}", flush=True)
    return RenderPlan(
        render_inputs=render_inputs,
        selected_pages=selected_pages,
        effective_render_mode=effective_render_mode,
        toc_replace=toc_replace,
        toc_replace_error=toc_replace_error,
    )


def _plan_toc_replace(render_inputs: RenderInputs, selected_pages: dict[int, list[dict]]):
    """toc_mode = replace 时定目录原位替换的计划；定不了（出错）整本照旧重排，只记一笔。"""
    if layout.TOC_MODE != layout.TOC_MODE_REPLACE:
        return None, ""
    from retainpdf_pipeline.render.output.toc_replace import plan_toc_replace
    from retainpdf_pipeline.render.output.toc_replace import resolve_font_file
    from retainpdf_pipeline.render.output.typst.compiler import _resolved_font_paths
    from retainpdf_pipeline.render.workflow.prepare_stage import document_path_for_render

    try:
        plan = plan_toc_replace(
            selected_pages,
            source_pdf_path=render_inputs.source_pdf_path,
            document_path=document_path_for_render(render_inputs.translations_dir, explicit=render_inputs.document_path),
            font_path=resolve_font_file(_resolved_font_paths()),
        )
    except Exception as exc:  # noqa: BLE001 - 原位替换是可选的，定不了就照旧重排
        print(f"toc replace plan failed: {type(exc).__name__}: {exc}", flush=True)
        return None, f"{type(exc).__name__}: {exc}"[:500]
    print(f"toc replace plan: {plan.diagnostics()['entries']} reflow_pages={sorted(plan.reflow_pages)}", flush=True)
    return plan, ""
