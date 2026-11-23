"""Translation stage process entry: ``python -m retainpdf_pipeline.translate``.

Thin wrapper over the existing translate-only worker. Production invokes
one stage per process with ``--spec``.
"""

from retainpdf_pipeline.foundation.shared.structured_errors import run_imported_main


# worker 模块在结构化失败的包装里面才 import：import 期崩溃（缺模块、安装包缺文件）也要有结构化失败。
WORKER_MODULE = "retainpdf_pipeline.translate.entrypoints.translate_only_pipeline"


if __name__ == "__main__":
    run_imported_main(WORKER_MODULE, default_stage="translation", provider="translation")
