"""表格模型（表格翻译 T1）：OCR 的表格结构 + 原文 PDF 文字层 → table.v1。

方案：docs/ops/planning/table-translation/。
"""
from .model import TABLE_MODEL_VERSION, build_table_model, content_kind, suggested_action

__all__ = ["TABLE_MODEL_VERSION", "build_table_model", "content_kind", "suggested_action"]
