import argparse
from pathlib import Path

from common.config import OUTPUT_DIR, SOURCE_PDF
from rendering.typst_page_renderer import build_book_typst_pdf
from translation.translations import load_translations


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a full translated PDF from per-page translation JSON files.")
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
    parser.add_argument("--start-page", type=int, default=0, help="Zero-based start page index.")
    parser.add_argument("--end-page", type=int, default=-1, help="Zero-based end page index, inclusive. -1 means last translated page.")
    return parser.parse_args()


def parse_page_idx(path: Path) -> int | None:
    stem = path.stem
    if not stem.startswith("page-"):
        return None
    page_part = stem.split("-")[1]
    if not page_part.isdigit():
        return None
    return int(page_part) - 1


def main() -> None:
    args = parse_args()
    translations_dir = OUTPUT_DIR / args.translations_dir
    if not translations_dir.exists():
        raise RuntimeError(f"Translations directory does not exist: {translations_dir}")

    translated_pages: dict[int, list[dict]] = {}
    for path in sorted(translations_dir.glob("page-*-deepseek.json")):
        page_idx = parse_page_idx(path)
        if page_idx is None:
            continue
        translated_pages[page_idx] = load_translations(path)

    if not translated_pages:
        raise RuntimeError(f"No translation files found in {translations_dir}")

    start_page = max(0, args.start_page)
    end_page = max(translated_pages) if args.end_page < 0 else args.end_page
    selected_pages = {
        page_idx: items
        for page_idx, items in translated_pages.items()
        if start_page <= page_idx <= end_page
    }
    if not selected_pages:
        raise RuntimeError(f"No translated pages selected in range {start_page}..{end_page}")

    output_pdf_path = OUTPUT_DIR / args.output
    build_book_typst_pdf(
        source_pdf_path=SOURCE_PDF,
        output_pdf_path=output_pdf_path,
        translated_pages=selected_pages,
    )
    print(f"built book pdf: {output_pdf_path}")
    print(f"pages rendered: {len(selected_pages)}")


if __name__ == "__main__":
    main()
