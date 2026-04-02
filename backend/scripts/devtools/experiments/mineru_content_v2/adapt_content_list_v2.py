import argparse
import json
from collections import Counter
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[3]))

from services.mineru.contracts import MINERU_CONTENT_LIST_V2_FILE_NAME


TEXTUAL_BLOCK_TYPES = {
    "title",
    "paragraph",
    "page_header",
    "page_footer",
    "page_number",
}
NON_TRANSLATABLE_BLOCK_TYPES = {
    "image",
    "table",
    "equation_interline",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Experiment helper: adapt MinerU content_list_v2.json into an intermediate JSON for research. This is not the mainline OCR input contract.",
    )
    parser.add_argument(
        "--input",
        type=str,
        default=f"output/mineru/test9/unpacked/{MINERU_CONTENT_LIST_V2_FILE_NAME}",
        help=f"Path to MinerU {MINERU_CONTENT_LIST_V2_FILE_NAME} experimental input.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="output/mineru/test9/intermediate/mineru_content_v2_adapted.json",
        help="Path to adapted experimental intermediate JSON output.",
    )
    return parser.parse_args()


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def normalize_segment(segment: dict) -> dict:
    seg_type = segment.get("type", "")
    content = segment.get("content", "")
    if seg_type == "equation_inline":
        return {
            "type": "inline_equation",
            "content": content,
        }
    return {
        "type": "text",
        "content": content,
    }


def extract_segments_from_content_list(content_list: list[dict]) -> list[dict]:
    return [normalize_segment(segment) for segment in content_list if isinstance(segment, dict)]


def extract_textual_block(block: dict, page_idx: int, block_idx: int) -> dict:
    block_type = block.get("type", "")
    content = block.get("content", {})
    bbox = block.get("bbox", [])

    key_map = {
        "title": "title_content",
        "paragraph": "paragraph_content",
        "page_header": "page_header_content",
        "page_footer": "page_footer_content",
        "page_number": "page_number_content",
    }
    content_key = key_map[block_type]
    segments = extract_segments_from_content_list(content.get(content_key, []))
    source_text = "".join(segment.get("content", "") for segment in segments).strip()
    return {
        "item_id": f"p{page_idx + 1:03d}-b{block_idx:03d}",
        "page_idx": page_idx,
        "block_idx": block_idx,
        "block_type": block_type,
        "bbox": bbox,
        "segments": segments,
        "source_text": source_text,
        "should_translate_default": block_type not in {"page_header", "page_footer", "page_number"},
        "metadata": {
            "source_format": "mineru_content_list_v2",
            "title_level": content.get("level") if block_type == "title" else None,
        },
        "raw_content": content,
    }


def extract_list_blocks(block: dict, page_idx: int, block_idx: int) -> list[dict]:
    content = block.get("content", {})
    bbox = block.get("bbox", [])
    list_type = content.get("list_type", "")
    results: list[dict] = []
    for item_index, list_item in enumerate(content.get("list_items", [])):
        item_content = list_item.get("item_content", [])
        segments = extract_segments_from_content_list(item_content)
        source_text = "".join(segment.get("content", "") for segment in segments).strip()
        results.append(
            {
                "item_id": f"p{page_idx + 1:03d}-b{block_idx:03d}-i{item_index:03d}",
                "page_idx": page_idx,
                "block_idx": block_idx,
                "block_type": "list_item",
                "bbox": bbox,
                "segments": segments,
                "source_text": source_text,
                "should_translate_default": True,
                "metadata": {
                    "source_format": "mineru_content_list_v2",
                    "parent_block_type": "list",
                    "list_type": list_type,
                    "list_item_type": list_item.get("item_type", ""),
                    "list_item_index": item_index,
                },
                "raw_content": list_item,
            }
        )
    return results


def extract_non_text_block(block: dict, page_idx: int, block_idx: int) -> dict:
    block_type = block.get("type", "")
    return {
        "item_id": f"p{page_idx + 1:03d}-b{block_idx:03d}",
        "page_idx": page_idx,
        "block_idx": block_idx,
        "block_type": block_type,
        "bbox": block.get("bbox", []),
        "segments": [],
        "source_text": "",
        "should_translate_default": False,
        "metadata": {
            "source_format": "mineru_content_list_v2",
        },
        "raw_content": block.get("content", {}),
    }


def normalize_page_blocks(page: list, page_idx: int) -> list[dict]:
    normalized: list[dict] = []
    for block_idx, block in enumerate(page):
        if not isinstance(block, dict):
            continue
        block_type = block.get("type", "")
        if block_type in TEXTUAL_BLOCK_TYPES:
            normalized.append(extract_textual_block(block, page_idx, block_idx))
            continue
        if block_type == "list":
            normalized.extend(extract_list_blocks(block, page_idx, block_idx))
            continue
        if block_type in NON_TRANSLATABLE_BLOCK_TYPES:
            normalized.append(extract_non_text_block(block, page_idx, block_idx))
            continue
        normalized.append(
            {
                "item_id": f"p{page_idx + 1:03d}-b{block_idx:03d}",
                "page_idx": page_idx,
                "block_idx": block_idx,
                "block_type": block_type or "unknown",
                "bbox": block.get("bbox", []),
                "segments": [],
                "source_text": "",
                "should_translate_default": False,
                "metadata": {
                    "source_format": "mineru_content_list_v2",
                    "unhandled_block_type": block_type or "unknown",
                },
                "raw_content": block.get("content", {}),
            }
        )
    return normalized


def adapt_content_list_v2(data: list) -> dict:
    pages: list[dict] = []
    block_counter: Counter = Counter()
    translatable_blocks = 0

    for page_idx, page in enumerate(data):
        normalized_blocks = normalize_page_blocks(page, page_idx)
        for block in normalized_blocks:
            block_counter[block["block_type"]] += 1
            if block["should_translate_default"]:
                translatable_blocks += 1
        pages.append(
            {
                "page_idx": page_idx,
                "source_block_count": len(page) if isinstance(page, list) else 0,
                "normalized_block_count": len(normalized_blocks),
                "blocks": normalized_blocks,
            }
        )

    return {
        "source_format": "mineru_content_list_v2",
        "page_count": len(pages),
        "translatable_block_count": translatable_blocks,
        "block_type_counts": dict(block_counter),
        "pages": pages,
    }


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    data = load_json(input_path)
    if not isinstance(data, list):
        raise RuntimeError("Expected content_list_v2 top-level structure to be a list of pages.")

    adapted = adapt_content_list_v2(data)
    save_json(output_path, adapted)

    print(f"input: {input_path}")
    print(f"output: {output_path}")
    print(f"pages: {adapted['page_count']}")
    print(f"translatable blocks: {adapted['translatable_block_count']}")
    print(f"block types: {adapted['block_type_counts']}")


if __name__ == "__main__":
    main()
