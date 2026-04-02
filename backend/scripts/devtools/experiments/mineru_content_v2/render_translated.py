import argparse
from difflib import SequenceMatcher
import json
from pathlib import Path
import re

import sys

sys.path.append(str(Path(__file__).resolve().parents[3]))

from services.mineru.contracts import MINERU_LAYOUT_JSON_FILE_NAME
from services.rendering.api.typst_page_renderer import build_book_typst_pdf


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Experiment helper: render translated content_list_v2 experiment JSONs into a PDF. This does not redefine the mainline OCR input contract.",
    )
    parser.add_argument(
        "--translations-dir",
        type=str,
        default="output/mineru/test9/intermediate/translations_v2_page1",
        help="Directory containing per-page translated JSON files from translate_adapted.py",
    )
    parser.add_argument(
        "--source-pdf",
        type=str,
        default="Data/test9/test9.pdf",
        help="Source PDF path used as page background.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="output/mineru/test9/intermediate/test9-mineru-v2-render.pdf",
        help="Rendered output PDF path.",
    )
    parser.add_argument(
        "--layout-json",
        type=str,
        default=f"output/mineru/test9/unpacked/{MINERU_LAYOUT_JSON_FILE_NAME}",
        help=f"Optional raw MinerU {MINERU_LAYOUT_JSON_FILE_NAME} used only for experiment-time bbox/line alignment before rendering.",
    )
    return parser.parse_args()


def load_page_json(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _normalize_text(text: str) -> str:
    compact = re.sub(r"\s+", "", text or "")
    compact = compact.replace("-", "")
    return compact.lower()


def _layout_text_from_lines(lines: list[dict]) -> str:
    chunks: list[str] = []
    for line in lines or []:
        for span in line.get("spans", []):
            chunks.append(span.get("content", ""))
    return "".join(chunks).strip()


def _layout_candidates_for_page(page: dict) -> list[dict]:
    candidates: list[dict] = []
    for block in page.get("para_blocks", []):
        block_type = block.get("type", "")
        if block_type == "list":
            for child in block.get("blocks", []):
                candidates.append(
                    {
                        "type": "list_item",
                        "bbox": child.get("bbox", []),
                        "lines": child.get("lines", []),
                        "text": _layout_text_from_lines(child.get("lines", [])),
                    }
                )
            continue
        candidates.append(
            {
                "type": block_type,
                "bbox": block.get("bbox", []),
                "lines": block.get("lines", []),
                "text": _layout_text_from_lines(block.get("lines", [])),
            }
        )
    return candidates


def _compatible_types(item_type: str, candidate_type: str) -> bool:
    if item_type == "title":
        return candidate_type == "title"
    if item_type in {"paragraph", "page_header", "page_footer", "page_number"}:
        return candidate_type == "text"
    if item_type == "list_item":
        return candidate_type == "list_item"
    return item_type == candidate_type


def _render_block_type(item_type: str, candidate_type: str) -> str:
    if candidate_type in {"text", "list_item"}:
        return "text"
    return item_type


def align_translated_pages_with_layout(
    translated_pages: dict[int, list[dict]],
    layout_json_path: Path,
) -> tuple[dict[int, list[dict]], dict[int, tuple[int, int]]]:
    layout_data = load_json(layout_json_path)
    pdf_info = layout_data.get("pdf_info", [])
    aligned_pages: dict[int, list[dict]] = {}
    stats: dict[int, tuple[int, int]] = {}

    for page_idx, items in translated_pages.items():
        if page_idx >= len(pdf_info):
            aligned_pages[page_idx] = items
            stats[page_idx] = (0, len(items))
            continue

        candidates = _layout_candidates_for_page(pdf_info[page_idx])
        candidate_cursor = 0
        matched = 0
        aligned_items: list[dict] = []

        for item in items:
            cloned = dict(item)
            source_text = (cloned.get("source_text") or "").strip()
            if not source_text:
                aligned_items.append(cloned)
                continue

            source_key = _normalize_text(source_text)
            best: tuple[float, int, dict] | None = None
            search_end = min(len(candidates), candidate_cursor + 12)
            for cand_idx in range(candidate_cursor, search_end):
                candidate = candidates[cand_idx]
                if not _compatible_types(cloned.get("block_type", ""), candidate["type"]):
                    continue
                score = SequenceMatcher(None, source_key, _normalize_text(candidate["text"])).ratio()
                if cloned.get("block_type") == "title" and candidate["type"] == "title":
                    score += 0.10
                elif cloned.get("block_type") == "list_item" and candidate["type"] == "list_item":
                    score += 0.08
                elif candidate["type"] == "text":
                    score += 0.06
                if best is None or score > best[0]:
                    best = (score, cand_idx, candidate)

            if best is not None and best[0] >= 0.45:
                _, cand_idx, candidate = best
                cloned["bbox"] = candidate["bbox"]
                cloned["lines"] = candidate["lines"]
                cloned["matched_layout_type"] = candidate["type"]
                cloned["block_type"] = _render_block_type(cloned.get("block_type", ""), candidate["type"])
                candidate_cursor = cand_idx + 1
                matched += 1
            aligned_items.append(cloned)

        aligned_pages[page_idx] = aligned_items
        stats[page_idx] = (matched, sum(1 for item in items if (item.get("source_text") or "").strip()))

    return aligned_pages, stats


def main() -> None:
    args = parse_args()
    translations_dir = Path(args.translations_dir)
    source_pdf = Path(args.source_pdf)
    output_pdf = Path(args.output)
    layout_json = Path(args.layout_json)

    translated_pages: dict[int, list[dict]] = {}
    for path in sorted(translations_dir.glob("page-*.json")):
        stem = path.stem
        try:
            page_idx = int(stem.split("-")[1]) - 1
        except (IndexError, ValueError):
            continue
        translated_pages[page_idx] = load_page_json(path)

    if not translated_pages:
        raise RuntimeError(f"No page JSON files found in {translations_dir}")

    if layout_json.exists():
        translated_pages, match_stats = align_translated_pages_with_layout(translated_pages, layout_json)
        matched_pages = 0
        for page_idx in sorted(match_stats):
            matched, total = match_stats[page_idx]
            if matched:
                matched_pages += 1
            print(f"layout align page {page_idx + 1}: matched {matched}/{total}")
        print(f"layout align pages matched: {matched_pages}/{len(match_stats)}")
    else:
        print(f"raw layout json not found, render experiment output without alignment: {layout_json}")

    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    build_book_typst_pdf(
        source_pdf_path=source_pdf,
        output_pdf_path=output_pdf,
        translated_pages=translated_pages,
    )
    print(f"source pdf: {source_pdf}")
    print(f"translations dir: {translations_dir}")
    print(f"pages: {len(translated_pages)}")
    print(f"output pdf: {output_pdf}")


if __name__ == "__main__":
    main()
