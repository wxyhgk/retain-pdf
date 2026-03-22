import argparse
from pathlib import Path

from common.config import BODY_FONT_SIZE_FACTOR
from common.config import BODY_LEADING_FACTOR
from common.config import DEFAULT_PDF_COMPRESS_DPI
from common.config import INNER_BBOX_DENSE_SHRINK_X
from common.config import INNER_BBOX_DENSE_SHRINK_Y
from common.config import INNER_BBOX_SHRINK_X
from common.config import INNER_BBOX_SHRINK_Y
from common.config import OUTPUT_DIR, SOURCE_JSON, SOURCE_PDF
from common.config import TYPST_DEFAULT_FONT_FAMILY
from common.config import apply_layout_tuning
from pipeline.book_pipeline import run_book_pipeline
from translation.deepseek_client import DEFAULT_BASE_URL
from translation.deepseek_client import get_api_key
from translation.deepseek_client import normalize_base_url


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Translate and render a full book in a page-by-page pipeline.",
    )
    parser.add_argument("--start-page", type=int, default=0, help="Zero-based start page index. Default is the first page.")
    parser.add_argument("--end-page", type=int, default=-1, help="Zero-based end page index, inclusive. Default is the last page.")
    parser.add_argument("--batch-size", type=int, default=6, help="Number of text items per API call.")
    parser.add_argument("--workers", type=int, default=4, help="Concurrent translation requests per page.")
    parser.add_argument(
        "--mode",
        type=str,
        default="fast",
        choices=["fast", "precise", "sci"],
        help="Translation mode. sci is the academic-paper mode: skip titles and all content after the last title in the whole document.",
    )
    parser.add_argument(
        "--skip-title-translation",
        action="store_true",
        help="Do not translate OCR blocks with block_type=title. Useful for fast mode previews.",
    )
    parser.add_argument("--classify-batch-size", type=int, default=12, help="Number of suspicious items per classification API call.")
    parser.add_argument("--api-key", type=str, default="", help="Optional API key. Prefer env DEEPSEEK_API_KEY.")
    parser.add_argument("--model", type=str, default="deepseek-chat", help="Model name.")
    parser.add_argument(
        "--base-url",
        type=str,
        default="https://api.deepseek.com/v1",
        help="OpenAI-compatible API base URL ending with /v1.",
    )
    parser.add_argument(
        "--source-json",
        type=str,
        default=str(SOURCE_JSON),
        help="OCR JSON source path.",
    )
    parser.add_argument(
        "--source-pdf",
        type=str,
        default=str(SOURCE_PDF),
        help="Source PDF path.",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="translations/run-book",
        help="Output directory under output/ for per-page translation JSON files.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="run-book.pdf",
        help="Output PDF filename placed under output/.",
    )
    parser.add_argument(
        "--render-mode",
        type=str,
        default="typst",
        choices=["auto", "compact", "direct", "typst", "dual"],
        help="Rendering mode for translated pages. direct writes translated text back into the original PDF. dual outputs a side-by-side PDF: left original page, right translated page.",
    )
    parser.add_argument(
        "--compile-workers",
        type=int,
        default=0,
        help="Parallel Typst overlay compilation workers. 0 means auto.",
    )
    parser.add_argument(
        "--typst-font-family",
        type=str,
        default=TYPST_DEFAULT_FONT_FAMILY,
        help="Base Typst font family name.",
    )
    parser.add_argument(
        "--pdf-compress-dpi",
        type=int,
        default=DEFAULT_PDF_COMPRESS_DPI,
        help="Final PDF image downsample DPI after rendering. 0 disables post-compression.",
    )
    parser.add_argument("--body-font-size-factor", type=float, default=BODY_FONT_SIZE_FACTOR)
    parser.add_argument("--body-leading-factor", type=float, default=BODY_LEADING_FACTOR)
    parser.add_argument("--inner-bbox-shrink-x", type=float, default=INNER_BBOX_SHRINK_X)
    parser.add_argument("--inner-bbox-shrink-y", type=float, default=INNER_BBOX_SHRINK_Y)
    parser.add_argument("--inner-bbox-dense-shrink-x", type=float, default=INNER_BBOX_DENSE_SHRINK_X)
    parser.add_argument("--inner-bbox-dense-shrink-y", type=float, default=INNER_BBOX_DENSE_SHRINK_Y)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    apply_layout_tuning(
        body_font_size_factor=args.body_font_size_factor,
        body_leading_factor=args.body_leading_factor,
        inner_bbox_shrink_x=args.inner_bbox_shrink_x,
        inner_bbox_shrink_y=args.inner_bbox_shrink_y,
        inner_bbox_dense_shrink_x=args.inner_bbox_dense_shrink_x,
        inner_bbox_dense_shrink_y=args.inner_bbox_dense_shrink_y,
    )
    api_key = get_api_key(
        args.api_key,
        required=normalize_base_url(args.base_url) == normalize_base_url(DEFAULT_BASE_URL),
    )
    result = run_book_pipeline(
        source_json_path=Path(args.source_json),
        source_pdf_path=Path(args.source_pdf),
        output_dir=OUTPUT_DIR / args.output_dir,
        output_pdf_path=OUTPUT_DIR / args.output,
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
        compile_workers=args.compile_workers or None,
        typst_font_family=args.typst_font_family,
        pdf_compress_dpi=args.pdf_compress_dpi,
    )
    print(f"translation dir: {result['output_dir']}")
    print(f"output pdf: {result['output_pdf_path']}")
    print(f"pages processed: {result['pages_processed']}")
    print(f"translated items: {result['translated_items_total']}")
    print(f"translate+render time: {result['translate_elapsed']:.2f}s")
    print(f"save time: {result['save_elapsed']:.2f}s")
    print(f"total time: {result['total_elapsed']:.2f}s")


if __name__ == "__main__":
    main()
