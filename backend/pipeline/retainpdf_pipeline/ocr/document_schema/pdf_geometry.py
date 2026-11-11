"""归一化文档对齐到原文 PDF 的几何处理，各家服务商通用（2026-10-29 从 `ocr_provider/paddle_normalize.py` 挪到这里）。

- `rescale_document_geometry_to_pdf`：按位置配页，把每页的坐标从 OCR 自己的单位等比缩放到原文 PDF 的点；
  缩放完，含替换字符 `�` 的块用原文 PDF 文字层恢复（`pdf_text_recovery.py`，PR #157）。
- `rebuild_estimated_text_geometry`：没有真实行的文字块（Paddle、content_list_v2、命令型通用格式）按文字和块框估出行、收紧块边；
  有 `bbox_precision = provider_layout` 真实行的块（MinerU）原样保留。按数据里有没有真实行决定，不按服务商名字。
  以前名叫 `post_rescale_rebuild_paddle_text_geometry`，那个名字在 `paddle_normalize.py` 里留着。

只依赖文档模型和估行（`estimated_lines.py`），不导入任何服务商的适配器或调用服务的代码（架构检查钉着）。
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Callable

from retainpdf_pipeline.ocr.document_schema.estimated_lines import build_lines as build_estimated_lines
from retainpdf_pipeline.ocr.document_schema.estimated_lines import (
    tighten_text_bbox as tighten_estimated_text_bbox,
)
from retainpdf_pipeline.ocr.document_schema.pdf_text_recovery import recover_corrupted_pdf_text
from retainpdf_pipeline.ocr.document_schema.provider_adapters.common.normalize import (
    inherit_missing_segment_bboxes,
)
from retainpdf_pipeline.ocr.document_schema.toc import build_toc_entries

BuildLinesFn = Callable[..., list]
TightenBBoxFn = Callable[..., list[float]]


def rescale_document_geometry_to_pdf(document: dict, source_pdf_path: Path) -> dict:
    import fitz

    pdf = fitz.open(source_pdf_path)
    try:
        pages = document.get("pages", []) or []
        # OCR 的第 n 页按位置对到原文的第 n 页（选了页的任务，原文已经截成所选的页）。OCR 比原文多页时对不上，
        # 以前多出来的页留在原始坐标里、照样往下走；现在直接报错。比原文少（比如末尾的空白页没给）照常缩放，记下来。
        if len(pages) > len(pdf):
            raise RuntimeError(
                f"OCR returned {len(pages)} pages but the source PDF has {len(pdf)}: "
                "pages cannot be matched to the PDF"
            )
        if len(pages) < len(pdf):
            document.setdefault("derived", {})["page_count_mismatch"] = {
                "ocr_pages": len(pages),
                "pdf_pages": len(pdf),
            }
            print(
                f"normalize: OCR returned {len(pages)} pages for a {len(pdf)}-page source PDF; "
                "matching pages by position",
                flush=True,
            )
        for page_index, page in enumerate(pages):
            pdf_page = pdf[page_index]
            pdf_w = float(pdf_page.rect.width)
            pdf_h = float(pdf_page.rect.height)
            raw_w = float(page.get("width", 0) or 0)
            raw_h = float(page.get("height", 0) or 0)
            if raw_w <= 0 or raw_h <= 0:
                # 没有原始页面尺寸就没法缩放：有块的页直接报错（以前换上 PDF 尺寸、块留在原始坐标里）；空页无所谓。
                if page.get("blocks"):
                    raise RuntimeError(
                        f"OCR page {page_index + 1} has no usable size ({raw_w} x {raw_h}) "
                        "but has blocks: its coordinates cannot be scaled to the PDF"
                    )
                page["width"] = pdf_w
                page["height"] = pdf_h
                page["unit"] = "pt"
                continue
            scale_x = pdf_w / raw_w
            scale_y = pdf_h / raw_h
            page["width"] = pdf_w
            page["height"] = pdf_h
            page["unit"] = "pt"
            for block in page.get("blocks", []) or []:
                block["bbox"] = scale_bbox(block.get("bbox", []), scale_x, scale_y)
                geometry = block.get("geometry") or {}
                if geometry:
                    geometry["bbox"] = scale_bbox(geometry.get("bbox", []), scale_x, scale_y)
                for line in block.get("lines", []) or []:
                    line["bbox"] = scale_bbox(line.get("bbox", []), scale_x, scale_y)
                    for span in line.get("spans", []) or []:
                        span["bbox"] = scale_bbox(span.get("bbox", []), scale_x, scale_y)
                for segment in block.get("segments", []) or []:
                    if isinstance(segment, dict):
                        segment["bbox"] = scale_bbox(segment.get("bbox", []), scale_x, scale_y)
            document.setdefault("derived", {})["coordinate_space"] = "pdf_point"
        recover_corrupted_pdf_text(document, pdf)
    finally:
        pdf.close()
    return document


def scale_bbox(value: list[float], scale_x: float, scale_y: float) -> list[float]:
    if not isinstance(value, list) or len(value) != 4:
        return value
    # Outward rounding (floor min corner, ceil max corner) preserves nesting:
    # if inner ⊆ outer pre-scale, the scaled boxes keep that relation, so
    # rescaling can never introduce a containment violation by itself.
    return [
        math.floor(float(value[0]) * scale_x * 1000) / 1000,
        math.floor(float(value[1]) * scale_y * 1000) / 1000,
        math.ceil(float(value[2]) * scale_x * 1000) / 1000,
        math.ceil(float(value[3]) * scale_y * 1000) / 1000,
    ]


def rebuild_estimated_text_geometry(
    document: dict,
    *,
    build_lines: BuildLinesFn = build_estimated_lines,
    tighten_text_bbox: TightenBBoxFn = tighten_estimated_text_bbox,
) -> dict:
    for page in document.get("pages", []) or []:
        for block in page.get("blocks", []) or []:
            block_type = str(block.get("type", "") or "")
            sub_type = str(block.get("sub_type", "") or "")
            text = str(block.get("text", "") or "")
            raw_label = str((block.get("source") or {}).get("raw_type", "") or "")
            original_bbox = list(block.get("bbox", []) or [])
            # Provider layout geometry is more precise than our text-height
            # heuristic.  A second post-scale tightening pass must not move the
            # canonical block edge across an already matched formula segment.
            has_provider_segment_bbox = any(
                isinstance(segment, dict)
                and str(segment.get("bbox_precision", "") or "") == "provider_layout"
                for segment in block.get("segments", []) or []
            )
            # 服务商给了真实的行（MinerU 的 middle.json 每行都有框）：行和块边都以它为准，不用文字高度去估。
            # 这一步以前对所有服务商都跑，把 MinerU 的原生行换成了按字数估的行（行内公式的标记也丢了）。
            has_provider_lines = any(
                isinstance(line, dict)
                and str(line.get("bbox_precision", "") or "") == "provider_layout"
                for line in block.get("lines", []) or []
            )
            # Recovered lines already come from the PDF text layer. Tightening
            # the block by estimate can cut off their measured segments.
            has_measured_lines = has_provider_lines or bool((block.get("metadata") or {}).get("pdf_text_recovered"))
            tightened_bbox = (
                original_bbox
                if has_provider_segment_bbox or has_measured_lines
                else tighten_text_bbox(
                    bbox=original_bbox,
                    text=text,
                    block_type=block_type,
                    sub_type=sub_type,
                )
            )
            if tightened_bbox != original_bbox:
                block["bbox"] = tightened_bbox
                geometry = block.get("geometry") or {}
                if geometry:
                    geometry["bbox"] = list(tightened_bbox)
                metadata = block.get("metadata") or {}
                metadata["provider_bbox_tightened"] = True
                metadata["provider_bbox_original"] = original_bbox
                block["metadata"] = metadata
            if has_measured_lines:
                rebuilt_lines = [line for line in block.get("lines", []) or [] if isinstance(line, dict)]
            else:
                rebuilt_lines = build_lines(
                    bbox=block.get("bbox", []),
                    segments=block.get("segments", []) or [],
                    text=text,
                    raw_label=raw_label,
                    block_type=block_type,
                    sub_type=sub_type,
                )
            if rebuilt_lines and not has_measured_lines:
                inherit_missing_segment_bboxes(
                    bbox=block.get("bbox", []),
                    segments=block.get("segments", []) or [],
                    lines=rebuilt_lines,
                )
                block["lines"] = rebuilt_lines
            if rebuilt_lines:
                content = block.get("content") or {}
                if str(block.get("structure_role", "") or "").strip().lower() == "table_of_contents":
                    line_texts = content.get("line_texts") or []
                    if isinstance(line_texts, list):
                        toc_entries = build_toc_entries(
                            lines=rebuilt_lines,
                            line_texts=[str(line) for line in line_texts],
                        )
                        if toc_entries:
                            content["toc_entries"] = toc_entries
                            content["text_flow"] = "preserve_lines"
                            block["content"] = content
    return document


__all__ = [
    "rebuild_estimated_text_geometry",
    "rescale_document_geometry_to_pdf",
    "scale_bbox",
]
