"""表格摸底（表格翻译 T0）：本机任务里的表格有多少、属于哪一类。只读，只出计数，不输出任何文档内容。

用法::

    backend/.venv/bin/python backend/pipeline/devtools/table_survey.py --jobs-root data/jobs [--json-out 结果.json]

每张表（document.v1 里 ``block_class == "table"``）按原文 PDF 里表格框的情况分成：

- ``text_layer``：框里有文字层（读得到词和位置）；
- ``image``：没有文字层，框里有图片（期刊把表格做成图）；
- ``vector_paths``：没有文字层也没有图片，但表格框里有大量矢量路径段（字被转成了曲线）；
- ``unknown``：读不到原文 PDF，或者以上都不像。

同一份原文被多个任务做过 OCR 时只算一次。每本书的统计只用序号标识，不带书名、任务号。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path

import fitz

SOURCE_TEXT_LAYER = "text_layer"
SOURCE_IMAGE = "image"
SOURCE_VECTOR_PATHS = "vector_paths"
SOURCE_UNKNOWN = "unknown"

MIN_WORDS_FOR_TEXT_LAYER = 3
# 表格框里的矢量路径段数：表格线几十段，字转成曲线后一个字就是几段到几十段
MIN_PATH_ITEMS_FOR_OUTLINED_TEXT = 300
LONG_TABLE_CELLS = 150

# 数字、单位符号、正负号、百分号、上标脚注字母这类（不用翻的格子的粗略判断，只用于统计）
_NUMERIC_LIKE = re.compile(r"^[\s\d.,±+\-−–—%()\[\]×x/eE<>≤≥~^*†‡§a-d]*$")
_CONTINUED = re.compile(r"\b(continued|cont\.)", re.IGNORECASE)


@dataclass
class TableGrid:
    rows: list[list[str]] = field(default_factory=list)
    spanning_cells: int = 0
    nested_tables: int = 0

    @property
    def cells(self) -> list[str]:
        return [cell for row in self.rows for cell in row]


class _GridParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.grid = TableGrid()
        self._row: list[str] | None = None
        self._cell: list[str] | None = None
        self._tables = 0

    def handle_starttag(self, tag, attrs):  # noqa: ANN001 - HTMLParser 的签名
        attributes = dict(attrs)
        if tag == "table":
            self._tables += 1
        elif tag == "tr":
            self._row = []
            self.grid.rows.append(self._row)
        elif tag in ("td", "th"):
            if str(attributes.get("rowspan") or "1") != "1" or str(attributes.get("colspan") or "1") != "1":
                self.grid.spanning_cells += 1
            if self._row is None:
                self._row = []
                self.grid.rows.append(self._row)
            self._cell = []

    def handle_endtag(self, tag):  # noqa: ANN001
        if tag in ("td", "th") and self._cell is not None and self._row is not None:
            self._row.append("".join(self._cell).strip())
            self._cell = None

    def handle_data(self, data):  # noqa: ANN001
        if self._cell is not None:
            self._cell.append(data)

    def close(self) -> None:
        super().close()
        self.grid.nested_tables = max(0, self._tables - 1)


def parse_table_grid(html: str) -> TableGrid:
    parser = _GridParser()
    parser.feed(html)
    parser.close()
    return parser.grid


def classify_cell_text(text: str) -> str:
    """``empty`` / ``numeric_like`` / ``texty``（只做统计用的粗分）。"""
    stripped = text.strip()
    if not stripped:
        return "empty"
    if _NUMERIC_LIKE.match(stripped):
        return "numeric_like"
    return "texty"


def table_html(block: dict) -> str:
    """表格 block 里 OCR 给的 HTML（放在 segments 或 lines 的 span 文本里）。"""
    for segment in block.get("segments") or []:
        text = str(segment.get("text", "") or "")
        if "<table" in text or "<tr" in text:
            return text
    for line in block.get("lines") or []:
        for span in line.get("spans") or []:
            text = str(span.get("text", "") or "")
            if "<table" in text or "<tr" in text:
                return text
    return ""


def table_source_kind(page: fitz.Page, bbox: list[float]) -> str:
    # 旋转页（横排表常见）上 OCR 的框和 PDF 内容的坐标系可能差一个旋转，两种都看。
    rects = [fitz.Rect(*bbox)]
    if page.rotation:
        rects.append(fitz.Rect(*bbox) * page.derotation_matrix)
    if any(len(page.get_text("words", clip=rect)) >= MIN_WORDS_FOR_TEXT_LAYER for rect in rects):
        return SOURCE_TEXT_LAYER
    images = [fitz.Rect(info["bbox"]) for info in page.get_image_info()]
    if any(image.intersects(rect) for image in images for rect in rects):
        return SOURCE_IMAGE
    drawings = page.get_drawings()
    for rect in rects:
        path_items = sum(
            len(drawing.get("items") or ()) for drawing in drawings if fitz.Rect(drawing["rect"]).intersects(rect)
        )
        if path_items >= MIN_PATH_ITEMS_FOR_OUTLINED_TEXT:
            return SOURCE_VECTOR_PATHS
    return SOURCE_UNKNOWN


def _document_fingerprint(document: dict) -> str:
    pages = document.get("pages") or []
    shape = [len(page.get("blocks") or []) for page in pages]
    return hashlib.sha256(json.dumps([len(pages), shape]).encode("utf-8")).hexdigest()


def survey_document(document: dict, source_pdf: Path | None) -> Counter:
    """一份 document.v1 的表格计数。"""
    counts: Counter = Counter()
    counts["pages"] = len(document.get("pages") or [])
    pdf = None
    if source_pdf is not None:
        try:
            pdf = fitz.open(source_pdf)
        except Exception:  # noqa: BLE001 - 坏的原文 PDF 只影响分类，计数照样出
            pdf = None
    try:
        for page in document.get("pages") or []:
            page_index = int(page.get("page_index", 0) or 0)
            for block in page.get("blocks") or []:
                if block.get("block_class") != "table" and block.get("type") != "table":
                    continue
                counts["tables"] += 1
                counts["provider:" + str((block.get("provenance") or {}).get("provider", "") or "unknown")] += 1
                html = table_html(block)
                if not html:
                    counts["tables_without_html"] += 1
                else:
                    grid = parse_table_grid(html)
                    cells = grid.cells
                    counts["cells"] += len(cells)
                    counts["tables_with_spanning_cells"] += 1 if grid.spanning_cells else 0
                    counts["tables_with_nested_tables"] += 1 if grid.nested_tables else 0
                    counts["tables_over_150_cells"] += 1 if len(cells) > LONG_TABLE_CELLS else 0
                    for cell in cells:
                        counts["cells_" + classify_cell_text(cell)] += 1
                if _CONTINUED.search(json.dumps(block.get("content", ""), ensure_ascii=False)):
                    counts["tables_continued_caption"] += 1
                bbox = block.get("bbox") or (block.get("geometry") or {}).get("bbox")
                if pdf is not None and bbox and 0 <= page_index < len(pdf):
                    pdf_page = pdf[page_index]
                    counts["source_" + table_source_kind(pdf_page, bbox)] += 1
                    counts["tables_on_rotated_pages"] += 1 if pdf_page.rotation else 0
                else:
                    counts["source_" + SOURCE_UNKNOWN] += 1
    finally:
        if pdf is not None:
            pdf.close()
    return counts


def survey_jobs(jobs_root: Path) -> dict:
    total: Counter = Counter()
    per_document: list[dict] = []
    seen: set[str] = set()
    for document_path in sorted(jobs_root.glob("*/ocr/normalized/document.v1.json")):
        try:
            document = json.loads(document_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            total["documents_unreadable"] += 1
            continue
        fingerprint = _document_fingerprint(document)
        if fingerprint in seen:
            total["documents_duplicate_skipped"] += 1
            continue
        seen.add(fingerprint)
        job_root = document_path.parents[2]
        source_pdf = next(iter(sorted((job_root / "source").glob("*.pdf"))), None)
        counts = survey_document(document, source_pdf)
        total["documents"] += 1
        total.update(counts)
        if counts["tables"]:
            total["documents_with_tables"] += 1
            per_document.append(dict(counts))
    per_document.sort(key=lambda row: -row.get("tables", 0))
    return {"total": dict(total), "per_document": per_document}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--jobs-root", type=Path, default=Path("data/jobs"))
    parser.add_argument("--json-out", type=Path)
    args = parser.parse_args(argv)
    result = survey_jobs(args.jobs_root)
    text = json.dumps(result, ensure_ascii=False, indent=1)
    if args.json_out:
        args.json_out.write_text(text + "\n", encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
