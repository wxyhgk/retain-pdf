"""表格翻译评测集（T0）：把公开样例 PDF 的 OCR 结果里和表格有关的部分提出来，存成精简的记录。

用法::

    backend/.venv/bin/python backend/pipeline/devtools/build_table_eval_set.py \\
        --ocr-jobs <OCR 任务目录的根，下面是 <服务商>/<子集名>/ocr/normalized/document.v1.json> \\
        --subsets <subsets.json：每个子集来自哪份样例 PDF、子集第 i 页是原文第几页> \\
        --out tests/fixtures/tables

子集 PDF 是把样例 PDF 里有表格的页挑出来拼的（按表题 "Table N" 找页），只为少花 OCR 的钱；记录里的页码都换回原文页码。
每张表存：服务商、样例 PDF、原文页码、页面尺寸、表格框、OCR 给的 HTML、表题和表注的文字（OCR 认出来的）。
不存整份 document.v1（太大），也不存任何本机路径。
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from table_survey import table_html

RECORD_VERSION = "table_eval_record.v1"


def _block_text(block: dict) -> str:
    text = block.get("text")
    if isinstance(text, str) and text.strip():
        return text.strip()
    parts = []
    for line in block.get("lines") or []:
        for span in line.get("spans") or []:
            parts.append(str(span.get("text", "") or ""))
    return " ".join(part.strip() for part in parts if part.strip())


def table_records(document: dict, *, provider: str, fixture: str, source_pages: list[int]) -> list[dict]:
    records: list[dict] = []
    for page in document.get("pages") or []:
        page_index = int(page.get("page_index", 0) or 0)
        blocks = page.get("blocks") or []
        by_id = {block.get("block_id"): block for block in blocks}
        for block in blocks:
            if block.get("block_class") != "table":
                continue
            content = block.get("content") if isinstance(block.get("content"), dict) else {}
            caption_ids = [str(item) for item in content.get("caption_block_ids") or []]
            footnote_ids = [str(item) for item in content.get("footnote_block_ids") or []]
            records.append(
                {
                    "record_version": RECORD_VERSION,
                    "table_id": f"{Path(fixture).stem}-p{source_pages[page_index]:03d}-{block.get('block_id')}",
                    "provider": provider,
                    "fixture": fixture,
                    "source_page": source_pages[page_index],
                    "page_size_pt": [page.get("width"), page.get("height")],
                    "bbox_pt": block.get("bbox"),
                    "block_id": block.get("block_id"),
                    "html": table_html(block),
                    "captions": [_block_text(by_id[item]) for item in caption_ids if item in by_id],
                    "footnotes": [_block_text(by_id[item]) for item in footnote_ids if item in by_id],
                }
            )
    return records


def build(ocr_jobs: Path, subsets: list[dict], out: Path) -> dict:
    summary: dict[str, int] = {}
    for provider_dir in sorted(path for path in ocr_jobs.iterdir() if path.is_dir() and not path.name.startswith("_")):
        provider = provider_dir.name
        records: list[dict] = []
        for subset in subsets:
            stem = Path(subset["subset"]).stem
            document_path = provider_dir / stem / "ocr" / "normalized" / "document.v1.json"
            if not document_path.is_file():
                raise FileNotFoundError(f"{provider}/{stem}: 没有 OCR 结果")
            document = json.loads(document_path.read_text(encoding="utf-8"))
            records.extend(
                table_records(document, provider=provider, fixture=subset["fixture"], source_pages=subset["source_pages"])
            )
        target = out / "ocr" / f"{provider}.tables.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(records, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        summary[provider] = len(records)
    (out / "subsets.json").write_text(json.dumps(subsets, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--ocr-jobs", type=Path, required=True)
    parser.add_argument("--subsets", type=Path, required=True)
    parser.add_argument("--out", type=Path, default=Path("tests/fixtures/tables"))
    args = parser.parse_args(argv)
    subsets = json.loads(args.subsets.read_text(encoding="utf-8"))
    print(json.dumps(build(args.ocr_jobs, subsets, args.out), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
