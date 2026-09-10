"""Runtime-neutral request, result and capability contracts."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol


@dataclass
class Citation:
    ref: int
    document_id: str
    job_id: str
    page_idx: int | None
    block_id: str
    snippet: str
    image_urls: list[str] = field(default_factory=list)


@dataclass
class AskResult:
    answer: str
    citations: list[Citation] = field(default_factory=list)
    tool_trace: list[dict[str, Any]] = field(default_factory=list)
    rounds: int = 0
    operation_refs: list[dict[str, Any]] = field(default_factory=list)
    calculation_refs: list[dict[str, Any]] = field(default_factory=list)


ChatFn = Callable[[list[dict[str, Any]], list[dict[str, Any]]], dict[str, Any]]
ModelTransport = Literal["host_chat", "runtime_managed"]


@dataclass(frozen=True)
class RuntimeCapabilities:
    """Machine-readable behavior used by routing and request orchestration."""

    document_reading: bool
    document_operations: bool
    streaming: bool
    durable_sessions: bool
    model_transport: ModelTransport
    confirmation_modes: frozenset[str] = frozenset()
    calculation: bool = False
    durable_calculations: bool = False
    python_analysis: bool = False

    def supports_confirmation_mode(self, mode: str) -> bool:
        return mode in self.confirmation_modes

    def public_view(self) -> dict[str, Any]:
        view = {
            "document_reading": self.document_reading,
            "document_operations": self.document_operations,
            "calculation": self.calculation,
            "durable_calculations": self.durable_calculations,
            "python_analysis": self.python_analysis,
            "streaming": self.streaming,
            "durable_sessions": self.durable_sessions,
            "model_transport": self.model_transport,
            "confirmation_modes": sorted(self.confirmation_modes),
        }
        return view


class AgentRuntime(Protocol):
    runtime_id: str
    capabilities: RuntimeCapabilities

    def ask(
        self,
        question: str,
        *,
        conversation_id: str = "",
        document_id: str = "",
        job_id: str = "",
        request_message_id: str = "",
        confirmed: bool = False,
        on_event: Callable[[dict[str, Any]], None] | None = None,
        chat_fn: ChatFn | None = None,
        history: list[dict[str, str]] | None = None,
        max_tool_rounds: int | None = None,
        content_source: str = "auto",
        request_control: Any | None = None,
    ) -> AskResult: ...
