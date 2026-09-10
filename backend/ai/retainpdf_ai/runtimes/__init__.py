"""Agent runtimes with lazy concrete exports to keep contracts cycle-free."""

from __future__ import annotations

from typing import Any

from .contracts import (
    AgentRuntime,
    AskResult,
    ChatFn,
    Citation,
    RuntimeCapabilities,
)

_LAZY_EXPORTS = {
    "FX_RUNTIME_ID",
    "FxAcpRuntime",
    "FxCapability",
    "OPENAI_AGENT_RUNTIME_ID",
    "OpenAICompatibleAgentRuntime",
    "PythonAgentRuntime",
    "UnifiedAgentRuntime",
    "build_agent_runtime",
    "probe_fx_gateway_endpoint",
}


def __getattr__(name: str) -> Any:
    if name == "build_agent_runtime":
        from .factory import build_agent_runtime

        return build_agent_runtime
    if name in {"FX_RUNTIME_ID", "FxAcpRuntime", "FxCapability"}:
        from .fx import FX_RUNTIME_ID, FxAcpRuntime, FxCapability

        return {
            "FX_RUNTIME_ID": FX_RUNTIME_ID,
            "FxAcpRuntime": FxAcpRuntime,
            "FxCapability": FxCapability,
        }[name]
    if name == "PythonAgentRuntime":
        from .python import PythonAgentRuntime

        return PythonAgentRuntime
    if name == "UnifiedAgentRuntime":
        from .unified import UnifiedAgentRuntime

        return UnifiedAgentRuntime
    if name in {"OPENAI_AGENT_RUNTIME_ID", "OpenAICompatibleAgentRuntime"}:
        from .openai import OPENAI_AGENT_RUNTIME_ID, OpenAICompatibleAgentRuntime

        return {
            "OPENAI_AGENT_RUNTIME_ID": OPENAI_AGENT_RUNTIME_ID,
            "OpenAICompatibleAgentRuntime": OpenAICompatibleAgentRuntime,
        }[name]
    if name == "probe_fx_gateway_endpoint":
        from .fx_gateway import probe_fx_gateway_endpoint

        return probe_fx_gateway_endpoint
    raise AttributeError(name)


def __dir__() -> list[str]:
    return sorted({*globals(), *_LAZY_EXPORTS})


__all__ = [
    "FX_RUNTIME_ID",
    "OPENAI_AGENT_RUNTIME_ID",
    "AgentRuntime",
    "AskResult",
    "ChatFn",
    "Citation",
    "FxAcpRuntime",
    "FxCapability",
    "OpenAICompatibleAgentRuntime",
    "PythonAgentRuntime",
    "RuntimeCapabilities",
    "UnifiedAgentRuntime",
    "build_agent_runtime",
    "probe_fx_gateway_endpoint",
]
