"""准备步骤：障碍物扫描（矢量图形、文字块与图片框、扫描页墨迹），给 rpr_fit 引擎用。

只依赖原 PDF 与 OCR 结果（document.v1），与翻译无关，所以 OCR 一完成就能做，之后任何页码
范围、任何一次改译文后的重新渲染都直接复用：

- 读原 PDF（不是去文字层的底图）：去文字层只删文字，矢量图形与扫描页像素不变；多出来的
  译文原文文字框都落在译文块里，引擎会把障碍物落在译文块里的部分裁掉；
- 用 OCR 自己的划分：非文本块（图、表、公式……）里的路径合并成墨迹矩形，所有 OCR 块里的
  像素墨迹不当障碍物。哪些块要翻译由引擎在排版时自己判断。

产物 ``scan.json``：{"<页号>": {width, height, drawings, images, words, raster}}，格式见
obstacle_scan_pdf.py。
"""

from __future__ import annotations

import json
from pathlib import Path

from retainpdf_pipeline.render.prepare.obstacle_scan_pdf import extract_drawings
from retainpdf_pipeline.render.prepare.store import PrepareStore
from retainpdf_pipeline.render.prepare.store import StepRecord
from retainpdf_pipeline.render.prepare.store import file_identity

STEP = "obstacle_scan"
# 改了 obstacle_scan_pdf.py 的读法 / 产物格式就加一。
VERSION = "1"
OUTPUT = "scan.json"


def _boxes_by_page(document: dict) -> tuple[list[int], dict[int, list[list[float]]], dict[int, list[list[float]]]]:
    pages: list[int] = []
    text_boxes: dict[int, list[list[float]]] = {}
    obstacle_boxes: dict[int, list[list[float]]] = {}
    for page in document.get("pages") or []:
        index = int(page.get("page_index", -1))
        if index < 0:
            continue
        pages.append(index)
        for block in page.get("blocks") or []:
            bbox = [float(value) for value in (block.get("bbox") or [])]
            if len(bbox) != 4:
                continue
            target = text_boxes if block.get("type") == "text" else obstacle_boxes
            target.setdefault(index, []).append(bbox)
    return sorted(pages), text_boxes, obstacle_boxes


def step_inputs(*, source_pdf_path: Path, document_path: Path) -> dict:
    return {"source_pdf": file_identity(source_pdf_path), "document": file_identity(document_path)}


def run_obstacle_scan(store: PrepareStore, *, source_pdf_path: Path, document_path: Path) -> StepRecord:
    def build(directory: Path) -> dict[str, Path]:
        document = json.loads(Path(document_path).read_text(encoding="utf-8"))
        pages, text_boxes, obstacle_boxes = _boxes_by_page(document)
        scan = extract_drawings(Path(source_pdf_path), pages, obstacle_boxes=obstacle_boxes, text_boxes=text_boxes)
        output = directory / OUTPUT
        output.write_text(json.dumps(scan), encoding="utf-8")
        return {OUTPUT: output}

    return store.run(STEP, VERSION, step_inputs(source_pdf_path=source_pdf_path, document_path=document_path), build)


def load_obstacle_scan(record: StepRecord) -> dict[str, dict]:
    return json.loads(record.output(OUTPUT).read_text(encoding="utf-8"))


__all__ = ["OUTPUT", "STEP", "VERSION", "load_obstacle_scan", "run_obstacle_scan", "step_inputs"]
