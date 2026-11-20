"""表格翻译（T3，先只看文字）：表格 agent、术语记忆、整表译文。说明见 agent.py。"""
from retainpdf_translation_classic.services.tables.agent import BLOCKING_ISSUES
from retainpdf_translation_classic.services.tables.agent import MAX_ROUNDS
from retainpdf_translation_classic.services.tables.agent import PROMPT_VERSION
from retainpdf_translation_classic.services.tables.agent import STATUS_KEPT
from retainpdf_translation_classic.services.tables.agent import STATUS_SKIPPED
from retainpdf_translation_classic.services.tables.agent import STATUS_TRANSLATED
from retainpdf_translation_classic.services.tables.agent import TableContext
from retainpdf_translation_classic.services.tables.agent import TableResult
from retainpdf_translation_classic.services.tables.agent import cache_key
from retainpdf_translation_classic.services.tables.agent import translate_table
from retainpdf_translation_classic.services.tables.memory import TableTermMemory
from retainpdf_translation_classic.services.tables.output import translated_table_html

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
