import argparse
from pathlib import Path

from common.config import OUTPUT_DIR, SOURCE_JSON
from ocr.json_extractor import extract_text_items, load_ocr_json
from translation.deepseek_client import get_api_key
from translation.translation_workflow import default_page_translation_name, translate_items_to_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Translate all pages in the OCR JSON with DeepSeek.")
    parser.add_argument("--start-page", type=int, default=0, help="Zero-based start page index.")
    parser.add_argument("--end-page", type=int, default=-1, help="Zero-based end page index, inclusive. -1 means last page.")
    parser.add_argument("--batch-size", type=int, default=8, help="Number of text items per API call.")
    parser.add_argument("--api-key", type=str, default="", help="DeepSeek API key. Prefer env DEEPSEEK_API_KEY.")
    parser.add_argument("--model", type=str, default="deepseek-chat", help="DeepSeek model name.")
    parser.add_argument(
        "--output-dir",
        type=str,
        default="translations/book",
        help="Output directory under output/ for per-page translation JSON files.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    api_key = get_api_key(args.api_key)
    output_dir = OUTPUT_DIR / args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    data = load_ocr_json(SOURCE_JSON)
    pages = data.get("pdf_info", [])
    if not pages:
        raise RuntimeError("No pages found in OCR JSON.")

    start_page = max(0, args.start_page)
    end_page = len(pages) - 1 if args.end_page < 0 else min(args.end_page, len(pages) - 1)
    if start_page > end_page:
        raise RuntimeError(f"Invalid page range: start_page={start_page}, end_page={end_page}")

    summaries = []
    for page_idx in range(start_page, end_page + 1):
        items = extract_text_items(data, page_idx=page_idx)
        translation_path = output_dir / default_page_translation_name(page_idx)
        summary = translate_items_to_path(
            items=items,
            translation_path=translation_path,
            page_idx=page_idx,
            api_key=api_key,
            batch_size=args.batch_size,
            model=args.model,
            progress_label=f"page {page_idx + 1}/{len(pages)}",
        )
        summaries.append(summary)
        print(
            f"page {page_idx + 1}: {summary['translated_items']}/{summary['total_items']} translated "
            f"-> {summary['translation_path']}"
        )

    total_items = sum(item["total_items"] for item in summaries)
    translated_items = sum(item["translated_items"] for item in summaries)
    print(
        f"book translation completed: {translated_items}/{total_items} items translated "
        f"across {len(summaries)} pages into {output_dir}"
    )


if __name__ == "__main__":
    main()
