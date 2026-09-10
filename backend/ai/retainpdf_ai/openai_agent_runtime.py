"""Compatibility facade for the OpenAI-compatible agent runtime."""

from .runtimes.openai import (
    DOCUMENT_AGENT_TOOLS,
    OPENAI_AGENT_RUNTIME_ID,
    OpenAICompatibleAgentRuntime,
)

__all__ = [
    "DOCUMENT_AGENT_TOOLS",
    "OPENAI_AGENT_RUNTIME_ID",
    "OpenAICompatibleAgentRuntime",
]
