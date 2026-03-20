import json
from pathlib import Path

from ocr.models import TextItem


def load_ocr_json(json_path: Path) -> dict:
    with json_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def normalize_text(raw_text: str) -> str:
    return " ".join(raw_text.split())


def iter_block_lines(block: dict):
    if block.get("lines"):
        yield from block.get("lines", [])
    for child in block.get("blocks", []):
        yield from iter_block_lines(child)


def block_segments(block: dict) -> list[dict]:
    segments: list[dict] = []
    for line in iter_block_lines(block):
        for span in line.get("spans", []):
            content = span.get("content", "")
            if not content or not content.strip():
                continue
            segments.append(
                {
                    "type": span.get("type", "text"),
                    "content": normalize_text(content),
                }
            )
    return segments


def block_lines(block: dict) -> list[dict]:
    lines_out: list[dict] = []
    for line in iter_block_lines(block):
        spans_out = []
        for span in line.get("spans", []):
            content = span.get("content", "")
            if not content or not content.strip():
                continue
            spans_out.append(
                {
                    "type": span.get("type", "text"),
                    "content": normalize_text(content),
                    "bbox": span.get("bbox", []),
                }
            )
        if spans_out:
            lines_out.append(
                {
                    "bbox": line.get("bbox", []),
                    "spans": spans_out,
                }
            )
    return lines_out


def merge_segments_text(segments: list[dict]) -> str:
    return normalize_text(" ".join(segment["content"] for segment in segments if segment["content"]))


SKIP_BLOCK_TYPES = {
    "interline_equation",
    "code",
    "table",
    "ref_text",
    "image",
    "image_body",
}


def should_translate_block(block: dict, text: str) -> bool:
    block_type = block.get("type", "unknown")
    if block_type in SKIP_BLOCK_TYPES:
        return False
    return True


def extract_block_item(
    block: dict,
    page_idx: int,
    block_idx: int,
    item_suffix: str = "",
) -> TextItem | None:
    segments = block_segments(block)
    lines = block_lines(block)
    text = merge_segments_text(segments)
    if not text:
        return None
    if not should_translate_block(block, text):
        return None
    return TextItem(
        item_id=f"p{page_idx + 1:03d}-b{block_idx:03d}{item_suffix}",
        page_idx=page_idx,
        block_idx=block_idx,
        block_type=block.get("type", "unknown"),
        bbox=block.get("bbox", []),
        text=text,
        segments=segments,
        lines=lines,
    )


def extract_text_items(data: dict, page_idx: int) -> list[TextItem]:
    pages = data.get("pdf_info", [])
    if page_idx >= len(pages):
        raise IndexError(f"page_idx {page_idx} out of range; total pages={len(pages)}")

    page = pages[page_idx]
    items: list[TextItem] = []
    for block_idx, block in enumerate(page.get("para_blocks", [])):
        if block.get("type") == "list" and block.get("blocks"):
            for child_idx, child in enumerate(block.get("blocks", [])):
                item = extract_block_item(
                    child,
                    page_idx=page_idx,
                    block_idx=block_idx,
                    item_suffix=f"-i{child_idx:03d}",
                )
                if item is not None:
                    items.append(item)
            continue

        item = extract_block_item(block, page_idx=page_idx, block_idx=block_idx)
        if item is not None:
            items.append(item)
    return items
