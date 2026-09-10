"""Console-script adapters for the RetainPDF Python worker entrypoints."""

from __future__ import annotations

from collections.abc import Callable
import sys

from retainpdf_pipeline.foundation.shared.structured_errors import run_with_structured_failure


def _run_structured(
    main_fn: Callable[[], object],
    *,
    default_stage: str,
    provider: str,
) -> int:
    run_with_structured_failure(main_fn, default_stage=default_stage, provider=provider)
    return 0


def run_book() -> int:
    from retainpdf_pipeline.translate.entrypoints.from_ocr_pipeline import main

    return _run_structured(main, default_stage="translation", provider="translation")


def run_provider_ocr() -> int:
    from retainpdf_pipeline.ocr.ocr_provider.provider_pipeline import main

    return _run_structured(main, default_stage="provider", provider="ocr")


def run_provider_case() -> int:
    from retainpdf_pipeline.ocr.ocr_provider.provider_pipeline import main

    return _run_structured(main, default_stage="provider", provider="ocr")


def run_normalize_ocr() -> int:
    from retainpdf_pipeline.ocr.document_schema.normalize_pipeline import main

    return _run_structured(main, default_stage="normalization", provider="ocr")


def run_translate_from_ocr() -> int:
    from retainpdf_pipeline.translate.entrypoints.from_ocr_pipeline import main

    return _run_structured(main, default_stage="translation", provider="translation")


def run_translate_only() -> int:
    from retainpdf_pipeline.translate.entrypoints.translate_only_pipeline import main

    return _run_structured(main, default_stage="translation", provider="translation")


def run_render_only() -> int:
    from retainpdf_pipeline.render.workflow.render_only import main

    return _run_structured(main, default_stage="rendering", provider="rendering")


def run_document_operation() -> int:
    from retainpdf_pipeline.entrypoints.run_document_operation import main

    return main()


def run_side_by_side_pdf() -> int:
    from retainpdf_pipeline.render.tools.side_by_side_pdf import main

    main()
    return 0


def run_diagnose_failure() -> int:
    from retainpdf_pipeline.entrypoints.diagnose_failure_with_ai import main

    main()
    return 0


COMMANDS: dict[str, tuple[Callable[[], int], str]] = {
    "book": (run_book, "normalize, translate, and render a document"),
    "provider-ocr": (run_provider_ocr, "run the configured OCR provider only"),
    "provider-case": (run_provider_case, "run the provider-backed full workflow"),
    "normalize-ocr": (run_normalize_ocr, "normalize an OCR provider payload"),
    "translate-from-ocr": (
        run_translate_from_ocr,
        "translate and render from normalized OCR artifacts",
    ),
    "translate-only": (run_translate_only, "translate normalized OCR artifacts"),
    "render-only": (run_render_only, "render existing translation artifacts"),
    "document-operation": (
        run_document_operation,
        "execute a restricted backend-prepared page program",
    ),
    "side-by-side-pdf": (
        run_side_by_side_pdf,
        "build a left/right source-vs-translated PDF",
    ),
    "diagnose-failure": (
        run_diagnose_failure,
        "run best-effort AI diagnosis for a failed job",
    ),
}


def _usage() -> str:
    rows = ["usage: retainpdf-pipeline <command> [args]", "", "commands:"]
    width = max(len(name) for name in COMMANDS)
    rows.extend(
        f"  {name:<{width}}  {description}"
        for name, (_runner, description) in COMMANDS.items()
    )
    return "\n".join(rows)


def main(argv: list[str] | None = None) -> int:
    """Dispatch one stable package command while preserving worker CLI arguments."""

    args = list(sys.argv[1:] if argv is None else argv)
    if not args or args[0] in {"-h", "--help", "help"}:
        print(_usage())
        return 0

    command = args.pop(0)
    command_entry = COMMANDS.get(command)
    if command_entry is None:
        print(f"unknown command: {command}\n", file=sys.stderr)
        print(_usage(), file=sys.stderr)
        return 2

    runner, _description = command_entry
    original_argv = sys.argv
    try:
        sys.argv = [f"retainpdf-pipeline {command}", *args]
        return runner()
    finally:
        sys.argv = original_argv


if __name__ == "__main__":
    raise SystemExit(main())
