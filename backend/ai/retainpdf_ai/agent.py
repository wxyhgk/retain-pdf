"""Compatibility facade for the in-process document retrieval agent.

The implementation is split by responsibility across ``agent_llm``,
``agent_evidence`` and ``retrieval_agent``.  Imports historically exposed by
this module remain available so callers do not need to migrate atomically.
"""

from __future__ import annotations

from .agent_evidence import (
    BLOCK_ID_BARE_RE,
    BLOCK_ID_BRACKET_RE,
    CITATION_RE,
    MARKDOWN_ID_BARE_RE,
    MARKDOWN_ID_BRACKET_RE,
    _public_anchor,
    assign_refs,
    public_tool_payload,
    referenced_citations,
    sanitize_answer_text,
)
from .agent_llm import (
    assemble_streaming_message,
    build_deepseek_chat_fn,
    friendly_llm_error,
)
from .retrieval_agent import (
    DOCUMENT_READING_TOOL_NAMES,
    MARKDOWN_TOOL_NAMES,
    STRUCTURED_READING_TOOL_NAMES,
    SYSTEM_PROMPT,
    RetrievalAgent,
    scope_tool_arguments,
    tool_specs_for_scope,
)
from .runtimes.contracts import AskResult, ChatFn, Citation

__all__ = [
    "BLOCK_ID_BARE_RE",
    "BLOCK_ID_BRACKET_RE",
    "CITATION_RE",
    "DOCUMENT_READING_TOOL_NAMES",
    "MARKDOWN_ID_BARE_RE",
    "MARKDOWN_ID_BRACKET_RE",
    "MARKDOWN_TOOL_NAMES",
    "STRUCTURED_READING_TOOL_NAMES",
    "SYSTEM_PROMPT",
    "AskResult",
    "ChatFn",
    "Citation",
    "RetrievalAgent",
    "_public_anchor",
    "assemble_streaming_message",
    "assign_refs",
    "build_deepseek_chat_fn",
    "friendly_llm_error",
    "public_tool_payload",
    "referenced_citations",
    "sanitize_answer_text",
    "scope_tool_arguments",
    "tool_specs_for_scope",
]

# Private names were imported by the original tests and a few integrations.
_assign_refs = assign_refs
_friendly_llm_error = friendly_llm_error
_public_tool_payload = public_tool_payload
_referenced_citations = referenced_citations
_sanitize_answer_text = sanitize_answer_text
_scope_tool_arguments = scope_tool_arguments
_tool_specs_for_scope = tool_specs_for_scope
