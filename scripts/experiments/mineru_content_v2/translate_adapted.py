import argparse
import json
from pathlib import Path

import sys

sys.path.append(str(Path(__file__).resolve().parents[2]))

from translation.payload import protect_inline_formulas_in_segments
from translation.policy import apply_translation_policies
from translation.payload import apply_translated_text_map
from translation.payload import pending_translation_items
from translation.llm import translate_batch


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Translate MinerU content_list_v2 adapted intermediate JSON.")
    parser.add_argument(
        "--input",
        type=str,
        default="output/mineru/test9/intermediate/mineru_content_v2_adapted.json",
        help="Path to adapted intermediate JSON.",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="output/mineru/test9/intermediate/translations_v2",
        help="Directory for per-page translated JSON.",
    )
    parser.add_argument("--start-page", type=int, default=0, help="Zero-based start page.")
    parser.add_argument("--end-page", type=int, default=-1, help="Zero-based end page, inclusive. -1 means last page.")
    parser.add_argument("--batch-size", type=int, default=6, help="Items per translation batch.")
    parser.add_argument("--api-key", type=str, default="", help="Optional API key.")
    parser.add_argument("--model", type=str, default="Q3.5-turbo", help="Model name.")
    parser.add_argument("--base-url", type=str, default="http://1.94.67.196:10001/v1", help="OpenAI-compatible base URL.")
    parser.add_argument(
        "--mode",
        type=str,
        default="sci",
        choices=["fast", "precise", "sci"],
        help="Translation mode. Default is sci.",
    )
    parser.add_argument("--classify-batch-size", type=int, default=12, help="Classification batch size for precise mode.")
    parser.add_argument("--skip-title-translation", action="store_true", help="Skip title translation.")
    return parser.parse_args()


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def build_page_payload(blocks: list[dict]) -> list[dict]:
    payload: list[dict] = []
    for block in blocks:
        segments = block.get("segments", [])
        protected_source_text, formula_map = protect_inline_formulas_in_segments(segments)
        payload.append(
            {
                "item_id": block["item_id"],
                "page_idx": block["page_idx"],
                "block_idx": block["block_idx"],
                "block_type": block["block_type"],
                "bbox": block.get("bbox", []),
                "source_text": block.get("source_text", ""),
                "lines": [],
                "metadata": block.get("metadata", {}),
                "protected_source_text": protected_source_text,
                "formula_map": formula_map,
                "classification_label": "",
                "should_translate": bool(block.get("should_translate_default", False)),
                "protected_translated_text": "",
                "translated_text": "",
                "continuation_group": "",
                "continuation_prev_text": "",
                "continuation_next_text": "",
                "group_protected_source_text": "",
                "group_formula_map": [],
                "group_protected_translated_text": "",
                "group_translated_text": "",
                "segments": segments,
            }
        )
    return payload


def chunked(items: list[dict], size: int) -> list[list[dict]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def find_last_title_cutoff(pages: list[dict]) -> tuple[int | None, int | None]:
    last_page_idx = None
    last_block_idx = None
    for page_idx, page in enumerate(pages):
        for block in page.get("blocks", []):
            if block.get("block_type") == "title":
                last_page_idx = page_idx
                last_block_idx = block.get("block_idx")
    return last_page_idx, last_block_idx


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    data = load_json(input_path)
    pages = data.get("pages", [])
    if not pages:
        raise RuntimeError("No pages found in adapted intermediate JSON.")

    start_page = max(0, args.start_page)
    end_page = len(pages) - 1 if args.end_page < 0 else min(args.end_page, len(pages) - 1)
    sci_cutoff_page_idx, sci_cutoff_block_idx = find_last_title_cutoff(pages) if args.mode == "sci" else (None, None)

    total_translated = 0
    for page_idx in range(start_page, end_page + 1):
        page = pages[page_idx]
        payload = build_page_payload(page.get("blocks", []))
        classified_items, skip_summary = apply_translation_policies(
            payload=payload,
            mode=args.mode,
            classify_batch_size=max(1, args.classify_batch_size),
            api_key=args.api_key,
            model=args.model,
            base_url=args.base_url,
            skip_title_translation=args.skip_title_translation,
            page_idx=page_idx,
            sci_cutoff_page_idx=sci_cutoff_page_idx,
            sci_cutoff_block_idx=sci_cutoff_block_idx,
        )
        if classified_items:
            print(f"page {page_idx + 1}: classified {classified_items} items")
        if args.mode == "sci":
            if skip_summary["title_skipped"]:
                print(f"page {page_idx + 1}: skipped {skip_summary['title_skipped']} title items")
            if skip_summary["tail_skipped"]:
                print(f"page {page_idx + 1}: skipped {skip_summary['tail_skipped']} items after the last title cutoff")
        elif args.skip_title_translation and skip_summary["title_skipped"]:
            print(f"page {page_idx + 1}: skipped {skip_summary['title_skipped']} title items")
        pending = pending_translation_items(payload)
        batches = chunked(pending, max(1, args.batch_size))
        for batch_index, batch in enumerate(batches, start=1):
            translated = translate_batch(
                batch,
                api_key=args.api_key,
                model=args.model,
                base_url=args.base_url,
                request_label=f"mineru-v2 page {page_idx + 1} batch {batch_index}/{len(batches)}",
            )
            apply_translated_text_map(payload, translated)
        output_path = output_dir / f"page-{page_idx + 1:03d}.json"
        save_json(output_path, payload)
        translated_count = sum(1 for item in payload if (item.get("translated_text") or "").strip())
        total_translated += translated_count
        print(f"page {page_idx + 1}: translated {translated_count}/{len(payload)} -> {output_path}")

    print(f"pages: {end_page - start_page + 1}")
    print(f"translated items: {total_translated}")
    print(f"output dir: {output_dir}")


if __name__ == "__main__":
    main()
