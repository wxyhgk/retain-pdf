"""渲染准备阶段：与翻译并行，提前做与译文无关的渲染准备。

``python -m retainpdf_pipeline.render.workflow.prepare_stage --spec render-prepare.spec.json``
（Rust 在启动翻译阶段时一并拉起，进入渲染阶段前等它收尾；失败不影响任务）。

只做输入在翻译前就能确定的步骤：页面分析、渲染源底子（去隐藏文字层）、障碍物扫描
（rpr_fit）、PDF 结构画像（要完整版式 payload 的路线）。输入按渲染阶段同样的推导算——
翻译前的条目（同一份 document.v1、同一个抽取函数，翻译只往条目里加译文）、
resolve_effective_render_mode、select_translated_pages、页码范围——渲染阶段用指纹核对，
猜错只是没命中、照常现做。按框去文字依赖翻译结果（哪些块最终有译文），不在这里做。

底色 / 字色（rpr_fit）2026-11-02 起也在这里先做：假定每块都翻成（译文先拿占位文字顶上），按页算好存进按页缓存
（prepare.visual_profile.precompute_visual_profile_pages）；翻译完渲染时指纹对得上的页直接用，只重采对不上的页
（翻译时判成不翻的块、覆盖框随译文长短变了的）。以前这一步整个留到翻译完才做，708 页的书约 16 秒。

与渲染进程同时做同一步时由步骤锁互斥：后到的一方等前一方做完再读缓存。
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from retainpdf_base.output_layout import ARTIFACTS_DIR_NAME
from retainpdf_pipeline.foundation.shared.stage_specs import RenderPrepareStageSpec
from retainpdf_pipeline.render.prepare.obstacle_scan import run_obstacle_scan
from retainpdf_pipeline.render.prepare.page_analysis import run_page_analysis
from retainpdf_pipeline.render.prepare.pdf_structure_profile import pdf_structure_profile_builder
from retainpdf_pipeline.render.prepare.routes import route_prepare_needs
from retainpdf_pipeline.render.prepare.source_base import run_source_base
from retainpdf_pipeline.render.prepare.store import PREPARE_DIR_NAME
from retainpdf_pipeline.render.prepare.visual_profile import precompute_visual_profile_pages
from retainpdf_pipeline.render.prepare.store import PrepareStore
from retainpdf_pipeline.render.render_plan import plan_pages
from retainpdf_pipeline.render.workflow.prewarm_entry import build_source_render_preprocess_pages


def document_path_for_render(translations_dir: Path, *, explicit: Path | None = None) -> Path:
    """渲染阶段读的 document.v1（与 executor 同一约定；步骤指纹含路径，必须一致）。

    explicit：spec 里给的准确位置（Rust 按任务记录写）。以前只按「译文目录的上一级 ocr/normalized/」推算——
    译文被复制进新任务、OCR 文档还在原任务时（重新渲染出的新任务），推算落到新任务下空的 ocr/，rpr_fit 找不到
    文档、回退 Typst。渲染准备和渲染两边都从各自的 spec 拿到同一个路径。
    """
    if explicit is not None:
        return Path(explicit)
    return Path(translations_dir).parent / "ocr" / "normalized" / "document.v1.json"


def run_render_prepare(
    *,
    source_pdf_path: Path,
    translations_dir: Path,
    start_page: int,
    end_page: int,
    render_mode: str,
    render_engine: str,
    math_mode: str = "direct_typst",
    document_path: Path | None = None,
) -> dict[str, object]:
    started = time.perf_counter()
    prepare_dir = Path(translations_dir).parent / ARTIFACTS_DIR_NAME / PREPARE_DIR_NAME
    store = PrepareStore(prepare_dir)
    document_path = document_path_for_render(translations_dir, explicit=document_path)
    pages = build_source_render_preprocess_pages(
        source_json_path=document_path,
        start_page=start_page,
        end_page=end_page,
        math_mode=math_mode,
    )
    report: dict[str, object] = {"steps": {}}
    if not pages:
        report["skipped"] = "no_pages"
        return report
    # 与 build_render_plan 同一份推导（渲染阶段从磁盘读到的就是这些条目加上译文）；
    # 只有 auto 模式才拿条目探测渲染模式。
    selected, effective_render_mode = plan_pages(
        source_pdf_path=source_pdf_path,
        pages=pages,
        mode_probe_pages=pages if render_mode == "auto" else None,
        start_page=start_page,
        end_page=end_page,
        render_mode=render_mode,
    )
    # 与 executor.execute_render_plan 相同的页码范围。
    start = max(0, start_page)
    stop = max(selected) if end_page < 0 else end_page
    needs = route_prepare_needs(render_engine)
    steps: dict[str, object] = {}

    def timed(name: str, fn):
        step_started = time.perf_counter()
        try:
            result = fn()
            steps[name] = {"seconds": round(time.perf_counter() - step_started, 3), **(result or {})}
        except Exception as exc:  # noqa: BLE001 - 提前准备失败不影响渲染（渲染阶段会现做）
            steps[name] = {"error": f"{type(exc).__name__}: {exc}"}
            print(f"render prepare: {name} failed {type(exc).__name__}: {exc}", flush=True)
            return None
        return result

    if needs.obstacle_scan:
        timed(
            "obstacle_scan",
            lambda: {"hit": run_obstacle_scan(store, source_pdf_path=source_pdf_path, document_path=document_path).hit},
        )
    analysis_box: list = []

    def analyse():
        analysis, record = run_page_analysis(
            store, source_pdf_path=source_pdf_path, translated_pages=selected, start_page=start, end_page=stop
        )
        analysis_box.append(analysis)
        return {"hit": record.hit}

    timed("page_analysis", analyse)
    if analysis_box:
        strip_hidden_text = bool(
            effective_render_mode != "overlay" and analysis_box[0].hidden_text_strip_page_indices
        )
        timed(
            "source_base",
            lambda: {
                "hit": run_source_base(
                    store,
                    source_pdf_path=source_pdf_path,
                    strip_hidden_text=strip_hidden_text,
                    start_page=start,
                    end_page=stop,
                )[1].hit
            },
        )
    if needs.visual_profile and not needs.payload_layout:
        # 要完整版式 payload 的路线（typst）底色字色在 prewarm 里和版式一起做，这里只管 rpr_fit 那条精简路线
        timed(
            "visual_profile_pages",
            lambda: {
                "sampled_pages": precompute_visual_profile_pages(
                    store,
                    source_pdf_path=source_pdf_path,
                    pages=_render_ready_pages(source_pdf_path, _assume_translated(selected)),
                )
            },
        )
    if needs.payload_layout:
        builder = pdf_structure_profile_builder(prepare_dir)
        timed("pdf_structure_profile", lambda: (builder(source_pdf_path, selected), {})[1])
    report.update(
        {
            "steps": steps,
            "effective_render_mode": effective_render_mode,
            "pages": len(selected),
            "elapsed_seconds": round(time.perf_counter() - started, 3),
        }
    )
    return report


def _assume_translated(pages: dict[int, list[dict]]) -> dict[int, list[dict]]:
    """翻译前的条目，假定每块要翻的都翻成了：译文拿「原文前面加一个字」顶上（不能和原文一样——一样的话
    渲染当成没翻、不盖底色）。只用来算采样指纹和采样，措辞无关。"""
    out: dict[int, list[dict]] = {}
    for page_index, items in pages.items():
        page_items = []
        for item in items:
            copy = dict(item)
            if copy.get("should_translate", True) and str(copy.get("protected_source_text") or copy.get("source_text") or "").strip():
                copy["protected_translated_text"] = "译" + str(copy.get("protected_source_text") or copy.get("source_text") or "")
                copy["translated_text"] = "译" + str(copy.get("source_text") or "")
                copy["final_status"] = "translated"
            page_items.append(copy)
        out[page_index] = page_items
    return out


def _render_ready_pages(source_pdf_path: Path, pages: dict[int, list[dict]]) -> dict[int, list[dict]]:
    """和渲染时 route_visual_profile 同一条路：版式几何 → 预备条目（覆盖框、要不要盖底色）。"""
    from retainpdf_pipeline.render.output.typst.book_support import prepare_translated_pages_for_render
    from retainpdf_pipeline.render.source.prewarm_payload import build_payload_geometry

    _seeded, indents, inner_bboxes, _stats = build_payload_geometry(source_pdf_path=source_pdf_path, translated_pages=pages)
    return prepare_translated_pages_for_render(
        source_pdf_path,
        pages,
        first_line_indent_lookup=indents,
        effective_inner_bbox_lookup=inner_bboxes,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Prepare render inputs that do not depend on the translation.")
    parser.add_argument("--spec", type=Path, required=True, help="Path to render-prepare stage spec JSON.")
    args = parser.parse_args(argv)
    spec = RenderPrepareStageSpec.load(args.spec)
    report = run_render_prepare(
        source_pdf_path=spec.inputs.source_pdf,
        translations_dir=spec.inputs.translations_dir,
        start_page=spec.params.start_page,
        end_page=spec.params.end_page,
        render_mode=spec.params.render_mode,
        render_engine=spec.params.engine,
        math_mode=spec.params.math_mode,
        document_path=spec.inputs.source_json,
    )
    print(f"render prepare: {json.dumps(report, ensure_ascii=False)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
