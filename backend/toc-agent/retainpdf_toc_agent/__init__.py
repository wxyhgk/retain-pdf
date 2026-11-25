"""RetainPDF 目录 agent 核心（只用标准库）。说明见包的 README。"""
from retainpdf_toc_agent.agent import MAX_ROUNDS
from retainpdf_toc_agent.agent import PROMPT_VERSION
from retainpdf_toc_agent.agent import TocResult
from retainpdf_toc_agent.agent import translate_toc
from retainpdf_toc_agent.contract import ChatResult
from retainpdf_toc_agent.contract import GlossaryTerm
from retainpdf_toc_agent.contract import Heading
from retainpdf_toc_agent.contract import TocEntry

__all__ = [
    "MAX_ROUNDS",
    "PROMPT_VERSION",
    "ChatResult",
    "GlossaryTerm",
    "Heading",
    "TocEntry",
    "TocResult",
    "translate_toc",
]
