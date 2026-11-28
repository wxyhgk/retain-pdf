"""认上下文（R2，2026-11-28）：规则拿不准的目录页，模型看截图和规则草稿，只改片段的角色和条目的归属。

- ``draft``：一页的规则草稿（片段 + 条目），流水线 ``toc_pages.page_draft`` 给；
- ``signals``：规则拿不准的信号，没有信号的页不问模型；
- ``tools``：模型的工具（改角色、合并、拆开、挂行、不翻、级别、接上一页、不是目录）；
- ``checks``：每次改完跑的检查；
- ``agent``：循环（最多 3 轮），没改成按规则草稿走，规则草稿也不过就整页保留原文。

只用标准库；截图、取文字层、调模型、读写文档都在接线包 ``retainpdf_toc_agent_engine.context``。
"""
from retainpdf_toc_agent.context.agent import CONTEXT_PROMPT_VERSION
from retainpdf_toc_agent.context.agent import EFFECT_KEEP_PAGE
from retainpdf_toc_agent.context.agent import EFFECT_NONE
from retainpdf_toc_agent.context.agent import EFFECT_REBUILD
from retainpdf_toc_agent.context.agent import MAX_CONTEXT_ROUNDS
from retainpdf_toc_agent.context.agent import PageOutcome
from retainpdf_toc_agent.context.agent import page_view
from retainpdf_toc_agent.context.agent import resolve_page
from retainpdf_toc_agent.context.checks import check_draft
from retainpdf_toc_agent.context.draft import ROLES
from retainpdf_toc_agent.context.draft import TEXT_LAYER_INVISIBLE
from retainpdf_toc_agent.context.draft import TEXT_LAYER_VISIBLE
from retainpdf_toc_agent.context.draft import DraftEntry
from retainpdf_toc_agent.context.draft import Fragment
from retainpdf_toc_agent.context.draft import PageDraft
from retainpdf_toc_agent.context.signals import SIGNALS
from retainpdf_toc_agent.context.signals import heading_keys_of
from retainpdf_toc_agent.context.signals import page_signals
from retainpdf_toc_agent.context.tools import TOOLS
from retainpdf_toc_agent.context.tools import apply_actions

__all__ = [
    "CONTEXT_PROMPT_VERSION",
    "EFFECT_KEEP_PAGE",
    "EFFECT_NONE",
    "EFFECT_REBUILD",
    "MAX_CONTEXT_ROUNDS",
    "ROLES",
    "SIGNALS",
    "TEXT_LAYER_INVISIBLE",
    "TEXT_LAYER_VISIBLE",
    "TOOLS",
    "DraftEntry",
    "Fragment",
    "PageDraft",
    "PageOutcome",
    "apply_actions",
    "check_draft",
    "heading_keys_of",
    "page_signals",
    "page_view",
    "resolve_page",
]
