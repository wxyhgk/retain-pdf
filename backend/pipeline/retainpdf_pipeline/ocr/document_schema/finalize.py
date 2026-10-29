"""适配器出来的文档对齐到原文 PDF 的最后几步，各条归一化路径共用（见 `finalize_normalized_document`）。

单独成模块、只依赖缩放和校验：`normalize_pipeline` 会导入 MinerU 的模块，MinerU 的 Python 直跑（`job_flow`）又要用这一步，
放在 `normalize_pipeline` 里会循环导入。缩放和补行 2026-10-29 起在 `pdf_geometry.py`（以前在 `ocr_provider/paddle_normalize.py`）。
"""

from __future__ import annotations

from pathlib import Path

from retainpdf_pipeline.ocr.document_schema.validator import build_validation_report
from retainpdf_pipeline.ocr.document_schema.pdf_geometry import (
    rebuild_estimated_text_geometry,
    rescale_document_geometry_to_pdf,
)


def finalize_normalized_document(
    document: dict,
    report: dict,
    source_pdf: Path,
) -> tuple[dict, dict]:
    """适配器出来的文档对齐到原文 PDF：缩放到 PDF 坐标 → 没有真实行的块重建行 → 按最终文档重新校验、刷新报告。

    正式的 normalize worker、命令型 OCR 交回原始输出、MinerU 的 Python 直跑都走这一个（2026-10-29 起）。以前只有
    normalize worker 做：命令型 OCR 交回 Paddle 原始输出时坐标留在像素里、却标着 pt（校验按页面自己的宽高查，查不出来）。
    """
    document = rescale_document_geometry_to_pdf(document, source_pdf)
    document = rebuild_estimated_text_geometry(document)
    return document, refresh_report_for_final_document(report, document)


def refresh_report_for_final_document(report: dict, document: dict) -> dict:
    refreshed = dict(report)
    pages = document.get("pages", []) or []
    defaults_report = dict(report.get("defaults") or {})
    defaults_report["pages_seen"] = len(pages)
    defaults_report["blocks_seen"] = sum(
        len(page.get("blocks", []) or []) for page in pages
    )
    refreshed["defaults"] = defaults_report
    validation = build_validation_report(document)
    validation["coordinate_space"] = "pdf_point"
    refreshed["validation"] = validation
    provider_signals = dict(
        (document.get("derived") or {}).get("provider_signals") or {}
    )
    if provider_signals:
        refreshed["provider_signals"] = provider_signals
    return refreshed


__all__ = ["finalize_normalized_document", "refresh_report_for_final_document"]
