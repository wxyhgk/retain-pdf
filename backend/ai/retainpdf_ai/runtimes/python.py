"""Adapter for the in-process Markdown retrieval agent."""

from __future__ import annotations

import inspect
from collections.abc import Callable
from typing import Any

from ..agent import RetrievalAgent
from .contracts import AskResult, ChatFn, RuntimeCapabilities


class PythonAgentRuntime:
    runtime_id = "python-retrieval-v1"
    capabilities = RuntimeCapabilities(
        document_reading=True,
        document_operations=False,
        streaming=True,
        durable_sessions=False,
        model_transport="host_chat",
    )

    def __init__(self, agent: RetrievalAgent) -> None:
        self._agent = agent
        registry = getattr(agent, "registry", None)
        names = {
            str((spec.get("function") or {}).get("name") or "")
            for spec in registry.specs()
        } if registry is not None else set()
        calculation = "calculate_expression" in names
        self.capabilities = RuntimeCapabilities(
            document_reading=True,
            document_operations=False,
            streaming=True,
            durable_sessions=False,
            model_transport="host_chat",
            calculation=calculation,
            durable_calculations=calculation,
            python_analysis=False,
        )

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
        del confirmed
        arguments = {
            "document_id": document_id,
            "job_id": job_id,
            "on_event": on_event,
            "chat_fn": chat_fn,
            "history": history,
            "max_tool_rounds": max_tool_rounds,
            "content_source": content_source,
            "request_control": request_control,
        }
        parameters = inspect.signature(self._agent.ask).parameters
        arguments = {
            key: value for key, value in arguments.items() if key in parameters
        }
        if "conversation_id" in parameters and "request_message_id" in parameters:
            arguments.update(
                conversation_id=conversation_id,
                request_message_id=request_message_id,
            )
        return self._agent.ask(question, **arguments)

    def content_source(self, document_id: str = "", job_id: str = "") -> str:
        registry = getattr(self._agent, "registry", None)
        resolver = getattr(registry, "content_source", None)
        if callable(resolver):
            return str(resolver(document_id, job_id))
        return "unscoped" if not (document_id.strip() or job_id.strip()) else "unknown"
