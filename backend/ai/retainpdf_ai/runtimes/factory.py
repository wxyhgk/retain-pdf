"""Select and validate the configured agent runtime."""

from __future__ import annotations

from ..agent import RetrievalAgent
from ..config import Settings
from ..rust_client import RustApiClient
from .contracts import AgentRuntime
from .fx import FxAcpRuntime
from .openai import OpenAICompatibleAgentRuntime
from .unified import UnifiedAgentRuntime


def build_agent_runtime(
    settings: Settings,
    rust: RustApiClient,
    python_agent: RetrievalAgent,
) -> AgentRuntime:
    runtime = settings.agent_runtime.strip().lower()
    if runtime == "python":
        return UnifiedAgentRuntime(
            "python-unified-agent-v1",
            OpenAICompatibleAgentRuntime(
                settings,
                rust,
                reading_registry=getattr(python_agent, "registry", None),
            ),
        )
    if runtime == "fx":
        candidate = FxAcpRuntime(
            settings,
            rust,
            reading_registry=getattr(python_agent, "registry", None),
        )
        capability = candidate.probe()
        if not capability.available:
            raise RuntimeError(
                "fx runtime capability probe failed: "
                f"{capability.detail or capability.actual_version or 'unavailable'}"
            )
        return candidate
    if runtime == "openai":
        return OpenAICompatibleAgentRuntime(
            settings,
            rust,
            reading_registry=getattr(python_agent, "registry", None),
        )
    raise RuntimeError(
        f"unsupported RETAIN_AI_RUNTIME={settings.agent_runtime!r}; "
        "expected python, openai, or fx"
    )
