import argparse
from pathlib import Path

from config import paths
from pipeline.book_pipeline import translate_book_pipeline
from translation.llm import DEFAULT_BASE_URL
from translation.llm import get_api_key
from translation.llm import normalize_base_url


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Translate all pages in the OCR JSON with DeepSeek.")
    parser.add_argument("--start-page", type=int, default=0, help="Zero-based start page index. Default is the first page.")
    parser.add_argument("--end-page", type=int, default=-1, help="Zero-based end page index, inclusive. Default is the last page.")
    parser.add_argument("--batch-size", type=int, default=8, help="Number of text items per API call.")
    parser.add_argument("--workers", type=int, default=1, help="Concurrent translation requests per page.")
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
        help="Do not translate OCR blocks with block_type=title.",
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
        "--output-dir",
        type=str,
        default="translations/book",
        help="Output directory under output/ for per-page translation JSON files.",
    )
    parser.add_argument(
        "--source-json",
        type=str,
        default=str(paths.SOURCE_JSON),
        help="OCR JSON source path.",
    )
    parser.add_argument(
        "--source-pdf",
        type=str,
        default=str(paths.SOURCE_PDF),
        help="Source PDF path. In sci mode the first two pages are used for domain inference.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    api_key = get_api_key(
        args.api_key,
        required=normalize_base_url(args.base_url) == normalize_base_url(DEFAULT_BASE_URL),
    )
    summary = translate_book_pipeline(
        source_json_path=Path(args.source_json),
        output_dir=paths.OUTPUT_DIR / args.output_dir,
        api_key=api_key,
        start_page=args.start_page,
        end_page=args.end_page,
        batch_size=args.batch_size,
        workers=max(1, args.workers),
        mode=args.mode,
        classify_batch_size=max(1, args.classify_batch_size),
        skip_title_translation=args.skip_title_translation,
        model=args.model,
        base_url=args.base_url,
        source_pdf_path=Path(args.source_pdf),
    )
    for page_summary in summary["summaries"]:
        print(
            f"page {page_summary['page_idx'] + 1}: {page_summary['translated_items']}/{page_summary['total_items']} translated "
            f"-> {page_summary['translation_path']}"
        )
    print(
        f"book translation completed: {summary['translated_items']}/{summary['total_items']} items translated "
        f"across {summary['page_count']} pages into {summary['output_dir']}"
    )


if __name__ == "__main__":
    main()
