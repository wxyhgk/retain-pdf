"""`retainpdf-pipeline layout-docx` —— 把保留排版的译文导出成 Word。

参数名刻意和 `side-by-side-pdf` 对齐（`--output-docx` 对 `--output-pdf`），因为 Rust
那边是同一套 `build_with_command` 在拼命令行。
"""

from __future__ import annotations

import argparse
from pathlib import Path

from retainpdf_pipeline.render.output.word.exporter import export_layout_docx
from retainpdf_pipeline.render.output.word.html_fit import MEASURED_FONT_FAMILY


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export the layout-preserving translation as a DOCX.",
    )
    parser.add_argument("--job-root", required=True, help="Job root containing source/ and translated/.")
    parser.add_argument("--output-docx", required=True, help="Output .docx path.")
    parser.add_argument("--dpi", type=int, default=180, help="Background page image DPI.")
    parser.add_argument("--max-pages", type=int, default=0, help="Optional page limit.")
    # translate-only 的任务自己的 source/ 是空的，源 PDF 在上游 OCR 任务目录里。
    # 调用方解析好了就传进来，别让这边靠 --job-root 去猜。
    parser.add_argument("--source-pdf", default="", help="Resolved source PDF; defaults to <job-root>/source/*.pdf.")
    parser.add_argument("--translated-pdf", default="", help="Resolved translated PDF; defaults to <job-root>/rendered/*-translated.pdf.")
    parser.add_argument("--watermark", action="store_true", help="Put the RetainPDF watermark in every page's bottom-right corner.")
    parser.add_argument(
        "--font-family", default=MEASURED_FONT_FAMILY,
        help="Overlay text font family. Changing it invalidates the fitted sizes.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    export_layout_docx(
        job_root=Path(args.job_root).resolve(),
        output_path=Path(args.output_docx).resolve(),
        dpi=args.dpi,
        max_pages=args.max_pages,
        font_family=args.font_family,
        source_pdf=Path(args.source_pdf).resolve() if args.source_pdf else None,
        translated_pdf=Path(args.translated_pdf).resolve() if args.translated_pdf else None,
        watermark=args.watermark,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
