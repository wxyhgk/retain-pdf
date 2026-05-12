from __future__ import annotations

import argparse
from pathlib import Path

from backend.scripts.devtools.word_export.exporter import export_layout_docx


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export translated layout as a DOCX with each source PDF page as background.",
    )
    parser.add_argument("--job-root", required=True, help="RetainPDF job root containing source/ and translated/.")
    parser.add_argument("--output", default="", help="Output .docx path. Defaults to rendered/layout-preserved.docx.")
    parser.add_argument("--dpi", type=int, default=180, help="Background page image render DPI.")
    parser.add_argument("--max-pages", type=int, default=0, help="Optional page limit for quick experiments.")
    parser.add_argument("--font-family", default="SimSun", help="DOCX overlay text font family. Defaults to SimSun.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    job_root = Path(args.job_root).resolve()
    output_path = Path(args.output).resolve() if args.output else job_root / "rendered" / "layout-preserved.docx"
    result = export_layout_docx(
        job_root=job_root,
        output_path=output_path,
        dpi=args.dpi,
        max_pages=args.max_pages,
        font_family=args.font_family,
    )
    print(result)
