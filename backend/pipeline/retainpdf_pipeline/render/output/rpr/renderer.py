"""rpr 引擎渲染路线：page_specs → 引擎 → 透明叠加层 → 合并到底图。

和 Typst 背景路线共用准备链（``prepare_background_render_pages``：译文准备 → 取色 →
公式预筛 → ``build_render_page_specs``，typst / typst_visual 再加整页清理），所以字号、
行距、颜色、底图都与 Typst 路线同源，差别只在排版与公式渲染：

- typst / typst_visual：底图是 ``build_clean_background_pdf`` 的产物（扫描件用 visual_cover），
  按 page_specs 的页序抽页后逐页叠上引擎的叠加层；
- overlay：底图是去文字层的 source（不再清理），在原页上叠加，其余页原样保留。

之后与 Typst 路线相同：``save_background_pdf_to_output`` 复制目录（TOC），由调用方做最终的
图片压缩。这里的任何失败都向上抛，由 workflow 层回退 Typst 路线。
"""

from __future__ import annotations

import json
import shutil
import time
from dataclasses import replace
from pathlib import Path

import fitz

from retainpdf_pipeline.render.document.pikepdf_overlay import overlay_pdf_pages_with_pikepdf
from retainpdf_pipeline.render.document.pikepdf_pages import extract_page_indices_with_pikepdf
from retainpdf_pipeline.render.layout.model.models import RenderPageSpec
from retainpdf_pipeline.render.output.rpr.engine_cli import RprEngineFailed
from retainpdf_pipeline.render.output.rpr.engine_cli import RprEngineRuntime
from retainpdf_pipeline.render.output.rpr.engine_cli import run_engine
from retainpdf_pipeline.render.layout.payload.blocks import build_render_blocks
from retainpdf_pipeline.render.output.rpr.input_builder import RprPage
from retainpdf_pipeline.render.output.rpr.input_builder import build_rpr_input
from retainpdf_pipeline.render.output.rpr.obstacles import build_obstacles
from retainpdf_pipeline.render.output.rpr.report import build_rpr_fit_report_payload
from retainpdf_pipeline.render.output.typst.book_renderer import prepare_background_render_pages
from retainpdf_pipeline.render.output.typst.book_support import prepare_background_work_dir
from retainpdf_pipeline.render.output.typst.book_support import save_background_pdf_to_output
from retainpdf_pipeline.render.output.typst.overlay_prepare import prepare_overlay_pages
from retainpdf_pipeline.render.output.typst.fit_report import record_fit_report_payload
from retainpdf_pipeline.services.pipeline_shared.events import emit_render_compile_progress

RPR_BACKGROUND_MODES = frozenset({"typst", "typst_visual"})
RPR_SUPPORTED_MODES = RPR_BACKGROUND_MODES | {"overlay"}


def _overlay_page_count(path: Path) -> int:
    import pikepdf

    with pikepdf.Pdf.open(path) as pdf:
        return len(pdf.pages)


def _reset_dir(path: Path) -> Path:
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _overlay_render_pages(
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    *,
    indent_detection_pdf_path: Path | None,
    first_line_indent_lookup: dict[str, float] | None,
    effective_inner_bbox_lookup: dict[str, list[float]] | None,
    source_text_precleaned_page_indices: frozenset[int],
    prepared_overlay_pages: dict[int, list[dict]] | None,
    precomputed_colors_by_item_id: dict[str, dict[str, tuple[float, float, float]]] | None,
    visual_profile_path: Path | None,
    visual_cover_page_indices: frozenset[int],
) -> tuple[list[RprPage], dict[int, list[dict]]]:
    """overlay 路线的页与块：参数与 build_book_typst_pdf 传给 overlay_translated_pages_on_doc 的一致。"""
    doc = fitz.open(source_pdf_path)
    try:
        prepared = prepare_overlay_pages(
            doc,
            translated_pages,
            stem="book-overlay",
            source_pdf_path=indent_detection_pdf_path or source_pdf_path,
            first_line_indent_lookup=first_line_indent_lookup,
            effective_inner_bbox_lookup=effective_inner_bbox_lookup,
            source_text_precleaned_page_indices=source_text_precleaned_page_indices,
            color_sample_pdf_path=indent_detection_pdf_path or source_pdf_path,
            prepared_overlay_pages=prepared_overlay_pages,
            precomputed_colors_by_item_id=precomputed_colors_by_item_id,
            visual_profile_path=visual_profile_path,
            visual_cover_page_indices=visual_cover_page_indices,
        )
    finally:
        doc.close()
    pages: list[RprPage] = []
    for page_idx, page_width, page_height, items, _stem in prepared.page_specs:
        blocks = build_render_blocks(items, page_width=page_width, page_height=page_height)
        # overlay 的块名是 item-<序号>；换成 item-<item_id>（与 page_specs 同一套命名），
        # 报告、障碍物和排查才对得上译文条目。
        pages.append(
            RprPage(
                page_index=int(page_idx),
                page_width_pt=float(page_width),
                page_height_pt=float(page_height),
                blocks=[
                    replace(block, block_id=f"item-{block.source_item_id}") if block.source_item_id else block
                    for block in blocks
                ],
            )
        )
    return pages, prepared.translated_pages


def build_book_rpr_pdf(
    *,
    mode: str,
    runtime: RprEngineRuntime,
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    font_family: str,
    document_path: Path | None = None,
    indent_detection_pdf_path: Path | None = None,
    first_line_indent_lookup: dict[str, float] | None = None,
    effective_inner_bbox_lookup: dict[str, list[float]] | None = None,
    source_text_precleaned_page_indices: frozenset[int] = frozenset(),
    prebuilt_page_specs: list[RenderPageSpec] | None = None,
    precomputed_colors_by_item_id: dict[str, dict[str, tuple[float, float, float]]] | None = None,
    visual_profile_path: Path | None = None,
    prepared_overlay_pages: dict[int, list[dict]] | None = None,
    visual_cover_page_indices: frozenset[int] = frozenset(),
    fast_save: bool = False,
) -> dict[str, object]:
    if mode not in RPR_SUPPORTED_MODES:
        raise RprEngineFailed("mode_unsupported", f"rpr 引擎不支持渲染模式 {mode!r}")
    background_mode = mode in RPR_BACKGROUND_MODES
    diagnostics: dict[str, object] = {"mode": mode}
    total_started = time.perf_counter()
    if background_mode:
        prepared = prepare_background_render_pages(
            source_pdf_path,
            output_pdf_path,
            translated_pages,
            diagnostics=diagnostics,
            redaction_strategy="visual_cover" if mode == "typst_visual" else None,
            indent_detection_pdf_path=indent_detection_pdf_path,
            first_line_indent_lookup=first_line_indent_lookup,
            effective_inner_bbox_lookup=effective_inner_bbox_lookup,
            source_text_precleaned_page_indices=source_text_precleaned_page_indices,
            prebuilt_page_specs=prebuilt_page_specs,
            precomputed_colors_by_item_id=precomputed_colors_by_item_id,
            visual_profile_path=visual_profile_path,
            build_cleaned_background=True,
        )
        page_specs = prepared.page_specs
        render_translated_pages = prepared.translated_pages
        base_pdf = prepared.cleaned_background_pdf
        work_dir = prepared.work_dir
        page_map = prepared.page_map
        box_mode = "box"
    else:
        # overlay：与 Typst overlay 路线同一份准备（prepare_overlay_pages）和同一套逐页块
        # （build_render_blocks），缩字用 overlay 路线的规则（box_overlay：可低于下限进应急档）。
        page_specs, render_translated_pages = _overlay_render_pages(
            source_pdf_path,
            translated_pages,
            indent_detection_pdf_path=indent_detection_pdf_path,
            first_line_indent_lookup=first_line_indent_lookup,
            effective_inner_bbox_lookup=effective_inner_bbox_lookup,
            source_text_precleaned_page_indices=source_text_precleaned_page_indices,
            prepared_overlay_pages=prepared_overlay_pages,
            precomputed_colors_by_item_id=precomputed_colors_by_item_id,
            visual_profile_path=visual_profile_path,
            visual_cover_page_indices=visual_cover_page_indices,
        )
        base_pdf = source_pdf_path
        work_dir = prepare_background_work_dir(output_pdf_path, None)
        page_map = None
        box_mode = "box_overlay"
    if not page_specs:
        raise RprEngineFailed("no_pages", "没有可渲染的页面")

    obstacles_by_page, obstacles_source = build_obstacles(
        document_path=document_path,
        translated_pages=render_translated_pages,
        page_specs=page_specs,
    )
    built = build_rpr_input(
        page_specs,
        font_family=font_family,
        # Typst 两条路线都画底色（背景路线 include_fill=True，overlay 路线 include_cover_rect）
        include_fill=True,
        obstacles_by_page=obstacles_by_page,
        box_mode=box_mode,
    )
    engine_dir = _reset_dir(work_dir.parent / "rpr-engine")
    input_path = engine_dir / "rpr-input.json"
    input_path.write_text(json.dumps(built.payload, ensure_ascii=False), encoding="utf-8")

    emit_render_compile_progress(
        current=1,
        total=3,
        message=f"正在用 rpr 引擎排版，共 {len(page_specs)} 页",
        payload={"render_stage": "rpr_engine_start", "render_engine": "rpr"},
    )
    run = run_engine(runtime, input_path=input_path, out_dir=engine_dir / "out")
    overlay_pages = _overlay_page_count(run.overlay_pdf)
    if overlay_pages != len(page_specs):
        raise RprEngineFailed(
            "engine_output_invalid",
            f"rpr 叠加层页数 {overlay_pages} 与输入页数 {len(page_specs)} 不一致",
        )
    emit_render_compile_progress(
        current=2,
        total=3,
        message="rpr 引擎排版完成，正在合并到底图",
        payload={"render_stage": "rpr_engine_done", "render_engine": "rpr"},
    )

    merge_started = time.perf_counter()
    merged_pdf = engine_dir / "rpr-merged.pdf"
    page_indices = [spec.page_index for spec in page_specs]
    if background_mode:
        base_subset = engine_dir / "rpr-base.pdf"
        extract_page_indices_with_pikepdf(
            source_pdf_path=base_pdf,
            output_pdf_path=base_subset,
            page_indices=page_indices,
        )
        merge = overlay_pdf_pages_with_pikepdf(
            source_pdf_path=base_subset,
            overlay_pdf_path=run.overlay_pdf,
            output_pdf_path=merged_pdf,
            source_page_indices=list(range(len(page_specs))),
        )
    else:
        # overlay：和旧 overlay 路线一样，pikepdf 合并结果直接就是成品（底图就是去文字层的
        # 原件，目录随原件保留）。不再经 PyMuPDF 重存：默认的快速保存不写对象流，会把
        # 合并后的文件撑大约 20%（fe8d63：8.1MB → 9.8MB）。
        merged_pdf = output_pdf_path
        merge = overlay_pdf_pages_with_pikepdf(
            source_pdf_path=base_pdf,
            overlay_pdf_path=run.overlay_pdf,
            output_pdf_path=merged_pdf,
            source_page_indices=page_indices,
        )
    if merge.pages_merged != len(page_specs):
        raise RprEngineFailed(
            "merge_incomplete",
            f"只合并了 {merge.pages_merged}/{len(page_specs)} 页",
        )
    diagnostics["rpr_merge_elapsed_seconds"] = time.perf_counter() - merge_started

    save_started = time.perf_counter()
    if background_mode:
        save_background_pdf_to_output(
            merged_pdf,
            output_pdf_path,
            source_pdf_path=source_pdf_path,
            page_map=page_map,
            fast_save=fast_save,
        )
    diagnostics["background_save_elapsed_seconds"] = time.perf_counter() - save_started
    emit_render_compile_progress(
        current=3,
        total=3,
        message="rpr 引擎渲染完成",
        payload={"render_stage": "rpr_engine_saved", "render_engine": "rpr"},
    )

    engine_info = dict(run.report.get("engine") or {})
    engine_version = str(engine_info.get("version") or runtime.engine_version or "")
    fit_payload = build_rpr_fit_report_payload(
        built,
        run.report,
        page_specs=page_specs,
        render_path=f"rpr_{mode}",
        engine_elapsed_seconds=run.elapsed_seconds,
        engine_version=engine_version,
    )
    diagnostics.update(record_fit_report_payload(fit_payload, elapsed=run.elapsed_seconds))
    diagnostics.update(
        {
            "render_engine": "rpr",
            "rpr_engine_version": engine_version,
            "rpr_engine_commit": str(engine_info.get("commit") or ""),
            "rpr_node_version": runtime.node_version,
            "rpr_engine_elapsed_seconds": round(run.elapsed_seconds, 3),
            "rpr_engine_timings": dict(run.report.get("timings") or {}),
            "rpr_input_stats": built.stats.as_dict(),
            "rpr_obstacles_source": obstacles_source,
            "rpr_work_dir": str(engine_dir),
            "rpr_pages": len(page_specs),
            "rpr_fit_summary": {
                key: value
                for key, value in fit_payload.get("summary", {}).items()
                if not key.endswith("_item_ids")
            },
            "background_total_elapsed_seconds": time.perf_counter() - total_started,
        }
    )
    return diagnostics


__all__ = [
    "RPR_BACKGROUND_MODES",
    "RPR_SUPPORTED_MODES",
    "build_book_rpr_pdf",
]
