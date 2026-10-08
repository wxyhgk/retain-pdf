"""渲染阶段入口用的 fit 报告作用域：决定报告写到哪里，渲染结束后发布产物事件。

真正的度量在 output 层（render.output.typst.fit_report），这里只做阶段级的收尾：

- 渲染路径没有产出报告（逐页降级、Word 等）时，写一份 status=unavailable 的报告盖掉
  上一次渲染留下的旧文件；
- 渲染本身失败时同样标成 unavailable，原异常照常向上抛；
- 报告写成后发 artifact_published 事件（artifact_key=fit_report_json）。
"""

from __future__ import annotations

import contextlib
from pathlib import Path
from typing import Iterator

from retainpdf_pipeline.render.output.typst.fit_report import FIT_REPORT_ARTIFACT_KEY
from retainpdf_pipeline.render.output.typst.fit_report import FIT_REPORT_FILE_NAME
from retainpdf_pipeline.render.output.typst.fit_report import FitReportTarget
from retainpdf_pipeline.render.output.typst.fit_report import finalize_fit_report_target
from retainpdf_pipeline.render.output.typst.fit_report import fit_report_scope
from retainpdf_pipeline.services.pipeline_shared.events import emit_artifact_published


def fit_report_path_for_artifacts_dir(artifacts_dir: Path | None) -> Path | None:
    if artifacts_dir is None:
        return None
    return Path(artifacts_dir) / FIT_REPORT_FILE_NAME


@contextlib.contextmanager
def render_fit_report_scope(artifacts_dir: Path | None) -> Iterator[FitReportTarget | None]:
    path = fit_report_path_for_artifacts_dir(artifacts_dir)
    with fit_report_scope(path) as target:
        try:
            yield target
        except BaseException:
            finalize_fit_report_target(target, reason="render_failed")
            raise
        finalize_fit_report_target(target, reason="render_path_without_whole_book_typst_compile")
    if target is not None and target.recorded:
        try:
            emit_artifact_published(
                artifact_key=FIT_REPORT_ARTIFACT_KEY,
                path=target.path,
                stage="saving",
                message="排版 fit 报告已发布",
                payload={"status": target.status},
            )
        except Exception as exc:  # noqa: BLE001 - 事件发布失败不影响渲染结果
            print(f"fit report: publish event failed {type(exc).__name__}: {exc}", flush=True)


def fit_report_result(target: FitReportTarget | None) -> dict:
    if target is None or not target.recorded:
        return {}
    return {
        "path": str(target.path),
        "status": target.status,
        "elapsed_seconds": round(target.elapsed_seconds, 3),
        "summary": dict(target.summary),
    }


__all__ = [
    "fit_report_path_for_artifacts_dir",
    "fit_report_result",
    "render_fit_report_scope",
]
