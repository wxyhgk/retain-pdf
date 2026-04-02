from __future__ import annotations

import argparse
import json
from pathlib import Path
from statistics import median
import sys

sys.path.append(str(Path(__file__).resolve().parents[3]))

from services.mineru.contracts import MINERU_LAYOUT_JSON_FILE_NAME


DEFAULT_LAYOUT = Path("/home/wxyhgk/tmp/Code/output/20260329083711-18ea65/ocr/unpacked") / MINERU_LAYOUT_JSON_FILE_NAME
TEXTUAL_TYPES = {"text", "list", "title", "image_caption", "table_caption", "table_footnote"}


def _line_boxes(block: dict) -> list[list[float]]:
    boxes: list[list[float]] = []
    for line in block.get("lines", []) or []:
        bbox = line.get("bbox", [])
        if len(bbox) == 4 and bbox[2] > bbox[0] and bbox[3] > bbox[1]:
            boxes.append([float(v) for v in bbox])
    return boxes


def _block_preview(block: dict, limit: int = 140) -> str:
    chunks: list[str] = []
    for line in block.get("lines", []) or []:
        for span in line.get("spans", []) or []:
            content = str(span.get("content", "") or "").strip()
            if content:
                chunks.append(content)
    return " ".join(chunks)[:limit]


def _first_line_indent_pt(line_boxes: list[list[float]]) -> float:
    if len(line_boxes) < 3:
        return 0.0
    first_x0 = line_boxes[0][0]
    rest_x0 = [box[0] for box in line_boxes[1:]]
    return first_x0 - median(rest_x0)


def _rest_left_jitter_pt(line_boxes: list[list[float]]) -> float:
    if len(line_boxes) < 3:
        return 0.0
    rest_x0 = [box[0] for box in line_boxes[1:]]
    center = median(rest_x0)
    return max(abs(x - center) for x in rest_x0)


def detect_first_line_indent_blocks(page: dict) -> list[dict]:
    detected: list[dict] = []
    for block_idx, block in enumerate(page.get("para_blocks", []) or []):
        if str(block.get("type", "") or "") not in TEXTUAL_TYPES:
            continue
        line_boxes = _line_boxes(block)
        if len(line_boxes) < 3:
            continue
        indent_pt = _first_line_indent_pt(line_boxes)
        rest_jitter_pt = _rest_left_jitter_pt(line_boxes)
        block_bbox = block.get("bbox", [])
        block_width = float(block_bbox[2] - block_bbox[0]) if len(block_bbox) == 4 else 0.0
        indent_threshold = max(6.0, block_width * 0.03)
        if indent_pt >= indent_threshold and rest_jitter_pt <= 3.0:
            detected.append(
                {
                    "block_idx": block_idx,
                    "type": block.get("type"),
                    "bbox": block_bbox,
                    "line_count": len(line_boxes),
                    "indent_pt": round(indent_pt, 2),
                    "rest_jitter_pt": round(rest_jitter_pt, 2),
                    "preview": _block_preview(block),
                }
            )
    return detected


def summarize_page_geometry(page: dict) -> dict[str, int]:
    textual_blocks = 0
    multiline_textual_blocks = 0
    single_line_textual_blocks = 0
    for block in page.get("para_blocks", []) or []:
        if str(block.get("type", "") or "") not in TEXTUAL_TYPES:
            continue
        textual_blocks += 1
        line_count = len(_line_boxes(block))
        if line_count >= 2:
            multiline_textual_blocks += 1
        else:
            single_line_textual_blocks += 1
    return {
        "textual_blocks": textual_blocks,
        "multiline_textual_blocks": multiline_textual_blocks,
        "single_line_textual_blocks": single_line_textual_blocks,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description=f"Debug probe: inspect raw OCR layout geometry for first-line-indent detection. This reads raw {MINERU_LAYOUT_JSON_FILE_NAME} on purpose and is not a mainline OCR consumer.",
    )
    parser.add_argument("--layout", type=Path, default=DEFAULT_LAYOUT, help=f"Raw OCR {MINERU_LAYOUT_JSON_FILE_NAME} path used only for this geometry probe.")
    parser.add_argument("--page", type=int, default=1, help="1-based page number to inspect.")
    args = parser.parse_args()

    data = json.loads(args.layout.read_text(encoding="utf-8"))
    pages = data.get("pdf_info", [])
    page_idx = args.page - 1
    if page_idx < 0 or page_idx >= len(pages):
        raise SystemExit(f"page {args.page} out of range, total pages={len(pages)}")
    page = pages[page_idx]

    summary = summarize_page_geometry(page)
    detected = detect_first_line_indent_blocks(page)

    print(f"layout: {args.layout}")
    print(f"page: {args.page}")
    print(
        "geometry summary:",
        f"textual_blocks={summary['textual_blocks']}",
        f"multiline_textual_blocks={summary['multiline_textual_blocks']}",
        f"single_line_textual_blocks={summary['single_line_textual_blocks']}",
    )

    if not detected:
        print("first-line indent detections: 0")
        if summary["multiline_textual_blocks"] == 0:
            print(
                "probe result: current OCR on this page collapses each textual paragraph into a single oversized line bbox; "
                "line-based first-line-indent detection is not reliable on this sample."
            )
        else:
            print("probe result: this page has multiline OCR geometry, but no block met the first-line-indent threshold.")
        return 0

    print(f"first-line indent detections: {len(detected)}")
    for item in detected:
        print(
            f"block={item['block_idx']} type={item['type']} line_count={item['line_count']} "
            f"indent_pt={item['indent_pt']} rest_jitter_pt={item['rest_jitter_pt']} bbox={item['bbox']}"
        )
        print(f"  preview={item['preview']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
