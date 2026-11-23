"""Render stage process entry: ``python -m retainpdf_pipeline.render``.

Thin wrapper over the render-only worker. Production invokes one stage per
process with ``--spec``.

Must dispatch to ``runtime.pipeline.render_only_pipeline`` (the same worker as
``retainpdf-pipeline render-only``), not straight to ``render.workflow.render_only``:
the runtime layer is what runs refine before rendering and refreshes the translation
QA afterwards. Calling the bare render worker silently skips both.
"""

from retainpdf_pipeline.foundation.shared.structured_errors import run_imported_main


# worker 模块在结构化失败的包装里面才 import：import 期崩溃（缺模块、安装包缺文件）也要有结构化失败。
WORKER_MODULE = "retainpdf_pipeline.runtime.pipeline.render_only_pipeline"


if __name__ == "__main__":
    run_imported_main(WORKER_MODULE, default_stage="rendering", provider="rendering")
