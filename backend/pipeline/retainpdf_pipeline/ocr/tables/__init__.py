"""表格模型（表格翻译 T1）：OCR 的表格结构 + 原文 PDF 文字层 → table.v1。

方案：docs/ops/planning/table-translation/。表格 agent 定结构（G4）用的初稿和重建在 ``structure.py``。
"""
from .model import TABLE_MODEL_VERSION, build_table_model, content_kind, suggested_action
from .structure import TableStructure, table_structure

__all__ = [
    "TABLE_MODEL_VERSION",
    "TableStructure",
    "build_table_model",
    "content_kind",
    "suggested_action",
    "table_structure",
]
