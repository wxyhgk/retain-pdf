import argparse

from common.config import OUTPUT_DIR, SOURCE_JSON, TRANSLATIONS_DIR
from ocr.json_extractor import extract_text_items, load_ocr_json
from translation.deepseek_client import get_api_key
from translation.translation_workflow import translate_items_to_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Translate page text items with DeepSeek.")
    parser.add_argument("--page", type=int, default=0, help="Zero-based page index.")
    parser.add_argument("--batch-size", type=int, default=8, help="Number of text items per API call.")
    parser.add_argument("--api-key", type=str, default="", help="DeepSeek API key. Prefer env DEEPSEEK_API_KEY.")
    parser.add_argument("--model", type=str, default="deepseek-chat", help="DeepSeek model name.")
    parser.add_argument(
        "--translation-json",
        type=str,
        default="",
        help="Optional translation JSON path under output/.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    api_key = get_api_key(args.api_key)

    data = load_ocr_json(SOURCE_JSON)
    items = extract_text_items(data, page_idx=args.page)
    translation_path = (
        TRANSLATIONS_DIR / f"page-{args.page + 1}.json"
        if not args.translation_json
        else OUTPUT_DIR / args.translation_json
    )
    summary = translate_items_to_path(
        items=items,
        translation_path=translation_path,
        page_idx=args.page,
        api_key=api_key,
        batch_size=args.batch_size,
        model=args.model,
    )

    print(f"translation json updated: {summary['translation_path']}")


if __name__ == "__main__":
    main()
