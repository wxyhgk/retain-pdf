import argparse
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from foundation.config import fonts
from foundation.config import layout
from foundation.config import paths
from foundation.config import runtime
from foundation.shared.job_dirs import locate_translated_dir
from services.mineru.artifacts import resolve_translation_source_json_path
from services.mineru.job_flow import run_mineru_to_job_dir
from services.mineru.summary import print_pipeline_summary
from services.mineru.summary import write_pipeline_summary
from services.mineru.mineru_api import MINERU_ENV_FILE
from runtime.pipeline.book_pipeline import run_book_pipeline
from services.translation.llm import DEFAULT_BASE_URL
from services.translation.llm import get_api_key
from services.translation.llm import normalize_base_url


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="End-to-end MinerU pipeline: parse PDF with MinerU, build document.v1.json, then translate and render.",
    )
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument("--file-url", type=str, default="", help="Remote PDF URL for MinerU parsing.")
    source_group.add_argument("--file-path", type=str, default="", help="Local PDF path for MinerU parsing.")

    parser.add_argument("--mineru-token", type=str, default="", help=f"MinerU API token. Prefer scripts/.env/{MINERU_ENV_FILE}.")
    parser.add_argument("--model-version", type=str, default="vlm", help="pipeline | vlm | MinerU-HTML")
    parser.add_argument("--is-ocr", action="store_true", help="Enable OCR.")
    parser.add_argument("--disable-formula", action="store_true", help="Disable formula recognition.")
    parser.add_argument("--disable-table", action="store_true", help="Disable table recognition.")
    parser.add_argument("--language", type=str, default="ch", help="Document language, for example ch or en.")
    parser.add_argument("--page-ranges", type=str, default="", help='Optional page range, for example "2,4-6".')
    parser.add_argument("--data-id", type=str, default="", help="Optional business data id.")
    parser.add_argument("--no-cache", action="store_true", help="Bypass MinerU URL cache.")
    parser.add_argument("--cache-tolerance", type=int, default=900, help="URL cache tolerance in seconds.")
    parser.add_argument("--extra-formats", type=str, default="", help="Comma-separated extra export formats: docx,html,latex")
    parser.add_argument("--poll-interval", type=int, default=5, help="Seconds between polling requests.")
    parser.add_argument("--poll-timeout", type=int, default=1800, help="Max seconds to wait for completion.")

    parser.add_argument("--job-id", type=str, default="", help="Optional explicit job directory name.")
    parser.add_argument("--output-root", type=str, default=str(paths.OUTPUT_DIR), help="Root directory for structured job outputs.")

    parser.add_argument("--start-page", type=int, default=0, help="Zero-based start page index. Default is the first page.")
    parser.add_argument("--end-page", type=int, default=-1, help="Zero-based end page index, inclusive. Default is the last page.")
    parser.add_argument("--batch-size", type=int, default=1, help="Number of text items per API call.")
    parser.add_argument("--workers", type=int, default=100, help="Concurrent translation requests.")
    parser.add_argument("--mode", type=str, default="sci", choices=["fast", "precise", "sci"], help="Translation mode. Default is sci.")
    parser.add_argument("--skip-title-translation", action="store_true", help="Do not translate OCR title blocks.")
    parser.add_argument("--classify-batch-size", type=int, default=12, help="Classification batch size for precise mode.")
    parser.add_argument("--rule-profile-name", type=str, default="general_sci", help="Built-in rule profile name.")
    parser.add_argument("--custom-rules-text", type=str, default="", help="Extra rule text injected into model context.")
    parser.add_argument("--api-key", type=str, default="", help="Optional translation API key. Prefer env DEEPSEEK_API_KEY for DeepSeek.")
    parser.add_argument("--model", type=str, default="Q3.5-turbo", help="Translation model name.")
    parser.add_argument("--base-url", type=str, default="http://1.94.67.196:10001/v1", help="OpenAI-compatible translation API base URL.")
    parser.add_argument("--render-mode", type=str, default="typst", choices=["auto", "overlay", "typst", "dual", "direct", "compact"], help="Rendering mode for translated pages. auto chooses between typst overlay and typst background. direct/compact are compatibility aliases for typst overlay.")
    parser.add_argument("--compile-workers", type=int, default=0, help="Parallel Typst overlay compilation workers. 0 means auto.")
    parser.add_argument("--typst-font-family", type=str, default=fonts.TYPST_DEFAULT_FONT_FAMILY, help="Base Typst font family name.")
    parser.add_argument("--pdf-compress-dpi", type=int, default=runtime.DEFAULT_PDF_COMPRESS_DPI, help="Final PDF image downsample DPI after rendering. 0 disables post-compression.")

    parser.add_argument("--translated-pdf-name", type=str, default="", help="Optional final PDF name inside transPDF.")
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

    job_root, source_pdf_path, layout_json_path, normalized_json_path = run_mineru_to_job_dir(args)
    # The runtime mainline should consume the normalized document.
    # The raw MinerU layout remains available only for adapter/debug use.
    translation_source_json_path = resolve_translation_source_json_path(
        layout_json_path=layout_json_path,
        normalized_json_path=normalized_json_path,
        allow_layout_fallback=False,
    )
    trans_pdf_dir = locate_translated_dir(job_root)
    translations_dir = trans_pdf_dir / "translations"
    translated_pdf_name = args.translated_pdf_name.strip() or f"{source_pdf_path.stem}-translated.pdf"
    output_pdf_path = trans_pdf_dir / translated_pdf_name

    api_key = get_api_key(
        args.api_key,
        required=normalize_base_url(args.base_url) == normalize_base_url(DEFAULT_BASE_URL),
    )

    result = run_book_pipeline(
        source_json_path=translation_source_json_path,
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

    summary_path = trans_pdf_dir / "pipeline_summary.json"
    write_pipeline_summary(
        summary_path=summary_path,
        job_root=job_root,
        source_pdf_path=source_pdf_path,
        layout_json_path=layout_json_path,
        normalized_json_path=normalized_json_path,
        source_json_path=translation_source_json_path,
        result=result,
        mode=args.mode,
        model=args.model,
        base_url=args.base_url,
        render_mode=args.render_mode,
        pdf_compress_dpi=args.pdf_compress_dpi,
    )

    print_pipeline_summary(
        job_root=job_root,
        source_pdf_path=source_pdf_path,
        layout_json_path=layout_json_path,
        normalized_json_path=normalized_json_path,
        source_json_path=translation_source_json_path,
        summary_path=summary_path,
        result=result,
    )


if __name__ == "__main__":
    main()
