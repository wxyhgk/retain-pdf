from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from foundation.config import fonts
from foundation.config import layout
from foundation.config import runtime
from foundation.shared.job_dirs import add_explicit_job_dir_args
from foundation.shared.job_dirs import job_dirs_from_explicit_args
from foundation.shared.tee_output import enable_job_log_capture
from runtime.pipeline.render_stage import run_render_stage
from services.mineru.artifacts import save_json
from services.mineru.contracts import format_stdout_kv
from services.mineru.contracts import MINERU_PIPELINE_SUMMARY_FILE_NAME
from services.mineru.contracts import STDOUT_LABEL_JOB_ROOT
from services.mineru.contracts import STDOUT_LABEL_OUTPUT_PDF
from services.mineru.contracts import STDOUT_LABEL_SOURCE_PDF
from services.mineru.contracts import STDOUT_LABEL_SUMMARY
from services.mineru.contracts import STDOUT_LABEL_TRANSLATIONS_DIR


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render translated PDF from source PDF and translation artifacts only.",
    )
    add_explicit_job_dir_args(parser)
    parser.add_argument("--source-pdf", type=str, required=True, help="Path to source PDF.")
    parser.add_argument("--translations-dir", type=str, required=True, help="Directory containing translation artifacts.")
    parser.add_argument("--translation-manifest", type=str, default="", help="Optional explicit translation manifest path.")
    parser.add_argument("--start-page", type=int, default=0)
    parser.add_argument("--end-page", type=int, default=-1)
    parser.add_argument(
        "--render-mode",
        type=str,
        default="typst",
        choices=["auto", "overlay", "typst", "dual", "direct", "compact"],
    )
    parser.add_argument("--compile-workers", type=int, default=0)
    parser.add_argument("--typst-font-family", type=str, default=fonts.TYPST_DEFAULT_FONT_FAMILY)
    parser.add_argument("--pdf-compress-dpi", type=int, default=runtime.DEFAULT_PDF_COMPRESS_DPI)
    parser.add_argument("--translated-pdf-name", type=str, default="")
    parser.add_argument("--api-key", type=str, default="")
    parser.add_argument("--model", type=str, default="")
    parser.add_argument("--base-url", type=str, default="")
    parser.add_argument("--body-font-size-factor", type=float, default=layout.BODY_FONT_SIZE_FACTOR)
    parser.add_argument("--body-leading-factor", type=float, default=layout.BODY_LEADING_FACTOR)
    parser.add_argument("--inner-bbox-shrink-x", type=float, default=layout.INNER_BBOX_SHRINK_X)
    parser.add_argument("--inner-bbox-shrink-y", type=float, default=layout.INNER_BBOX_SHRINK_Y)
    parser.add_argument("--inner-bbox-dense-shrink-x", type=float, default=layout.INNER_BBOX_DENSE_SHRINK_X)
    parser.add_argument("--inner-bbox-dense-shrink-y", type=float, default=layout.INNER_BBOX_DENSE_SHRINK_Y)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    layout.apply_layout_tuning(
        body_font_size_factor=args.body_font_size_factor,
        body_leading_factor=args.body_leading_factor,
        inner_bbox_shrink_x=args.inner_bbox_shrink_x,
        inner_bbox_shrink_y=args.inner_bbox_shrink_y,
        inner_bbox_dense_shrink_x=args.inner_bbox_dense_shrink_x,
        inner_bbox_dense_shrink_y=args.inner_bbox_dense_shrink_y,
    )

    job_dirs = job_dirs_from_explicit_args(args)
    enable_job_log_capture(job_dirs.logs_dir, prefix="render-only")
    source_pdf_path = Path(args.source_pdf).resolve()
    translations_dir = Path(args.translations_dir).resolve()
    translation_manifest_path = (
        Path(args.translation_manifest).resolve()
        if args.translation_manifest.strip()
        else None
    )
    translated_pdf_name = args.translated_pdf_name.strip() or f"{source_pdf_path.stem}-translated.pdf"
    output_pdf_path = job_dirs.rendered_dir / translated_pdf_name
    summary_path = job_dirs.artifacts_dir / MINERU_PIPELINE_SUMMARY_FILE_NAME

    started = time.perf_counter()
    result = run_render_stage(
        source_pdf_path=source_pdf_path,
        translations_dir=translations_dir,
        translation_manifest_path=translation_manifest_path,
        output_pdf_path=output_pdf_path,
        start_page=args.start_page,
        end_page=args.end_page,
        render_mode=args.render_mode,
        compile_workers=args.compile_workers or None,
        extract_selected_pages=False,
        api_key=args.api_key,
        model=args.model,
        base_url=args.base_url,
        typst_font_family=args.typst_font_family,
        pdf_compress_dpi=args.pdf_compress_dpi,
    )
    elapsed = time.perf_counter() - started
    save_json(
        summary_path,
        {
            "job_root": str(job_dirs.root),
            "source_pdf": str(source_pdf_path),
            "translations_dir": str(translations_dir),
            "translation_manifest": str(translation_manifest_path or ""),
            "output_pdf": str(result["output_pdf_path"]),
            "pages_processed": result["pages_rendered"],
            "render_elapsed": elapsed,
            "total_elapsed": elapsed,
            "render_mode": args.render_mode,
            "effective_render_mode": result.get("effective_render_mode", args.render_mode),
            "pdf_compress_dpi": args.pdf_compress_dpi,
        },
    )

    print(format_stdout_kv(STDOUT_LABEL_JOB_ROOT, job_dirs.root))
    print(format_stdout_kv(STDOUT_LABEL_SOURCE_PDF, source_pdf_path))
    print(format_stdout_kv(STDOUT_LABEL_TRANSLATIONS_DIR, translations_dir))
    print(format_stdout_kv(STDOUT_LABEL_OUTPUT_PDF, result["output_pdf_path"]))
    print(format_stdout_kv(STDOUT_LABEL_SUMMARY, summary_path))
    print(f"pages processed: {result['pages_rendered']}")
    print(f"save time: {elapsed:.2f}s")
    print(f"total time: {elapsed:.2f}s")
    if result.get("effective_render_mode"):
        print(f"effective render mode: {result['effective_render_mode']}")


if __name__ == "__main__":
    main()
