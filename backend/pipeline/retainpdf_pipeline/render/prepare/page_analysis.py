"""准备步骤：页面分析（每页是可编辑文字、扫描件还是矢量密集，走哪条清理 / 背景路线）。

只依赖原 PDF、要分析的页，以及每页 OCR 块的框（analysis/profile/ocr_blocks.py 只数块和量面积）
——与译文内容无关，OCR 一完成就能做。四处原来各自现算（翻译前预热、翻译后预热、book 流程、
渲染时同步兜底），现在都走这一步、共用一份缓存。
"""

from __future__ import annotations

import json
from pathlib import Path

from retainpdf_pipeline.render.analysis.document import build_render_document_analysis
from retainpdf_pipeline.render.contracts.document_analysis import RenderDocumentAnalysis
from retainpdf_pipeline.render.prepare.store import PrepareStore
from retainpdf_pipeline.render.prepare.store import StepRecord
from retainpdf_pipeline.render.prepare.store import file_identity

STEP = "page_analysis"
VERSION = "1"
OUTPUT = "analysis.json"


def _bbox_signature(items: list[dict]) -> list[list[float]]:
    boxes = []
    for item in items or []:
        bbox = list(item.get("bbox") or [])
        boxes.append([round(float(value), 2) for value in bbox[:4]] if len(bbox) >= 4 else [])
    return boxes


def step_inputs(
    *, source_pdf_path: Path, translated_pages: dict[int, list[dict]] | None, start_page: int, end_page: int
) -> dict:
    return {
        "source_pdf": file_identity(source_pdf_path),
        "start_page": int(start_page),
        "end_page": int(end_page),
        # build_render_document_analysis：有译文页时只分析这些页，每页只看块数与框的面积。
        "pages": {str(int(page)): _bbox_signature(items) for page, items in sorted((translated_pages or {}).items())},
    }


def run_page_analysis(
    store: PrepareStore,
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]] | None,
    start_page: int,
    end_page: int,
) -> tuple[RenderDocumentAnalysis, StepRecord]:
    def build(directory: Path) -> dict[str, Path]:
        analysis = build_render_document_analysis(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            start_page=start_page,
            end_page=end_page,
        )
        output = directory / OUTPUT
        output.write_text(json.dumps(analysis.to_manifest(), ensure_ascii=False), encoding="utf-8")
        return {OUTPUT: output}

    inputs = step_inputs(
        source_pdf_path=source_pdf_path, translated_pages=translated_pages, start_page=start_page, end_page=end_page
    )
    record = store.run(STEP, VERSION, inputs, build)
    analysis = RenderDocumentAnalysis.from_manifest(json.loads(record.output(OUTPUT).read_text(encoding="utf-8")))
    if analysis is None:
        raise RuntimeError(f"page_analysis: unreadable cache {record.output(OUTPUT)}")
    return analysis, record


def page_analysis(
    prepare_dir: Path | None,
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]] | None,
    start_page: int,
    end_page: int,
) -> RenderDocumentAnalysis:
    """有缓存目录就走步骤（命中直接读），否则当场分析（no_cache / 没有任务目录时）。"""
    if prepare_dir is None:
        return build_render_document_analysis(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            start_page=start_page,
            end_page=end_page,
        )
    analysis, _record = run_page_analysis(
        PrepareStore(Path(prepare_dir)),
        source_pdf_path=source_pdf_path,
        translated_pages=translated_pages,
        start_page=start_page,
        end_page=end_page,
    )
    return analysis


__all__ = ["OUTPUT", "STEP", "VERSION", "page_analysis", "run_page_analysis", "step_inputs"]
