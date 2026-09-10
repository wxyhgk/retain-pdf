"""Runtime-neutral facade for one model loop with the complete safe tool surface."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from .contracts import AgentRuntime, AskResult, ChatFn, RuntimeCapabilities


class UnifiedAgentRuntime:
    """Expose a single selected model loop without chaining model runtimes.

    The delegate owns the actual turn.  This facade is intentionally thin: it
    gives legacy runtime selections a stable identity while ensuring one model
    sees reading, calculation, and PDF-operation tools in the same loop.
    """

    def __init__(self, runtime_id: str, delegate: AgentRuntime) -> None:
        self.runtime_id = runtime_id
        self.capabilities: RuntimeCapabilities = delegate.capabilities
        self._delegate = delegate

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
    ) -> AskResult:
        return self._delegate.ask(
            question,
            conversation_id=conversation_id,
            document_id=document_id,
            job_id=job_id,
            request_message_id=request_message_id,
            confirmed=confirmed,
            on_event=on_event,
            chat_fn=chat_fn,
            history=history,
            max_tool_rounds=max_tool_rounds,
            content_source=content_source,
            request_control=request_control,
        )

    def content_source(self, document_id: str = "", job_id: str = "") -> str:
        resolver = getattr(self._delegate, "content_source", None)
        if callable(resolver):
            return str(resolver(document_id, job_id))
        return "unscoped" if not (document_id.strip() or job_id.strip()) else "unknown"
