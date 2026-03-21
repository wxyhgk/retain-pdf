import json
import re
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


def _bbox_left(item: TextItem) -> float:
    return item.bbox[0] if len(item.bbox) == 4 else 0.0


def _bbox_top(item: TextItem) -> float:
    return item.bbox[1] if len(item.bbox) == 4 else 0.0


def _bbox_bottom(item: TextItem) -> float:
    return item.bbox[3] if len(item.bbox) == 4 else 0.0


def _bbox_width(item: TextItem) -> float:
    return item.bbox[2] - item.bbox[0] if len(item.bbox) == 4 else 0.0


def _gap_y(prev_item: TextItem, next_item: TextItem) -> float:
    return _bbox_top(next_item) - _bbox_bottom(prev_item)


def _single_line(item: TextItem) -> bool:
    return len(item.lines) <= 1


def _text_len(item: TextItem) -> int:
    return len(re.sub(r"\s+", "", item.text))


def _leading_symbol(item: TextItem) -> str:
    stripped = item.text.strip()
    if not stripped:
        return ""
    return stripped[0]


def _looks_like_index_entry(item: TextItem) -> bool:
    text = item.text.strip()
    if not text or not _single_line(item):
        return False
    if len(text) > 48:
        return False
    return _leading_symbol(item) in {"♢", "•", "▪", "◦"}


def _looks_like_option_header(item: TextItem) -> bool:
    text = item.text.strip()
    if not text or not _single_line(item):
        return False
    if len(text) > 80:
        return False
    if text.startswith(("%", "#", "\\")):
        return True
    if re.fullmatch(r"[A-Za-z][\w.-]*\s*=\s*[\w<>{},.-]+", text):
        return True
    return False


def _looks_like_explanatory_paragraph(item: TextItem) -> bool:
    text = item.text.strip()
    words = re.findall(r"[A-Za-z]{3,}", text)
    return len(words) >= 8 and len(item.lines) >= 1


def _looks_like_example_intro(item: TextItem) -> bool:
    text = item.text.strip()
    if len(text) > 260:
        return False
    return text.endswith(":") and bool(re.search(r"(input|example|following|via|look like this|as follows|by)\s*:\s*$", text, re.I))


def _looks_like_structured_example_line(item: TextItem) -> bool:
    text = item.text.strip()
    if not text or len(text) > 96:
        return False
    if re.fullmatch(r"[A-Z][a-z]?\s+-?\d+\.\d+\s+-?\d+\.\d+\s+-?\d+\.\d+", text):
        return True
    if re.fullmatch(r"\d+\s+\d+\s+[A-Za-z]+", text):
        return True
    if re.fullmatch(r"[A-Za-z][\w.-]*\s+<[^<>\n]+>", text):
        return True
    if re.fullmatch(r"[A-Za-z][\w.-]*(?:\s+-[\w-]+(?:\s+\S+)*)+", text):
        return True
    if re.fullmatch(r"[A-Z][A-Z_ ]+\s*=\s*[\w.+-]+", text):
        return True
    return False


def _apply_page_structure(items: list[TextItem]) -> list[TextItem]:
    for item in items:
        item.metadata = {
            "structure_role": "body",
            "structure_group": "",
            "pair_with": "",
        }

    group_counter = 0

    def new_group(prefix: str) -> str:
        nonlocal group_counter
        group_counter += 1
        return f"{prefix}-{group_counter:03d}"

    i = 0
    while i < len(items):
        item = items[i]
        if _looks_like_index_entry(item):
            symbol = _leading_symbol(item)
            run = [item]
            j = i + 1
            while j < len(items):
                nxt = items[j]
                if (
                    _looks_like_index_entry(nxt)
                    and _leading_symbol(nxt) == symbol
                    and abs(_bbox_left(nxt) - _bbox_left(item)) <= 20
                    and _gap_y(items[j - 1], nxt) <= 18
                ):
                    run.append(nxt)
                    j += 1
                    continue
                break
            if len(run) >= 6:
                group_id = new_group("index")
                for entry in run:
                    entry.metadata["structure_role"] = "index_entry"
                    entry.metadata["structure_group"] = group_id
                i = j
                continue
        i += 1

    for idx in range(len(items) - 1):
        item = items[idx]
        nxt = items[idx + 1]
        if item.metadata["structure_role"] != "body" or nxt.metadata["structure_role"] != "body":
            continue
        if (
            _looks_like_option_header(item)
            and _looks_like_explanatory_paragraph(nxt)
            and abs(_bbox_left(item) - _bbox_left(nxt)) <= 30
            and _gap_y(item, nxt) <= 24
        ):
            group_id = new_group("option")
            item.metadata["structure_role"] = "option_header"
            item.metadata["structure_group"] = group_id
            item.metadata["pair_with"] = nxt.item_id
            nxt.metadata["structure_role"] = "option_description"
            nxt.metadata["structure_group"] = group_id
            nxt.metadata["pair_with"] = item.item_id

    for idx, item in enumerate(items):
        if item.metadata["structure_role"] != "body":
            continue
        if not _looks_like_example_intro(item):
            continue
        run: list[TextItem] = []
        j = idx + 1
        while j < len(items):
            nxt = items[j]
            if nxt.metadata["structure_role"] != "body":
                break
            if _looks_like_structured_example_line(nxt) or (_single_line(nxt) and _text_len(nxt) <= 36 and _gap_y(items[j - 1], nxt) <= 20):
                run.append(nxt)
                j += 1
                continue
            break
        if len(run) >= 2:
            group_id = new_group("example")
            item.metadata["structure_role"] = "example_intro"
            item.metadata["structure_group"] = group_id
            for entry in run:
                entry.metadata["structure_role"] = "example_line"
                entry.metadata["structure_group"] = group_id

    return items


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
        metadata={},
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
    return _apply_page_structure(items)
