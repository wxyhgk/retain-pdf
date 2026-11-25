"""表格 agent 包的核心（只用标准库）：一张表一个有上限的循环、术语记忆、整表译文。说明见 agent.py。

2026-11-25 从普通翻译包的 ``services/tables``（T3）原样搬来，行为没变；模型调用由调用方传进来
（接线包 ``retainpdf_table_agent_engine``）。同日加了定结构（G4 前半，``structure.py``）：结构不可信的表看截图用结构工具修。方案见 docs/ops/planning/table-translation/20261123-表格agent独立成包.md。
"""
from retainpdf_table_agent.agent import BLOCKING_ISSUES
from retainpdf_table_agent.contract import ChatResult
from retainpdf_table_agent.contract import StructureSource
from retainpdf_table_agent.agent import MAX_ROUNDS
from retainpdf_table_agent.agent import PROMPT_VERSION
from retainpdf_table_agent.agent import STATUS_KEPT
from retainpdf_table_agent.agent import STATUS_SKIPPED
from retainpdf_table_agent.agent import STATUS_TRANSLATED
from retainpdf_table_agent.agent import TableContext
from retainpdf_table_agent.agent import TableResult
from retainpdf_table_agent.agent import cache_key
from retainpdf_table_agent.agent import translate_table
from retainpdf_table_agent.memory import TableTermMemory
from retainpdf_table_agent.output import translated_table_html
from retainpdf_table_agent.structure import FIXABLE_ISSUES
from retainpdf_table_agent.structure import STRUCTURE_FIXED
from retainpdf_table_agent.structure import STRUCTURE_KEPT
from retainpdf_table_agent.structure import STRUCTURE_PROMPT_VERSION
from retainpdf_table_agent.structure import StructureResult
from retainpdf_table_agent.structure import fix_structure
from retainpdf_table_agent.structure import needs_structure_fix
from retainpdf_table_agent.structure import structure_fingerprint

__all__ = [
    "BLOCKING_ISSUES",
    "ChatResult",
    "FIXABLE_ISSUES",
    "MAX_ROUNDS",
    "PROMPT_VERSION",
    "STATUS_KEPT",
    "STATUS_SKIPPED",
    "STATUS_TRANSLATED",
    "STRUCTURE_FIXED",
    "STRUCTURE_KEPT",
    "STRUCTURE_PROMPT_VERSION",
    "StructureResult",
    "StructureSource",
    "TableContext",
    "TableResult",
    "TableTermMemory",
    "cache_key",
    "fix_structure",
    "needs_structure_fix",
    "structure_fingerprint",
    "translate_table",
    "translated_table_html",
]
