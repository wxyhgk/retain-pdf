import argparse
from pathlib import Path

from common.config import OUTPUT_DIR, SOURCE_PDF
from pipeline.book_pipeline import build_book_pipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a translated PDF from per-page translation JSON files, either as a full-book overlay or as an extracted page range.",
    )
    parser.add_argument(
        "--translations-dir",
        type=str,
        default="translations/book",
        help="Directory under output/ containing per-page translation JSON files.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="dev-book.pdf",
        help="Output PDF filename placed under output/.",
    )
    parser.add_argument(
        "--start-page",
        type=int,
        default=0,
        help="Zero-based start page index to overlay or extract. Default is the first page.",
    )
    parser.add_argument(
        "--end-page",
        type=int,
        default=-1,
        help="Zero-based end page index, inclusive. Default is the last translated page.",
    )
    parser.add_argument(
        "--source-pdf",
        type=str,
        default=str(SOURCE_PDF),
        help="Source PDF path.",
    )
    parser.add_argument(
        "--compile-workers",
        type=int,
        default=0,
        help="Parallel Typst overlay compilation workers. 0 means auto.",
    )
    parser.add_argument(
        "--extract-selected-pages",
        action="store_true",
        help="Extract only the selected page range into the output PDF instead of keeping the full source book.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_pdf_path = OUTPUT_DIR / args.output
    summary = build_book_pipeline(
        source_pdf_path=Path(args.source_pdf),
        translations_dir=OUTPUT_DIR / args.translations_dir,
        output_pdf_path=output_pdf_path,
        start_page=args.start_page,
        end_page=args.end_page,
        compile_workers=args.compile_workers or None,
        extract_selected_pages=args.extract_selected_pages,
    )
    print(f"built book pdf: {output_pdf_path}")
    print(f"pages rendered: {summary['pages_rendered']}")


if __name__ == "__main__":
    main()
