import argparse
import time
from pathlib import Path

import fitz

from common.config import OUTPUT_DIR, SOURCE_JSON, SOURCE_PDF
from ocr.json_extractor import extract_text_items, load_ocr_json
from rendering.pdf_overlay import save_optimized_pdf
from rendering.pdf_overlay import strip_page_links
from rendering.typst_page_renderer import overlay_translated_items_on_page
from translation.deepseek_client import DEFAULT_BASE_URL, get_api_key, normalize_base_url
from translation.translation_workflow import default_page_translation_name, translate_items_to_path
from translation.translations import load_translations


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Translate and render a full book in a page-by-page pipeline.",
    )
    parser.add_argument("--start-page", type=int, default=0, help="Zero-based start page index.")
    parser.add_argument("--end-page", type=int, default=-1, help="Zero-based end page index, inclusive. -1 means last page.")
    parser.add_argument("--batch-size", type=int, default=6, help="Number of text items per API call.")
    parser.add_argument("--workers", type=int, default=4, help="Concurrent translation requests per page.")
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
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    api_key = get_api_key(
        args.api_key,
        required=normalize_base_url(args.base_url) == normalize_base_url(DEFAULT_BASE_URL),
    )

    source_json = Path(args.source_json)
    source_pdf = Path(args.source_pdf)
    output_dir = OUTPUT_DIR / args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    output_pdf_path = OUTPUT_DIR / args.output

    data = load_ocr_json(source_json)
    pages = data.get("pdf_info", [])
    if not pages:
        raise RuntimeError("No pages found in OCR JSON.")

    start_page = max(0, args.start_page)
    end_page = len(pages) - 1 if args.end_page < 0 else min(args.end_page, len(pages) - 1)
    if start_page > end_page:
        raise RuntimeError(f"Invalid page range: start_page={start_page}, end_page={end_page}")

    doc = fitz.open(source_pdf)
    translate_started = time.perf_counter()
    translated_items_total = 0
    translated_pages = 0
    try:
        for page_idx in range(start_page, end_page + 1):
            items = extract_text_items(data, page_idx=page_idx)
            translation_path = output_dir / default_page_translation_name(page_idx)
            summary = translate_items_to_path(
                items=items,
                translation_path=translation_path,
                page_idx=page_idx,
                api_key=api_key,
                batch_size=args.batch_size,
                workers=max(1, args.workers),
                model=args.model,
                base_url=args.base_url,
                progress_label=f"page {page_idx + 1}/{len(pages)}",
            )
            translated_items = load_translations(translation_path)
            if 0 <= page_idx < len(doc):
                page = doc[page_idx]
                strip_page_links(page)
                overlay_translated_items_on_page(page, translated_items, stem=f"run-book-page-{page_idx + 1}")
            translated_items_total += summary["translated_items"]
            translated_pages += 1
            print(
                f"page {page_idx + 1}: translated {summary['translated_items']}/{summary['total_items']} "
                f"and rendered"
            )

        translate_elapsed = time.perf_counter() - translate_started
        save_started = time.perf_counter()
        save_optimized_pdf(doc, output_pdf_path)
        save_elapsed = time.perf_counter() - save_started
    finally:
        doc.close()

    total_elapsed = time.perf_counter() - translate_started
    print(f"translation dir: {output_dir}")
    print(f"output pdf: {output_pdf_path}")
    print(f"pages processed: {translated_pages}")
    print(f"translated items: {translated_items_total}")
    print(f"translate+render time: {translate_elapsed:.2f}s")
    print(f"save time: {save_elapsed:.2f}s")
    print(f"total time: {total_elapsed:.2f}s")


if __name__ == "__main__":
    main()
