"""rpr_fit 引擎渲染路线：字号由引擎按测量决定，不走 retain-pdf 的 page_specs / Typst 缩字。

和 rpr 路线（retain-pdf 定字号与缩字许可，引擎只按它排）不同，这里把任务自己的数据交给
引擎（``bin/rpr-fit.js``，fit-model 的 retain 规则）：

- 输入：document.v1（OCR 框、行盒、块类型）、译文条目、visual_profile（底色 / 文字色）、
  原 PDF 的障碍物扫描（准备步骤 obstacle_scan 的产物，由 workflow 层传进来），以及要渲染的页；
- 引擎：按 retain-pdf 的种子估算与正文 / 标题 / 注释规则，用精确测量定字号（全书共享正文
  字号，排不下的段落单独封顶），带碰撞兜底：文字不压文字、不压保留元素（公式、图、表、
  未翻译文字）和矢量图形；
- 叠加层合并到底图：底图就是渲染源（去文字层 PDF；扫描件是原件，由引擎画的底色盖住原文）。
  overlay 模式在原件上叠加、其余页原样保留（与 overlay 路线一致）；typst / typst_visual 模式
  只输出要渲染的页（与 Typst 背景路线一致）。

任何失败都向上抛，由 workflow 层回退 Typst 路线。
"""

from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

from retainpdf_pipeline.render.document.pikepdf_overlay import overlay_pdf_pages_with_pikepdf
from retainpdf_pipeline.render.document.pikepdf_pages import extract_page_indices_with_pikepdf
from retainpdf_pipeline.render.layout.inline_content.mode_router import build_item_render_markdown
from retainpdf_pipeline.render.layout.payload.render_item import seed_render_fields
from retainpdf_pipeline.render.output.rpr.engine_cli import RprEngineFailed
from retainpdf_pipeline.render.output.rpr.engine_cli import RprEngineRuntime
from retainpdf_pipeline.render.output.rpr.engine_cli import run_engine
from retainpdf_pipeline.render.output.rpr.text import markdown_to_engine_text
from retainpdf_pipeline.render.output.rpr_fit.report import build_rpr_fit_fit_report_payload
from retainpdf_pipeline.render.output.typst.block_renderer import sanitize_typst_markdown_for_compile
from retainpdf_pipeline.render.output.typst.book_support import prepare_background_work_dir
from retainpdf_pipeline.render.output.typst.fit_report import record_fit_report_payload
from retainpdf_pipeline.services.pipeline_shared.events import emit_render_compile_progress

RPR_FIT_INPUT_SCHEMA = "rpr_fit_input_v1"
RPR_FIT_BACKGROUND_MODES = frozenset({"typst", "typst_visual"})
RPR_FIT_SUPPORTED_MODES = RPR_FIT_BACKGROUND_MODES | {"overlay"}
# 引擎要的译文条目字段（其余字段不传，输入文件小一些）
_ITEM_FIELDS = ("page_idx", "block_idx", "item_id", "policy_translate", "translated_text", "source_text", "lines")


def _pdf_page_count(path: Path) -> int:
    import pikepdf

    with pikepdf.Pdf.open(path) as pdf:
        return len(pdf.pages)


def _reset_dir(path: Path) -> Path:
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _engine_text(item: dict) -> str:
    """一条译文在 retain-pdf 里真正要排出来的文字，转成引擎的格式。

    与其它路线同一步：seed_render_fields（占位符还原、与原文相同则不排、行间公式跳过……）
    → build_item_render_markdown（HTML 上下标等标记、公式修复）→ 引擎文本（rpr 路线的
    markdown_to_engine_text）。直接用译文条目的 translated_text 会把 <sup>…</sup> 之类的
    标记原样印出来。没有可排的文字时返回空串：引擎把这一块当保留元素。
    """
    probe = dict(item)
    seed_render_fields(probe)
    render_text = str(probe.get("render_protected_text") or "")
    if not render_text.strip():
        return ""
    markdown = build_item_render_markdown(probe, render_text, list(probe.get("render_formula_map") or []))
    return markdown_to_engine_text(
        sanitize_typst_markdown_for_compile(markdown),
        preserve_line_breaks=bool(probe.get("preserve_line_breaks")),
    )


def _translation_items(translated_pages: dict[int, list[dict]]) -> list[dict]:
    items: list[dict] = []
    for page_idx in sorted(translated_pages):
        for item in translated_pages[page_idx] or []:
            if not isinstance(item, dict):
                continue
            entry = {key: item.get(key) for key in _ITEM_FIELDS}
            if entry.get("page_idx") is None:
                entry["page_idx"] = int(page_idx)
            entry["translated_text"] = _engine_text(item)
            entry["source_text"] = str(entry.get("source_text") or "")
            items.append(entry)
    return items


def build_book_rpr_fit_pdf(
    *,
    mode: str,
    runtime: RprEngineRuntime,
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    font_family: str,
    document_path: Path | None,
    visual_profile_path: Path | None = None,
    obstacle_scan: dict[str, dict] | None = None,
) -> dict[str, object]:
    if mode not in RPR_FIT_SUPPORTED_MODES:
        raise RprEngineFailed("mode_unsupported", f"rpr_fit 引擎不支持渲染模式 {mode!r}")
    if document_path is None or not Path(document_path).is_file():
        raise RprEngineFailed("document_missing", f"rpr_fit 需要 document.v1.json：{document_path}")
    background_mode = mode in RPR_FIT_BACKGROUND_MODES
    total_started = time.perf_counter()
    diagnostics: dict[str, object] = {"mode": mode}
    page_indices = sorted(int(page) for page, items in translated_pages.items() if items)
    if not page_indices:
        raise RprEngineFailed("no_pages", "没有可渲染的页面")

    work_dir = prepare_background_work_dir(output_pdf_path, None)
    engine_dir = _reset_dir(work_dir.parent / "rpr-fit-engine")
    items = _translation_items(translated_pages)
    # 障碍物扫描（准备步骤 obstacle_scan 的产物，{"<页号>": {...}}）：只取要渲染的页；没有就当
    # 没有障碍物信息（引擎照常排，只是看不到框外的线条）。
    drawings = {str(index): (obstacle_scan or {})[str(index)] for index in page_indices if str(index) in (obstacle_scan or {})}
    diagnostics["rpr_fit_raster_pages"] = sorted(int(page) for page, data in drawings.items() if data.get("raster"))
    (engine_dir / "translations.json").write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    (engine_dir / "drawings.json").write_text(json.dumps(drawings), encoding="utf-8")
    payload = {
        "schema": RPR_FIT_INPUT_SCHEMA,
        "font": {"family": font_family},
        "document_path": str(Path(document_path).resolve()),
        "translations_path": "translations.json",
        "visual_profile_path": str(Path(visual_profile_path).resolve())
        if visual_profile_path is not None and Path(visual_profile_path).is_file()
        else None,
        "drawings_path": "drawings.json",
        "pages": page_indices,
    }
    if payload["visual_profile_path"] is None:
        payload.pop("visual_profile_path")
        payload["visual_profile"] = None
    input_path = engine_dir / "rpr-fit-input.json"
    input_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    emit_render_compile_progress(
        current=1,
        total=3,
        message=f"正在用 rpr 引擎测量排版（字号由引擎决定），共 {len(page_indices)} 页",
        payload={"render_stage": "rpr_fit_engine_start", "render_engine": "rpr_fit"},
    )
    run = run_engine(runtime, input_path=input_path, out_dir=engine_dir / "out")
    overlay_pages = _pdf_page_count(run.overlay_pdf)
    if overlay_pages != len(page_indices):
        raise RprEngineFailed(
            "engine_output_invalid",
            f"rpr_fit 叠加层页数 {overlay_pages} 与输入页数 {len(page_indices)} 不一致",
        )
    emit_render_compile_progress(
        current=2,
        total=3,
        message="rpr 引擎测量排版完成，正在合并到底图",
        payload={"render_stage": "rpr_fit_engine_done", "render_engine": "rpr_fit"},
    )

    merge_started = time.perf_counter()
    if background_mode:
        # 只输出要渲染的页（与 Typst 背景路线一致）：先按页序抽出底图，再逐页叠加。
        base_subset = engine_dir / "rpr-fit-base.pdf"
        extract_page_indices_with_pikepdf(
            source_pdf_path=source_pdf_path,
            output_pdf_path=base_subset,
            page_indices=page_indices,
        )
        merge = overlay_pdf_pages_with_pikepdf(
            source_pdf_path=base_subset,
            overlay_pdf_path=run.overlay_pdf,
            output_pdf_path=output_pdf_path,
            source_page_indices=list(range(len(page_indices))),
        )
    else:
        # overlay：在渲染源上叠加，其余页原样保留，目录随原件（与 overlay 路线一致）。
        merge = overlay_pdf_pages_with_pikepdf(
            source_pdf_path=source_pdf_path,
            overlay_pdf_path=run.overlay_pdf,
            output_pdf_path=output_pdf_path,
            source_page_indices=page_indices,
        )
    if merge.pages_merged != len(page_indices):
        raise RprEngineFailed("merge_incomplete", f"只合并了 {merge.pages_merged}/{len(page_indices)} 页")
    diagnostics["rpr_merge_elapsed_seconds"] = round(time.perf_counter() - merge_started, 3)
    emit_render_compile_progress(
        current=3,
        total=3,
        message="rpr 引擎测量排版渲染完成",
        payload={"render_stage": "rpr_fit_engine_saved", "render_engine": "rpr_fit"},
    )

    report = run.report
    engine_info = dict(report.get("engine") or {})
    fit_payload = build_rpr_fit_fit_report_payload(
        report,
        render_path=f"rpr_fit_{mode}",
        engine_elapsed_seconds=run.elapsed_seconds,
    )
    diagnostics.update(record_fit_report_payload(fit_payload, elapsed=run.elapsed_seconds))
    diagnostics.update(
        {
            "render_engine": "rpr_fit",
            "rpr_engine_version": str(engine_info.get("version") or runtime.engine_version or ""),
            "rpr_engine_commit": str(engine_info.get("commit") or ""),
            "rpr_node_version": runtime.node_version,
            "rpr_engine_elapsed_seconds": round(run.elapsed_seconds, 3),
            "rpr_engine_timings": dict(report.get("timings") or {}),
            "rpr_fit_invariants": dict(report.get("invariants") or {}),
            "rpr_fit_body_font": dict(report.get("body_font") or {}),
            "rpr_work_dir": str(engine_dir),
            "rpr_pages": len(page_indices),
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
    "RPR_FIT_BACKGROUND_MODES",
    "RPR_FIT_SUPPORTED_MODES",
    "build_book_rpr_fit_pdf",
]
