import argparse
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from foundation.config import fonts
from foundation.config import paths
from foundation.config import runtime
from foundation.shared.schema_cli import SOURCE_JSON_MAINLINE_HELP
from services.translation.ocr.json_extractor import extract_text_items, load_ocr_json
from services.rendering.api.pdf_overlay import build_dev_pdf, build_single_page_dev_pdf, extract_single_page_pdf
from services.rendering.api.typst_page_renderer import build_single_page_typst_pdf
from services.translation.payload import ensure_translation_template, load_translations


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a layout-preserving translated PDF page.")
    parser.add_argument("--page", type=int, default=runtime.DEFAULT_PAGE_INDEX, help="Zero-based page index.")
    parser.add_argument(
        "--translation-json",
        type=str,
        default="",
        help="Optional translation JSON path. If absent, a template is generated first.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=runtime.DEFAULT_OUTPUT_NAME,
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
        choices=["default", "overlay", "direct", "typst"],
        help="Rendering mode for translated overlay. direct is a compatibility alias for overlay.",
    )
    parser.add_argument(
        "--source-json",
        type=str,
        default=str(paths.SOURCE_JSON),
        help=SOURCE_JSON_MAINLINE_HELP,
    )
    parser.add_argument(
        "--source-pdf",
        type=str,
        default=str(paths.SOURCE_PDF),
        help="Source PDF path.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    source_json = Path(args.source_json)
    source_pdf = Path(args.source_pdf)
    data = load_ocr_json(source_json)
    items = extract_text_items(data, page_idx=args.page)

    translation_path = (
        paths.TRANSLATIONS_DIR / f"page-{args.page + 1}.json"
        if not args.translation_json
        else paths.OUTPUT_DIR / args.translation_json
    )
    ensure_translation_template(items, translation_path, page_idx=args.page)

    translated_items = load_translations(translation_path)
    output_pdf_path = paths.OUTPUT_DIR / args.output
    if args.extract_original_only:
        extract_single_page_pdf(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf_path,
            page_idx=args.page,
        )
    elif args.single_page and args.render_mode in {"typst", "overlay", "direct"}:
        build_single_page_typst_pdf(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf_path,
            translated_items=translated_items,
            page_idx=args.page,
        )
    elif args.single_page:
        build_single_page_dev_pdf(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf_path,
            translated_items=translated_items,
            page_idx=args.page,
            font_path=fonts.DEFAULT_FONT_PATH,
        )
    else:
        build_dev_pdf(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf_path,
            translated_items=translated_items,
            page_idx=args.page,
            font_path=fonts.DEFAULT_FONT_PATH,
        )
    print(f"translation json: {translation_path}")
    print(f"output pdf: {output_pdf_path}")


if __name__ == "__main__":
    main()
