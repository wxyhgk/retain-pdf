"""OCR stage process entry: ``python -m retainpdf_pipeline.ocr``.

Thin wrapper over the existing OCR workers. Production invokes one stage
per process with ``--spec``; this module only selects the worker.
"""

from __future__ import annotations

import sys

from retainpdf_pipeline.foundation.shared.structured_errors import run_with_structured_failure


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
    if worker in {"provider-ocr", "provider-case"}:
        from retainpdf_pipeline.ocr.ocr_provider.provider_pipeline import main as worker_main

        stage, provider = "provider", "ocr"
    elif worker == "normalize-ocr":
        from retainpdf_pipeline.ocr.document_schema.normalize_pipeline import main as worker_main

        stage, provider = "normalization", "ocr"
    else:
        print(f"unknown OCR worker: {worker}\n", file=sys.stderr)
        print(_usage(), file=sys.stderr)
        return 2
    original_argv = sys.argv
    try:
        sys.argv = [f"retainpdf_pipeline.ocr {worker}", *rest]
        run_with_structured_failure(worker_main, default_stage=stage, provider=provider)
        return 0
    finally:
        sys.argv = original_argv


if __name__ == "__main__":
    raise SystemExit(main())
