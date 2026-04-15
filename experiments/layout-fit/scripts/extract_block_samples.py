#!/usr/bin/env python3
"""Extract small block-level layout-fit fixtures from an existing job."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any


JOBS_ROOT = Path("/home/wxyhgk/tmp/Code/data/jobs")
PROJECT_ROOT = Path(__file__).resolve().parents[1]
PDF_LINK_DIR = PROJECT_ROOT / "fixtures" / "source-pdfs"
PDF_PAGE_DIR = PROJECT_ROOT / "fixtures" / "pdf-pages"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def bbox_to_box(bbox: list[float], unit: str) -> dict[str, float | str]:
    x0, y0, x1, y1 = bbox
    return {
        "x": x0,
        "y": y0,
        "width": x1 - x0,
        "height": y1 - y0,
        "unit": unit,
    }


def typst_matches_box(typst: dict[str, Any] | None, box: dict[str, float | str]) -> bool:
    if not typst:
        return False
    width_pt = typst.get("width_pt")
    if not width_pt:
        return True
    target_width = float(box["width"])
    if target_width <= 0:
        return False
    return min(float(width_pt), target_width) / max(float(width_pt), target_width) >= 0.65


def page_translation_path(job_root: Path, page_index: int) -> Path:
    return job_root / "translated" / f"page-{page_index + 1:03d}-deepseek.json"


def load_translations(job_root: Path) -> dict[str, dict[str, Any]]:
    translations: dict[str, dict[str, Any]] = {}
    for path in sorted((job_root / "translated").glob("page-*-deepseek.json")):
        for item in load_json(path):
            translations[item["item_id"]] = item
            translations[normalize_translation_item_id(item["item_id"])] = item
    return translations


def normalize_translation_item_id(item_id: str) -> str:
    match = re.fullmatch(r"p(\d+)-b(\d+)", item_id)
    if not match:
        return item_id
    return f"p{int(match.group(1)):03d}-b{int(match.group(2)):04d}"


def parse_typst_items(job_root: Path) -> dict[tuple[int, int], dict[str, Any]]:
    typ_path = job_root / "rendered" / "typst" / "book-overlays" / "book-overlay.typ"
    if not typ_path.exists():
        return {}

    text = typ_path.read_text(encoding="utf-8")
    items: dict[tuple[int, int], dict[str, Any]] = {}
    md_by_key: dict[tuple[int, int], str] = {}
    md_re = re.compile(r'#let p(?P<page>\d+)_item_(?P<block>\d+)_(?P<ordinal>\d+)_md = "(?P<md>.*)"')
    for match in md_re.finditer(text):
        md_by_key[(int(match.group("page")), int(match.group("block")))] = match.group("md")
    body_re = re.compile(r"#let p(?P<page>\d+)_item_(?P<block>\d+)_(?P<ordinal>\d+)_body = (?P<body>.+)")
    for match in body_re.finditer(text):
        body = match.group("body")
        item_key = (int(match.group("page")), int(match.group("block")))
        item: dict[str, Any] = {
            "body_name": f"p{match.group('page')}_item_{match.group('block')}_{match.group('ordinal')}_body",
            "body_expr": body,
        }
        if item_key in md_by_key:
            item["markdown_text"] = md_by_key[item_key]
        for field, pattern in {
            "width_pt": r"block\(width: ([0-9.]+)pt",
            "height_pt": r"height: ([0-9.]+)pt",
            "text_size_pt": r"set text\(size: ([0-9.]+)pt\)",
            "leading_em": r"set par\(leading: ([0-9.]+)em\)",
            "fit_height_pt": r"fit_height: ([0-9.]+)pt",
            "max_size_pt": r"max_size: ([0-9.]+)pt",
            "min_size_pt": r"min_size: ([0-9.]+)pt",
            "max_leading_em": r"max_leading: ([0-9.]+)em",
            "min_leading_em": r"min_leading: ([0-9.]+)em",
        }.items():
            found = re.search(pattern, body)
            if found:
                item[field] = float(found.group(1))
        items[item_key] = item
    return items


def is_complete_job(job_root: Path) -> bool:
    return all(
        path.exists()
        for path in [
            job_root / "ocr" / "normalized" / "document.v1.json",
            job_root / "artifacts" / "pipeline_summary.json",
            job_root / "translated",
        ]
    )


def find_latest_job_root(jobs_root: Path = JOBS_ROOT) -> Path:
    candidates = [path for path in jobs_root.iterdir() if path.is_dir() and is_complete_job(path)]
    if not candidates:
        raise SystemExit(f"No complete jobs found in {jobs_root}")
    return max(candidates, key=lambda path: path.stat().st_mtime)


def choose_default_block_ids(
    doc: dict[str, Any],
    translations: dict[str, dict[str, Any]],
    limit: int | None = None,
) -> list[str]:
    candidates: list[tuple[int, int, str]] = []
    for page in doc["pages"]:
        page_index = int(page["page_index"])
        for block in page["blocks"]:
            block_id = block["block_id"]
            if block.get("type") != "text":
                continue
            if not block.get("text", "").strip():
                continue
            translated_text = translations.get(block_id, {}).get("translated_text", "").strip()
            text_len = len(translated_text or block.get("text", ""))
            if text_len < 1:
                continue
            order = int(block.get("order", 0))
            candidates.append((page_index, order, block_id))

    chosen = candidates[:limit] if limit else candidates
    if not chosen:
        raise SystemExit("No suitable text blocks found for layout-fit samples")
    return [block_id for _, _, block_id in chosen]


def starts_like_continuation(text: str) -> bool:
    return bool(re.match(r'^[a-z0-9(\["“]', text))


def ends_like_continuation(text: str) -> bool:
    return bool(re.search(r"[A-Za-z0-9,;:-]$", text))


def likely_flow_transition(
    prev_page_index: int,
    prev_block: dict[str, Any],
    next_page_index: int,
    next_block: dict[str, Any],
    page_heights: dict[int, float],
) -> bool:
    prev_text = prev_block.get("text", "").strip()
    next_text = next_block.get("text", "").strip()
    if not prev_text or not next_text:
        return False
    if not ends_like_continuation(prev_text) or not starts_like_continuation(next_text):
        return False

    prev_x0, prev_y0, prev_x1, prev_y1 = prev_block["bbox"]
    next_x0, next_y0, next_x1, next_y1 = next_block["bbox"]
    prev_width = prev_x1 - prev_x0
    prev_height = prev_y1 - prev_y0
    prev_bottom = prev_y1
    vertical_reset = next_y0 + 12 < prev_y0
    column_shift = next_x0 > prev_x0 + min(max(prev_width * 0.35, 40), 120)
    same_column = abs(next_x0 - prev_x0) <= min(max(prev_width * 0.15, 18), 36)
    vertical_gap = next_y0 - prev_bottom

    if next_page_index == prev_page_index:
        wrapped_same_column = same_column and -4 <= vertical_gap <= max(28, prev_height * 0.8)
        wrapped_next_column = vertical_reset and column_shift
        return wrapped_same_column or wrapped_next_column

    if next_page_index == prev_page_index + 1:
        prev_page_height = page_heights.get(prev_page_index, prev_bottom)
        next_page_height = page_heights.get(next_page_index, next_y1)
        prev_near_bottom = prev_bottom >= prev_page_height * 0.84
        next_near_top = next_y0 <= min(next_page_height * 0.22, 180)
        return prev_near_bottom and next_near_top

    return False


def detect_flow_groups(doc: dict[str, Any]) -> list[list[str]]:
    page_heights = {int(page["page_index"]): float(page["height"]) for page in doc["pages"]}
    ordered_blocks: list[tuple[int, dict[str, Any]]] = []
    for page in doc["pages"]:
        for block in page["blocks"]:
            text = block.get("text", "").strip()
            if block.get("type") != "text" or not text:
                continue
            ordered_blocks.append((int(page["page_index"]), block))

    groups: list[list[str]] = []
    current: list[str] = []
    for index, (page_index, block) in enumerate(ordered_blocks):
        block_id = block["block_id"]
        if not current:
            current = [block_id]
            continue

        prev_page_index, prev_block = ordered_blocks[index - 1]
        if likely_flow_transition(prev_page_index, prev_block, page_index, block, page_heights):
            current.append(block_id)
        else:
            groups.append(current)
            current = [block_id]

    if current:
        groups.append(current)
    return groups


def collect_samples(job_root: Path, block_ids: list[str] | None) -> dict[str, Any]:
    doc = load_json(job_root / "ocr" / "normalized" / "document.v1.json")
    summary = load_json(job_root / "artifacts" / "pipeline_summary.json")
    translations = load_translations(job_root)
    typst_items = parse_typst_items(job_root)
    flow_groups = detect_flow_groups(doc)
    flow_lookup: dict[str, dict[str, Any]] = {}
    for group_index, group in enumerate(flow_groups):
        if len(group) <= 1:
            continue
        group_id = f"flow-{group_index:03d}"
        for item_index, block_id in enumerate(group):
            flow_lookup[block_id] = {
                "group_id": group_id,
                "index": item_index,
                "count": len(group),
                "block_ids": group,
                "prev_block_id": group[item_index - 1] if item_index > 0 else None,
                "next_block_id": group[item_index + 1] if item_index + 1 < len(group) else None,
            }
    if block_ids is None:
        block_ids = choose_default_block_ids(doc, translations)
    wanted = set(block_ids)
    source_pdf_path = Path(summary["source_pdf"])
    pdf_href = ensure_pdf_link(doc["document_id"], source_pdf_path)
    render_pdf_pages(doc["document_id"], source_pdf_path, int(doc["page_count"]))

    samples: list[dict[str, Any]] = []
    for page in doc["pages"]:
        page_index = int(page["page_index"])
        unit = page.get("unit", "pt")
        for block in page["blocks"]:
            block_id = block["block_id"]
            if block_id not in wanted:
                continue
            translation = translations.get(block_id, {})
            translated_text = translation.get("translated_text", "")
            translation_unit_text = (
                translation.get("translation_unit_translated_text")
                or translation.get("group_translated_text")
                or ""
            )
            source_text = block.get("text", "")
            block_index = int(block.get("order", translation.get("block_idx", 0)))
            typst = typst_items.get((page_index, block_index))
            target_box = bbox_to_box(block["bbox"], unit)
            if typst and not typst_matches_box(typst, target_box):
                typst = None
            flow = flow_lookup.get(block_id)
            fit_text = translated_text or ("" if flow and translation_unit_text else translation_unit_text) or source_text
            text_source = "translated_json" if translated_text or translation_unit_text else "source_ocr"
            sample = {
                "sample_id": f"{doc['document_id']}:{block_id}",
                "job_id": doc["document_id"],
                "block_id": block_id,
                "page_index": page_index,
                "block_index": block_index,
                "type": block.get("type", ""),
                "sub_type": block.get("sub_type", ""),
                "page": {
                    "width": page["width"],
                    "height": page["height"],
                    "unit": unit,
                },
                "target_box": target_box,
                "source_text": source_text,
                "translated_text": translated_text,
                "translation_unit_text": translation_unit_text,
                "fit_text": fit_text,
                "text_source": text_source,
                "source_pdf_href": pdf_href,
                "source_pdf_page_href": pdf_page_href(doc["document_id"], page_index),
                "source_line_count": len(block.get("lines", [])),
            }
            if typst:
                sample["typst"] = typst
            if flow:
                sample["flow"] = flow
            samples.append(sample)

    samples_by_id = {sample["block_id"]: sample for sample in samples}
    ordered_samples = [samples_by_id[block_id] for block_id in block_ids if block_id in samples_by_id]
    missing = [block_id for block_id in block_ids if block_id not in samples_by_id]
    if missing:
        raise SystemExit(f"Missing block ids in document: {', '.join(missing)}")

    return {
        "schema": "layout_fit_block_samples",
        "schema_version": "1.0",
        "source_job_id": doc["document_id"],
        "source_job_root": str(job_root),
        "source_pdf_page_count": int(doc["page_count"]),
        "samples": ordered_samples,
    }


def ensure_pdf_link(job_id: str, source_pdf_path: Path) -> str:
    PDF_LINK_DIR.mkdir(parents=True, exist_ok=True)
    target = PDF_LINK_DIR / f"{job_id}.pdf"
    if target.exists() or target.is_symlink():
        target.unlink()
    os.symlink(source_pdf_path, target)
    return f"../fixtures/source-pdfs/{job_id}.pdf"


def pdf_page_href(job_id: str, page_index: int) -> str:
    return f"../fixtures/pdf-pages/{job_id}/page-{page_index + 1:03d}.png"


def render_pdf_pages(job_id: str, source_pdf_path: Path, page_count: int) -> None:
    pdftoppm = shutil.which("pdftoppm")
    if not pdftoppm:
        raise SystemExit("pdftoppm is required to render PDF page previews")

    output_dir = PDF_PAGE_DIR / job_id
    output_dir.mkdir(parents=True, exist_ok=True)
    expected = [output_dir / f"page-{index + 1:03d}.png" for index in range(page_count)]
    if all(path.exists() for path in expected):
        return

    for path in output_dir.glob("page-*.png"):
        path.unlink()

    tmp_prefix = output_dir / "rendered"
    subprocess.run(
        [pdftoppm, "-png", "-r", "144", "-f", "1", "-l", str(page_count), str(source_pdf_path), str(tmp_prefix)],
        check=True,
    )
    rendered = sorted(output_dir.glob("rendered-*.png"))
    if len(rendered) != page_count:
        raise SystemExit(f"Expected {page_count} rendered pages, got {len(rendered)}")
    for index, path in enumerate(rendered, start=1):
        path.rename(output_dir / f"page-{index:03d}.png")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-root", type=Path)
    parser.add_argument("--block-id", action="append", dest="block_ids")
    parser.add_argument("--limit", type=int, help="Limit auto-selected text blocks; omitted means all text blocks.")
    parser.add_argument("--output", type=Path, default=PROJECT_ROOT / "fixtures" / "sample-blocks.v1.json")
    args = parser.parse_args()

    job_root = args.job_root or find_latest_job_root()
    block_ids = args.block_ids
    if block_ids is None and args.limit:
        doc = load_json(job_root / "ocr" / "normalized" / "document.v1.json")
        translations = load_translations(job_root)
        block_ids = choose_default_block_ids(doc, translations, args.limit)
    payload = collect_samples(job_root, block_ids)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(payload['samples'])} samples to {args.output}")


if __name__ == "__main__":
    main()
