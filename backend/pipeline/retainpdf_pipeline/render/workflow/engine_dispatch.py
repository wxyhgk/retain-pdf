"""按 render.engine 分流：typst（现有路线，默认）或 rpr（自研排版引擎）。

rpr 只是可选路线，任何一种用不了 / 跑失败都回退 Typst，任务不失败：

- 渲染模式不支持：dual（双栏对照）、只抽选中页的 overlay；
- 字体不是思源宋体（引擎的字宽表只有 Source Han Serif 常规 / 粗体；Noto Serif CJK SC 字形
  相同，一并放行）；
- 环境：引擎没装、缺 mathjax-full、找不到 node、node < 22.8、找不到 typst；
- 引擎或合并失败。

回退原因写进 render_diagnostics（→ pipeline_summary.render_diagnostics）、pipeline_summary
顶层的 render_engine，以及 fit_report.v1.json 的 reason。
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Callable

from retainpdf_pipeline.foundation.shared.stage_specs import RENDER_ENGINE_RPR
from retainpdf_pipeline.foundation.shared.stage_specs import RENDER_ENGINE_TYPST
from retainpdf_pipeline.foundation.shared.stage_specs import normalize_render_engine
from retainpdf_pipeline.render.output.rpr.engine_cli import RprEngineFailed
from retainpdf_pipeline.render.output.rpr.engine_cli import RprEngineUnavailable
from retainpdf_pipeline.render.output.rpr.engine_cli import resolve_engine_runtime
from retainpdf_pipeline.render.output.rpr.renderer import RPR_SUPPORTED_MODES
from retainpdf_pipeline.render.output.rpr.renderer import build_book_rpr_pdf
from retainpdf_pipeline.render.output.typst.fit_report import note_fit_report_reason
from retainpdf_pipeline.render.workflow.context import RenderExecutionContext

RPR_SUPPORTED_FONT_FAMILIES = frozenset({"source han serif sc", "noto serif cjk sc"})
# 引擎只认这一个族名（字宽表与 retain-pdf 自带的字体文件都是它）；Noto Serif CJK SC 字形相同，
# 一律按它排、按它画。
RPR_ENGINE_FONT_FAMILY = "Source Han Serif SC"

TypstDispatch = Callable[[], tuple[int, dict[str, object]]]
CompressFinal = Callable[[RenderExecutionContext, str], bool]


def _precheck(*, mode: str, context: RenderExecutionContext, extract_selected_pages: bool) -> tuple[str, str]:
    if extract_selected_pages:
        return "selected_pages_unsupported", "只抽选中页的渲染暂不支持 rpr 引擎"
    if mode == "dual":
        return "dual_unsupported", "双栏对照（dual）暂不支持 rpr 引擎"
    if mode not in RPR_SUPPORTED_MODES:
        return "mode_unsupported", f"渲染模式 {mode!r} 暂不支持 rpr 引擎"
    family = str(context.typst_font_family or "").strip()
    if family.lower() not in RPR_SUPPORTED_FONT_FAMILIES:
        return "font_unsupported", f"字体 {family!r} 不是思源宋体，rpr 引擎没有它的字宽表"
    return "", ""


def dispatch_with_render_engine(
    *,
    mode: str,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    context: RenderExecutionContext,
    extract_selected_pages: bool,
    typst_dispatch: TypstDispatch,
    compress_final: CompressFinal,
    fast_save: bool,
) -> tuple[int, dict[str, object]]:
    requested = normalize_render_engine(context.render_engine)
    if requested != RENDER_ENGINE_RPR:
        return typst_dispatch()
    started = time.perf_counter()
    code, message = _precheck(mode=mode, context=context, extract_selected_pages=extract_selected_pages)
    if not code:
        try:
            runtime = resolve_engine_runtime()
            diagnostics = build_book_rpr_pdf(
                mode=mode,
                runtime=runtime,
                source_pdf_path=source_pdf_path,
                output_pdf_path=context.output_pdf_path,
                translated_pages=translated_pages,
                font_family=RPR_ENGINE_FONT_FAMILY,
                document_path=context.document_path,
                indent_detection_pdf_path=context.indent_detection_pdf_path or source_pdf_path,
                first_line_indent_lookup=context.first_line_indent_lookup,
                effective_inner_bbox_lookup=context.effective_inner_bbox_lookup,
                source_text_precleaned_page_indices=context.source_text_precleaned_page_indices,
                prebuilt_page_specs=context.background_render_page_specs,
                precomputed_colors_by_item_id=context.render_colors_by_item_id,
                visual_profile_path=context.visual_profile_path,
                prepared_overlay_pages=context.prepared_overlay_pages,
                visual_cover_page_indices=context.visual_cover_page_indices,
                fast_save=fast_save,
            )
            diagnostics["final_image_compressed"] = compress_final(context, f"rpr_{mode}")
            diagnostics.update(
                {
                    "render_engine_requested": RENDER_ENGINE_RPR,
                    "render_engine": RENDER_ENGINE_RPR,
                    "render_engine_elapsed_seconds": round(time.perf_counter() - started, 3),
                }
            )
            print(
                f"rpr engine render done: mode={mode} pages={diagnostics.get('rpr_pages')} "
                f"version={diagnostics.get('rpr_engine_version')} "
                f"elapsed={time.perf_counter() - started:.2f}s",
                flush=True,
            )
            return len(translated_pages), diagnostics
        except (RprEngineUnavailable, RprEngineFailed) as exc:
            code, message = exc.code, str(exc)
        except Exception as exc:  # noqa: BLE001 - rpr 是可选路线，任何失败都回退 Typst
            code, message = "rpr_render_error", f"{type(exc).__name__}: {exc}"
    warning = f"rpr 引擎未使用，已回退 Typst（{code}）：{message}"
    print(warning, flush=True)
    note_fit_report_reason(f"rpr_fallback:{code}")
    rpr_elapsed = time.perf_counter() - started
    pages, diagnostics = typst_dispatch()
    diagnostics = dict(diagnostics)
    diagnostics.update(
        {
            "render_engine_requested": RENDER_ENGINE_RPR,
            "render_engine": RENDER_ENGINE_TYPST,
            "render_engine_fallback_reason": code,
            "render_engine_fallback_message": message[:1000],
            "render_engine_warnings": [warning[:1000]],
            "render_engine_rpr_attempt_elapsed_seconds": round(rpr_elapsed, 3),
        }
    )
    return pages, diagnostics


def render_engine_summary(*, requested: str, diagnostics: dict) -> dict[str, object]:
    """pipeline_summary 顶层的 render_engine：请求的引擎、实际用的引擎、版本、耗时、回退原因。"""
    requested_engine = normalize_render_engine(requested)
    effective = str(diagnostics.get("render_engine") or RENDER_ENGINE_TYPST)
    summary: dict[str, object] = {
        "requested": requested_engine,
        "effective": effective,
    }
    if effective == RENDER_ENGINE_RPR:
        summary.update(
            {
                "version": diagnostics.get("rpr_engine_version", ""),
                "commit": diagnostics.get("rpr_engine_commit", ""),
                "node_version": diagnostics.get("rpr_node_version", ""),
                "elapsed_seconds": diagnostics.get("render_engine_elapsed_seconds"),
                "engine_elapsed_seconds": diagnostics.get("rpr_engine_elapsed_seconds"),
                "timings": diagnostics.get("rpr_engine_timings", {}),
                "input_stats": diagnostics.get("rpr_input_stats", {}),
            }
        )
    if diagnostics.get("render_engine_fallback_reason"):
        summary["fallback_reason"] = diagnostics.get("render_engine_fallback_reason")
        summary["fallback_message"] = diagnostics.get("render_engine_fallback_message", "")
        summary["warnings"] = list(diagnostics.get("render_engine_warnings") or [])
    return summary


__all__ = [
    "RPR_SUPPORTED_FONT_FAMILIES",
    "dispatch_with_render_engine",
    "render_engine_summary",
]
