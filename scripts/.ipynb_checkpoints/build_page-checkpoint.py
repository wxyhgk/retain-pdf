import argparse

from config import (
    DEFAULT_FONT_PATH,
    DEFAULT_OUTPUT_NAME,
    DEFAULT_PAGE_INDEX,
    OUTPUT_DIR,
    SOURCE_JSON,
    SOURCE_PDF,
    TRANSLATIONS_DIR,
)
from json_extractor import extract_text_items, load_ocr_json
from pdf_overlay import build_dev_pdf, build_single_page_dev_pdf, extract_single_page_pdf
from typst_page_renderer import build_single_page_typst_pdf
from translations import ensure_translation_template, load_translations


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a layout-preserving translated PDF page.")
    parser.add_argument("--page", type=int, default=DEFAULT_PAGE_INDEX, help="Zero-based page index.")
    parser.add_argument(
        "--translation-json",
        type=str,
        default="",
        help="Optional translation JSON path. If absent, a template is generated first.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=DEFAULT_OUTPUT_NAME,
        help="Output PDF filename placed under output/.",
    )
    parser.add_argument(
        "--single-page",
        action="store_true",
        help="Export only the selected page instead of the full source PDF.",
    )
    parser.add_argument(
        "--extract-original-only",
        action="store_true",
        help="Only extract the selected original page to output PDF without overlay.",
    )
    parser.add_argument(
        "--render-mode",
        type=str,
        default="default",
        choices=["default", "typst"],
        help="Rendering mode for translated overlay.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    data = load_ocr_json(SOURCE_JSON)
    items = extract_text_items(data, page_idx=args.page)

    translation_path = (
        TRANSLATIONS_DIR / f"page-{args.page + 1}.json"
        if not args.translation_json
        else OUTPUT_DIR / args.translation_json
    )
    ensure_translation_template(items, translation_path, page_idx=args.page)

    translated_items = load_translations(translation_path)
    output_pdf_path = OUTPUT_DIR / args.output
    if args.extract_original_only:
        extract_single_page_pdf(
            source_pdf_path=SOURCE_PDF,
            output_pdf_path=output_pdf_path,
            page_idx=args.page,
        )
    elif args.single_page and args.render_mode == "typst":
        build_single_page_typst_pdf(
            source_pdf_path=SOURCE_PDF,
            output_pdf_path=output_pdf_path,
            translated_items=translated_items,
            page_idx=args.page,
        )
    elif args.single_page:
        build_single_page_dev_pdf(
            source_pdf_path=SOURCE_PDF,
            output_pdf_path=output_pdf_path,
            translated_items=translated_items,
            page_idx=args.page,
            font_path=DEFAULT_FONT_PATH,
        )
    else:
        build_dev_pdf(
            source_pdf_path=SOURCE_PDF,
            output_pdf_path=output_pdf_path,
            translated_items=translated_items,
            page_idx=args.page,
            font_path=DEFAULT_FONT_PATH,
        )
    print(f"translation json: {translation_path}")
    print(f"output pdf: {output_pdf_path}")


if __name__ == "__main__":
    main()
