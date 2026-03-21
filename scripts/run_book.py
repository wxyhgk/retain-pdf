import argparse
from pathlib import Path

from common.config import OUTPUT_DIR, SOURCE_JSON, SOURCE_PDF
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
        choices=["auto", "compact", "typst"],
        help="Rendering mode for translated pages. typst uses combined overlay with text redaction. auto keeps experimental editable-PDF detection.",
    )
    parser.add_argument(
        "--compile-workers",
        type=int,
        default=0,
        help="Parallel Typst overlay compilation workers. 0 means auto.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
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
