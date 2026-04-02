import argparse
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from foundation.config import paths
from foundation.shared.schema_cli import SOURCE_JSON_MAINLINE_HELP
from services.translation.ocr.json_extractor import extract_text_items, load_ocr_json
from services.translation.llm import DEFAULT_BASE_URL, get_api_key, normalize_base_url
from services.translation.workflow import translate_items_to_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Translate page text items with DeepSeek.")
    parser.add_argument("--page", type=int, default=0, help="Zero-based page index.")
    parser.add_argument("--batch-size", type=int, default=8, help="Number of text items per API call.")
    parser.add_argument("--workers", type=int, default=1, help="Concurrent translation requests per page.")
    parser.add_argument(
        "--mode",
        type=str,
        default="fast",
        choices=["fast", "precise", "sci"],
        help="Translation mode. sci is the academic-paper mode: skip titles and all content after the last title in the whole document when available.",
    )
    parser.add_argument(
        "--skip-title-translation",
        action="store_true",
        help="Do not translate OCR blocks with block_type=title.",
    )
    parser.add_argument("--classify-batch-size", type=int, default=12, help="Number of suspicious items per classification API call.")
    parser.add_argument("--rule-profile-name", type=str, default="general_sci", help="Built-in rule profile name.")
    parser.add_argument("--custom-rules-text", type=str, default="", help="Extra rule text injected into model context.")
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
        default=str(paths.SOURCE_JSON),
        help=SOURCE_JSON_MAINLINE_HELP,
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
        paths.TRANSLATIONS_DIR / f"page-{args.page + 1}.json"
        if not args.translation_json
        else paths.OUTPUT_DIR / args.translation_json
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
        mode=args.mode,
        classify_batch_size=max(1, args.classify_batch_size),
        skip_title_translation=args.skip_title_translation,
        rule_profile_name=args.rule_profile_name,
        custom_rules_text=args.custom_rules_text,
    )

    print(f"translation json updated: {summary['translation_path']}")


if __name__ == "__main__":
    main()
