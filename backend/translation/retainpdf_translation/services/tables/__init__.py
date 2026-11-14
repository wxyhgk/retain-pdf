"""表格翻译（T3，先只看文字）：表格 agent、术语记忆、整表译文。说明见 agent.py。"""
from .agent import BLOCKING_ISSUES
from .agent import MAX_ROUNDS
from .agent import PROMPT_VERSION
from .agent import STATUS_KEPT
from .agent import STATUS_SKIPPED
from .agent import STATUS_TRANSLATED
from .agent import TableContext
from .agent import TableResult
from .agent import cache_key
from .agent import translate_table
from .memory import TableTermMemory
from .output import translated_table_html

__all__ = [
    "BLOCKING_ISSUES",
    "MAX_ROUNDS",
    "PROMPT_VERSION",
    "STATUS_KEPT",
    "STATUS_SKIPPED",
    "STATUS_TRANSLATED",
    "TableContext",
    "TableResult",
    "TableTermMemory",
    "cache_key",
    "translate_table",
    "translated_table_html",
]
