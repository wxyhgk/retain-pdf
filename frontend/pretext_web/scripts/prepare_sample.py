from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend" / "scripts"))

from services.rendering.layout.payload.prepare import prepare_render_payloads_by_page

SAMPLE_ID = "20260331193234-e0319e"
SOURCE_ROOT = ROOT / "data" / SAMPLE_ID
TARGET_ROOT = ROOT / "frontend" / "pretext_web" / "data" / SAMPLE_ID


def ensure_clean_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def copy_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def render_pdf_pages(pdf_path: Path, output_dir: Path, zoom: float = 2.0) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    matrix = fitz.Matrix(zoom, zoom)
    for page_index, page in enumerate(doc):
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        pix.save(output_dir / f"page-{page_index + 1:03d}.png")


def main() -> None:
    ensure_clean_dir(TARGET_ROOT)

    copy_file(
        SOURCE_ROOT / "ocr" / "normalized" / "document.v1.json",
        TARGET_ROOT / "document.v1.json",
    )
    copy_file(
        SOURCE_ROOT / "translated" / "pipeline_summary.json",
        TARGET_ROOT / "pipeline_summary.json",
    )

    translations_dir = TARGET_ROOT / "translations"
    translations_dir.mkdir(parents=True, exist_ok=True)
    translated_pages: dict[int, list[dict]] = {}
    translation_paths = sorted((SOURCE_ROOT / "translated" / "translations").glob("page-*.json"))
    for translation_path in translation_paths:
        with translation_path.open("r", encoding="utf-8") as handle:
            items = json.load(handle)
        if items:
            translated_pages[items[0]["page_idx"]] = items

    prepared_pages = prepare_render_payloads_by_page(translated_pages)
    for translation_path in translation_paths:
        with translation_path.open("r", encoding="utf-8") as handle:
            original_items = json.load(handle)
        page_idx = original_items[0]["page_idx"] if original_items else 0
        output_items = prepared_pages.get(page_idx, original_items)
        dst = translations_dir / translation_path.name
        dst.parent.mkdir(parents=True, exist_ok=True)
        with dst.open("w", encoding="utf-8") as handle:
            json.dump(output_items, handle, ensure_ascii=False, indent=2)

    with (SOURCE_ROOT / "translated" / "pipeline_summary.json").open("r", encoding="utf-8") as handle:
        summary = json.load(handle)
    source_pdf = Path(summary["source_pdf"])

    render_pdf_pages(source_pdf, TARGET_ROOT / "pages", zoom=2.0)

    print(f"prepared sample at: {TARGET_ROOT}")


if __name__ == "__main__":
    main()
