from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from foundation.config import fonts
from foundation.config import layout
from foundation.config import runtime
from foundation.shared.job_dirs import add_explicit_job_dir_args
from foundation.shared.job_dirs import job_dirs_from_explicit_args
from runtime.pipeline.book_pipeline import run_book_pipeline
from services.document_schema import DOCUMENT_SCHEMA_REPORT_FILE_NAME
from services.mineru.contracts import MINERU_PIPELINE_SUMMARY_FILE_NAME
from services.mineru.summary import print_pipeline_summary
from services.mineru.summary import write_pipeline_summary
from services.translation.llm import DEFAULT_BASE_URL
from services.translation.llm import get_api_key
from services.translation.llm import normalize_base_url


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Translate and render from normalized OCR document.v1.json.",
    )
    add_explicit_job_dir_args(parser)
    parser.add_argument("--source-json", type=str, required=True, help="Path to normalized document.v1.json.")
    parser.add_argument("--source-pdf", type=str, required=True, help="Path to source PDF.")
    parser.add_argument("--layout-json", type=str, default="", help="Optional raw provider layout.json for summary/debug.")
    parser.add_argument("--start-page", type=int, default=0)
    parser.add_argument("--end-page", type=int, default=-1)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--workers", type=int, default=100)
    parser.add_argument("--mode", type=str, default="sci", choices=["fast", "precise", "sci"])
    parser.add_argument("--skip-title-translation", action="store_true")
    parser.add_argument("--classify-batch-size", type=int, default=12)
    parser.add_argument("--rule-profile-name", type=str, default="general_sci")
    parser.add_argument("--custom-rules-text", type=str, default="")
    parser.add_argument("--api-key", type=str, default="")
    parser.add_argument("--model", type=str, default="Q3.5-turbo")
    parser.add_argument("--base-url", type=str, default="http://1.94.67.196:10001/v1")
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
    source_json_path = Path(args.source_json).resolve()
    source_pdf_path = Path(args.source_pdf).resolve()
    layout_json_path = Path(args.layout_json).resolve() if args.layout_json.strip() else source_json_path
    normalization_report_path = source_json_path.with_name(DOCUMENT_SCHEMA_REPORT_FILE_NAME)
    translations_dir = job_dirs.translated_dir
    translated_pdf_name = args.translated_pdf_name.strip() or f"{source_pdf_path.stem}-translated.pdf"
    output_pdf_path = job_dirs.rendered_dir / translated_pdf_name

    api_key = get_api_key(
        args.api_key,
        required=normalize_base_url(args.base_url) == normalize_base_url(DEFAULT_BASE_URL),
    )
    result = run_book_pipeline(
        source_json_path=source_json_path,
        source_pdf_path=source_pdf_path,
        output_dir=translations_dir,
        output_pdf_path=output_pdf_path,
        api_key=api_key,
        start_page=args.start_page,
        end_page=args.end_page,
        batch_size=args.batch_size,
        workers=args.workers,
        model=args.model,
        base_url=args.base_url,
        mode=args.mode,
        classify_batch_size=args.classify_batch_size,
        skip_title_translation=args.skip_title_translation,
        render_mode=args.render_mode,
        rule_profile_name=args.rule_profile_name,
        custom_rules_text=args.custom_rules_text,
        compile_workers=args.compile_workers or None,
        typst_font_family=args.typst_font_family,
        pdf_compress_dpi=args.pdf_compress_dpi,
    )

    summary_path = job_dirs.artifacts_dir / MINERU_PIPELINE_SUMMARY_FILE_NAME
    write_pipeline_summary(
        summary_path=summary_path,
        job_root=job_dirs.root,
        source_pdf_path=source_pdf_path,
        layout_json_path=layout_json_path,
        normalized_json_path=source_json_path,
        normalization_report_path=normalization_report_path,
        source_json_path=source_json_path,
        result=result,
        mode=args.mode,
        model=args.model,
        base_url=args.base_url,
        render_mode=args.render_mode,
        pdf_compress_dpi=args.pdf_compress_dpi,
    )
    print_pipeline_summary(
        job_root=job_dirs.root,
        source_pdf_path=source_pdf_path,
        layout_json_path=layout_json_path,
        normalized_json_path=source_json_path,
        normalization_report_path=normalization_report_path,
        source_json_path=source_json_path,
        summary_path=summary_path,
        result=result,
    )


if __name__ == "__main__":
    main()
