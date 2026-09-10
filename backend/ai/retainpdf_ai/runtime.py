"""Compatibility facade for RetainPDF agent runtimes.

Runtime implementations live in :mod:`retainpdf_ai.runtimes`. Keep this module
as the stable import boundary for the API service and downstream callers.
"""

from .openai_agent_runtime import (
    OPENAI_AGENT_RUNTIME_ID,
    OpenAICompatibleAgentRuntime,
)
from .runtimes import (
    FX_RUNTIME_ID,
    AgentRuntime,
    FxAcpRuntime,
    FxCapability,
    PythonAgentRuntime,
    RuntimeCapabilities,
    UnifiedAgentRuntime,
    build_agent_runtime,
    probe_fx_gateway_endpoint,
)

__all__ = [
    "FX_RUNTIME_ID",
    "OPENAI_AGENT_RUNTIME_ID",
    "AgentRuntime",
    "FxAcpRuntime",
    "FxCapability",
    "OpenAICompatibleAgentRuntime",
    "PythonAgentRuntime",
    "RuntimeCapabilities",
    "UnifiedAgentRuntime",
    "build_agent_runtime",
    "probe_fx_gateway_endpoint",
]
