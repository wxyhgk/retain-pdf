"""OpenAI-compatible document Agent runtime implementation.

This runtime owns only model turns and structured function calling.  Durable
document state, operation execution, candidate publication, and commit remain
owned by Rust.  Every model tool call is projected into the same exact
``retainpdf-agent`` grammar used by the fx ACP adapter.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from contextlib import nullcontext
from typing import Any

from ..agent import (
    assign_refs,
    build_deepseek_chat_fn,
    public_tool_payload,
    referenced_citations,
    sanitize_answer_text,
    scope_tool_arguments,
    tool_specs_for_scope,
)
from ..agent_command_broker import AgentCommandBroker, BrokerScope
from ..config import Settings
from ..operation_context import load_operation_context
from ..prompts import build_operation_system_prompt
from ..request_control import RequestControl
from ..rust_client import RustApiClient
from ..tools import ToolRegistry
from ..unified_tools import (
    CALCULATION_TOOL_NAMES,
    READING_TOOL_NAMES,
    agent_tool_event,
    with_tool_context,
)
from .contracts import AskResult, ChatFn, Citation, RuntimeCapabilities
from .openai_operations import (
    DOCUMENT_AGENT_TOOLS,
    invoke_operation_tool,
    parse_tool_arguments,
)

OPENAI_AGENT_RUNTIME_ID = "openai-compatible-agent-v1"
_MAX_ANSWER_CHARS = 1024 * 1024
_LIBRARY_READING_TOOL_NAMES = frozenset(
    {"list_documents", "search_fulltext", "read_blocks", "search_favorites"}
)

class OpenAICompatibleAgentRuntime:
    runtime_id = OPENAI_AGENT_RUNTIME_ID

    def __init__(
        self,
        settings: Settings,
        rust: RustApiClient,
        reading_registry: ToolRegistry | None = None,
    ) -> None:
        self._settings = settings
        self._rust = rust
        self._reading_registry = reading_registry
        self._chat = build_deepseek_chat_fn(settings)
        registered_names = (
            {
                str((spec.get("function") or {}).get("name") or "")
                for spec in reading_registry.specs()
            }
            if reading_registry is not None
            else set()
        )
        calculation_available = CALCULATION_TOOL_NAMES.issubset(registered_names)
        self.capabilities = RuntimeCapabilities(
            document_reading=bool(READING_TOOL_NAMES & registered_names),
            document_operations=True,
            streaming=True,
            durable_sessions=False,
            model_transport="host_chat",
            confirmation_modes=frozenset({"explicit", "green_light"}),
            calculation=calculation_available,
            durable_calculations=calculation_available,
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
        request_control: RequestControl | None = None,
    ) -> AskResult:
        emit = on_event or (lambda _event: None)
        chat = chat_fn or self._chat
        conversation_id = conversation_id.strip()
        document_id = document_id.strip()
        request_message_id = request_message_id.strip()
        operation_tools_available = bool(
            conversation_id and document_id and request_message_id
        )
        reading_specs = (
            tool_specs_for_scope(
                self._reading_registry,
                document_id,
                job_id.strip(),
                content_source=content_source,
            )
            if self._reading_registry is not None and (document_id or job_id.strip())
            else self._reading_registry.specs(_LIBRARY_READING_TOOL_NAMES)
            if self._reading_registry is not None
            else []
        )
        reading_tool_names = {
            str((spec.get("function") or {}).get("name") or "")
            for spec in reading_specs
        }
        tool_specs = [
            *(DOCUMENT_AGENT_TOOLS if operation_tools_available else []),
            *reading_specs,
        ]
        green_light = self._settings.agent_confirmation_mode == "green_light"
        operations = load_operation_context(
            self._rust,
            conversation_id=conversation_id,
            document_id=document_id,
        )
        messages: list[dict[str, Any]] = [
            {
                "role": "system",
                "content": build_operation_system_prompt(
                    document_id=document_id,
                    conversation_id=conversation_id,
                    tools_available=operation_tools_available,
                    confirmation_mode=(
                        "green_light" if green_light else "explicit"
                    ),
                    confirmed=confirmed,
                    operations=operations,
                    reading_available=bool(reading_specs),
                ),
            }
        ]
        for turn in history or []:
            role = str(turn.get("role") or "")
            content = str(turn.get("content") or "").strip()
            if role in {"user", "assistant"} and content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": question.strip()})

        if not tool_specs:
            message = chat(messages, [])
            return AskResult(
                answer=str(message.get("content") or "").strip()[:_MAX_ANSWER_CHARS],
                rounds=1,
            )

        operation_refs: dict[str, dict[str, Any]] = {}
        calculation_refs: dict[str, dict[str, Any]] = {}
        trace: list[dict[str, Any]] = []
        ran_in_this_turn: set[str] = set()
        citations: dict[int, Citation] = {}
        next_ref = 1
        round_limit = max(
            1,
            min(
                self._settings.max_tool_rounds,
                max_tool_rounds
                if max_tool_rounds is not None
                else self._settings.max_tool_rounds,
            ),
        )
        structured_search_available = "search_fulltext" in reading_tool_names
        markdown_fallback_allowed = not structured_search_available

        def on_operation_event(event: dict[str, Any]) -> None:
            operation_id = str(event.get("operation_id") or "").strip()
            if operation_id:
                operation_refs[operation_id] = {
                    "operation_id": operation_id,
                    "status": str(event.get("status") or ""),
                    "current_attempt": int(event.get("current_attempt") or 0),
                    "latest_event_seq": int(event.get("latest_event_seq") or 0),
                }
            emit(event)

        broker_context = (
            AgentCommandBroker(
                state_root=self._settings.data_root / "agent-runtime" / "openai-compatible",
                cli_command=(
                    self._settings.agent_cli_command
                    or self._settings.fx_agent_cli_command
                ),
                rust_api_url=self._settings.rust_api_base,
                rust=self._rust,
                scope=BrokerScope(
                    conversation_id=conversation_id,
                    document_id=document_id,
                    request_message_id=request_message_id,
                    intent_summary=question,
                    confirmed=confirmed,
                    green_light=green_light,
                ),
                on_operation_event=on_operation_event,
            )
            if operation_tools_available
            else nullcontext(None)
        )
        with broker_context as broker:
            for round_index in range(1, round_limit + 1):
                if request_control is not None:
                    request_control.raise_if_stopped()
                message = chat(messages, tool_specs)
                tool_calls = message.get("tool_calls") or []
                if not tool_calls:
                    answer = sanitize_answer_text(
                        str(message.get("content") or "").strip()[:_MAX_ANSWER_CHARS],
                        citations,
                    )
                    return AskResult(
                        answer=answer,
                        citations=referenced_citations(answer, citations),
                        tool_trace=trace,
                        rounds=round_index,
                        operation_refs=list(operation_refs.values()),
                        calculation_refs=list(calculation_refs.values()),
                    )
                messages.append(
                    {
                        "role": "assistant",
                        "content": message.get("content") or "",
                        "tool_calls": tool_calls,
                    }
                )
                for call in tool_calls:
                    if request_control is not None:
                        request_control.raise_if_stopped()
                    call_id = str(call.get("id") or "")[:256]
                    function = call.get("function") or {}
                    name = str(function.get("name") or "")
                    arguments = parse_tool_arguments(function.get("arguments"))
                    if name in reading_tool_names and self._reading_registry is not None:
                        scoped_arguments = scope_tool_arguments(
                            name,
                            arguments,
                            document_id=document_id,
                            job_id=job_id.strip(),
                        )
                        if name in CALCULATION_TOOL_NAMES:
                            scoped_arguments = with_tool_context(
                                scoped_arguments,
                                conversation_id=conversation_id,
                                request_message_id=request_message_id,
                                document_id=document_id,
                                job_id=job_id.strip(),
                                tool_call_id=call_id,
                            )
                        if (
                            name in {"search_markdown", "read_markdown_chunk"}
                            and not markdown_fallback_allowed
                        ):
                            result = {
                                "error": (
                                    "请先调用 search_fulltext 检索结构化文档块；只有它明确报告当前文档没有"
                                    f"结构化数据时，才可调用 {name}。单次无命中不会启用 Markdown。"
                                )
                            }
                            trace.append(
                                {
                                    "round": round_index,
                                    "tool": name,
                                    "status": "skipped",
                                }
                            )
                            messages.append(
                                {
                                    "role": "tool",
                                    "tool_call_id": call_id,
                                    "content": json.dumps(result, ensure_ascii=False),
                                }
                            )
                            continue
                        emit(agent_tool_event(name, call_id, "running"))
                        raw_result = self._reading_registry.invoke(name, scoped_arguments)
                        if name == "search_fulltext":
                            markdown_fallback_allowed = (
                                raw_result.get("structured_data_available") is False
                            )
                        next_ref = assign_refs(raw_result, citations, next_ref)
                        calculation_id = str(
                            raw_result.get("calculation_id") or ""
                        ).strip()
                        if calculation_id:
                            calculation_refs[calculation_id] = {
                                "calculation_id": calculation_id,
                                "status": (
                                    "failed" if raw_result.get("error") else "completed"
                                ),
                            }
                        result = (
                            raw_result
                            if name in CALCULATION_TOOL_NAMES
                            else public_tool_payload(raw_result)
                        )
                        trace.append(
                            {
                                "round": round_index,
                                "tool": name,
                                "status": "failed" if result.get("error") else "completed",
                            }
                        )
                        emit(
                            agent_tool_event(
                                name,
                                call_id,
                                "failed" if result.get("error") else "completed",
                                result,
                            )
                        )
                        messages.append(
                            {
                                "role": "tool",
                                "tool_call_id": call_id,
                                "content": json.dumps(result, ensure_ascii=False),
                            }
                        )
                        continue
                    emit(agent_tool_event(name, call_id, "running"))
                    result = (
                        invoke_operation_tool(
                            broker,
                            name,
                            arguments,
                            ran_in_this_turn=ran_in_this_turn,
                            allow_same_turn_commit=green_light,
                        )
                        if broker is not None
                        else {
                            "ok": False,
                            "code": "document_scope_required",
                            "error": "durable document scope is required",
                        }
                    )
                    trace.append(
                        {
                            "round": round_index,
                            "tool": name,
                            "status": "completed" if result.get("ok") else "failed",
                        }
                    )
                    emit(
                        agent_tool_event(
                            name,
                            call_id,
                            "completed" if result.get("ok") else "failed",
                            result,
                        )
                    )
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": call_id,
                            "content": json.dumps(result, ensure_ascii=False),
                        }
                    )

            messages.append(
                {
                    "role": "user",
                    "content": "工具轮数已用完。请根据已有工具结果总结，不要再调用工具。",
                }
            )
            if request_control is not None:
                request_control.raise_if_stopped()
            final = chat(messages, [])
            answer = sanitize_answer_text(
                str(final.get("content") or "").strip()[:_MAX_ANSWER_CHARS],
                citations,
            )
            return AskResult(
                answer=answer,
                citations=referenced_citations(answer, citations),
                tool_trace=trace,
                rounds=round_limit + 1,
                operation_refs=list(operation_refs.values()),
                calculation_refs=list(calculation_refs.values()),
            )

    def content_source(self, document_id: str = "", job_id: str = "") -> str:
        resolver = getattr(self._reading_registry, "content_source", None)
        if callable(resolver):
            return str(resolver(document_id, job_id))
        return "unscoped" if not (document_id.strip() or job_id.strip()) else "unknown"
