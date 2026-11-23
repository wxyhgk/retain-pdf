"""OCR stage process entry: ``python -m retainpdf_pipeline.ocr``.

Thin wrapper over the existing OCR workers. Production invokes one stage
per process with ``--spec``; this module only selects the worker.
"""

from __future__ import annotations

import sys

from retainpdf_pipeline.foundation.shared.structured_errors import run_imported_main


# worker 名 → (模块, 默认失败阶段)
WORKERS: dict[str, tuple[str, str]] = {
    "provider-ocr": ("retainpdf_pipeline.ocr.ocr_provider.provider_pipeline", "provider"),
    "provider-case": ("retainpdf_pipeline.ocr.ocr_provider.provider_pipeline", "provider"),
    "normalize-ocr": ("retainpdf_pipeline.ocr.document_schema.normalize_pipeline", "normalization"),
}


def _usage() -> str:
    return (
        "usage: python -m retainpdf_pipeline.ocr <provider-ocr|provider-case|normalize-ocr> [args]\n"
        "\n"
        "  provider-ocr   run the configured OCR provider only\n"
        "  provider-case  run the provider-backed full workflow\n"
        "  normalize-ocr  normalize an OCR provider payload\n"
    )


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if not args or args[0] in {"-h", "--help", "help"}:
        print(_usage())
        return 0
    worker, rest = args[0], args[1:]
    if worker not in WORKERS:
        print(f"unknown OCR worker: {worker}\n", file=sys.stderr)
        print(_usage(), file=sys.stderr)
        return 2
    module, stage = WORKERS[worker]
    original_argv = sys.argv
    try:
        sys.argv = [f"retainpdf_pipeline.ocr {worker}", *rest]
        # worker 模块在包装里面才 import：import 期崩溃也要有结构化失败。#135 就是 import 期找不到
        # 安装包里的数据文件，没有结构化失败，Rust 按 traceback 里的 typst 字样把它猜成了渲染失败。
        run_imported_main(module, default_stage=stage, provider="ocr")
        return 0
    finally:
        sys.argv = original_argv


if __name__ == "__main__":
    raise SystemExit(main())
