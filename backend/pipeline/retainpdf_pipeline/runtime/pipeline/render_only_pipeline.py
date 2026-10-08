"""render-only worker：渲染完成后带上这次的排版 fit 报告重算一次翻译 QA。

render 阶段不能 import translate（阶段解耦），所以重算放在 runtime 层：先跑原样的
render-only，成功后再调 translate.public 的重算入口。QA 失败只记日志，不影响渲染结果。
"""
from __future__ import annotations

import argparse
from pathlib import Path

from retainpdf_pipeline.foundation.shared.stage_specs import RenderStageSpec
from retainpdf_pipeline.render.workflow.render_only import main as render_only_main
from retainpdf_pipeline.translate.public import refresh_translation_qa_after_render


def _spec_path_from_argv() -> Path:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--spec", type=str, required=True)
    args, _unknown = parser.parse_known_args()
    return Path(args.spec)


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
    render_only_main()
    refresh_translation_qa_for_render_spec(_spec_path_from_argv())


__all__ = ["main", "refresh_translation_qa_for_render_spec"]
