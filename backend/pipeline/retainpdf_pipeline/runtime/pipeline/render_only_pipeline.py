"""render-only worker：渲染前按 spec 精修译文，渲染完成后带上这次的排版 fit 报告重算一次翻译 QA。

render 阶段不能 import translate（阶段解耦），所以跨阶段编排放在 runtime 层：
1. ``params.refine.mode != off`` 时先调 translate.public 的精修入口（挑错 / 定点修改，
   写回走修订链路）；mode=off（含旧 spec 没有这个对象）时什么都不做，行为与没有精修时一致；
2. 原样跑 render-only；
3. 成功后再调 translate.public 的 QA 重算入口。
精修和 QA 失败都只记日志 / 报告，不影响渲染结果。
"""
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

from retainpdf_pipeline.foundation.shared.stage_specs import RenderStageSpec
from retainpdf_pipeline.render.workflow.render_only import main as render_only_main
from retainpdf_pipeline.services.pipeline_shared.events import PipelineEventWriter
from retainpdf_pipeline.services.pipeline_shared.events import pipeline_event_writer_scope
from retainpdf_pipeline.translate.public import refresh_translation_qa_after_render
from retainpdf_pipeline.translate.public import run_refine_for_render


def _spec_path_from_argv() -> Path:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--spec", type=str, required=True)
    args, _unknown = parser.parse_known_args()
    return Path(args.spec)


def _optional_spec_path_from_argv() -> Path | None:
    # 渲染前这一步不能因为参数问题先于 render-only 报错：缺 --spec 时交给 render-only
    # 自己的参数解析去报，行为与没有精修时一致。
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--spec", type=str, default="")
    args, _unknown = parser.parse_known_args()
    return Path(args.spec) if args.spec else None


def refine_config_for_render_spec(spec: RenderStageSpec) -> dict[str, Any]:
    """params.refine + 翻译模型连接（reviewer_* 为空时由精修入口逐项回退到它们）。"""
    return {
        **spec.params.refine.as_dict(),
        "model": spec.params.model,
        "base_url": spec.params.base_url,
        "credential_ref": spec.params.credential_ref,
        "api_protocol": spec.params.api_protocol,
        "thinking": spec.params.thinking,
    }


def refine_translation_for_render_spec(spec_path: Path | None, *, chat_fn=None) -> dict | None:
    if spec_path is None:
        return None
    try:
        spec = RenderStageSpec.load(spec_path)
    except Exception as exc:  # noqa: BLE001 - 精修失败不能拖垮渲染；spec 真坏了渲染自己会报
        print(f"refine: skipped, cannot read render spec: {exc}", flush=True)
        return None
    if not spec.params.refine.enabled:
        return None
    try:
        job_dirs = spec.job_dirs
        writer = PipelineEventWriter(
            job_id=spec.job.job_id,
            job_root=job_dirs.root,
            logs_dir=job_dirs.logs_dir,
            workflow=spec.job.workflow,
        )
        with pipeline_event_writer_scope(writer):
            return run_refine_for_render(
                Path(job_dirs.root),
                Path(spec.inputs.translations_dir).resolve(),
                refine_config_for_render_spec(spec),
                chat_fn=chat_fn,
            )
    except Exception as exc:  # noqa: BLE001 - 精修失败不能拖垮渲染
        print(f"refine: skipped after error {type(exc).__name__}: {exc}", flush=True)
        return None


def refresh_translation_qa_for_render_spec(spec_path: Path) -> Path | None:
    try:
        spec = RenderStageSpec.load(spec_path)
        job_root = Path(spec.job_dirs.root)
        translations_dir = Path(spec.inputs.translations_dir).resolve()
    except Exception as exc:  # noqa: BLE001 - QA 只是报告，失败不能拖垮渲染
        print(f"translation qa: post-render refresh skipped, cannot read render spec: {exc}", flush=True)
        return None
    return refresh_translation_qa_after_render(job_root, translations_dir=translations_dir)


def main() -> None:
    refine_translation_for_render_spec(_optional_spec_path_from_argv())
    render_only_main()
    refresh_translation_qa_for_render_spec(_spec_path_from_argv())


__all__ = [
    "main",
    "refine_config_for_render_spec",
    "refine_translation_for_render_spec",
    "refresh_translation_qa_for_render_spec",
]
