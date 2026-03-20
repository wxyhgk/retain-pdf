import argparse
from pathlib import Path

from common.config import OUTPUT_DIR, SOURCE_JSON, TRANSLATIONS_DIR
from ocr.json_extractor import extract_text_items, load_ocr_json
from translation.deepseek_client import DEFAULT_BASE_URL, get_api_key, normalize_base_url
from translation.translation_workflow import translate_items_to_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Translate page text items with DeepSeek.")
    parser.add_argument("--page", type=int, default=0, help="Zero-based page index.")
    parser.add_argument("--batch-size", type=int, default=8, help="Number of text items per API call.")
    parser.add_argument("--workers", type=int, default=1, help="Concurrent translation requests per page.")
    parser.add_argument("--api-key", type=str, default="", help="Optional API key. Prefer env DEEPSEEK_API_KEY.")
    parser.add_argument("--model", type=str, default="deepseek-chat", help="Model name.")
    parser.add_argument(
        "--base-url",
        type=str,
        default="https://api.deepseek.com/v1",
        help="OpenAI-compatible API base URL ending with /v1.",
    )
    parser.add_argument(
        "--translation-json",
        type=str,
        default="",
        help="Optional translation JSON path under output/.",
    )
    parser.add_argument(
        "--source-json",
        type=str,
        default=str(SOURCE_JSON),
        help="OCR JSON source path.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    api_key = get_api_key(
        args.api_key,
        required=normalize_base_url(args.base_url) == normalize_base_url(DEFAULT_BASE_URL),
    )

    data = load_ocr_json(Path(args.source_json))
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
        workers=max(1, args.workers),
        model=args.model,
        base_url=args.base_url,
    )

    print(f"translation json updated: {summary['translation_path']}")


if __name__ == "__main__":
    main()
