"""Document-scoped retrieval agent and its bounded tool loop."""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

from .agent_evidence import (
    assign_refs,
    public_tool_payload,
    referenced_citations,
    sanitize_answer_text,
)
from .prompts import build_reading_system_prompt
from .request_control import RequestControl
from .runtimes.contracts import AskResult, ChatFn, Citation
from .tools import ToolRegistry
from .unified_tools import (
    CALCULATION_TOOL_NAMES,
    agent_tool_event,
    with_tool_context,
)

SYSTEM_PROMPT = build_reading_system_prompt()
MARKDOWN_TOOL_NAMES = frozenset({"search_markdown", "read_markdown_chunk"})
STRUCTURED_READING_TOOL_NAMES = frozenset({"search_fulltext", "read_blocks"})
DOCUMENT_READING_TOOL_NAMES = frozenset(
    (*STRUCTURED_READING_TOOL_NAMES, *MARKDOWN_TOOL_NAMES)
)
DOCUMENT_SEARCH_TOOL_NAMES = frozenset({"search_fulltext", "search_markdown"})


class RetrievalAgent:
    """Run a bounded function-calling loop over RetainPDF retrieval tools."""

    def __init__(
        self,
        registry: ToolRegistry,
        chat_fn: ChatFn,
        *,
        max_tool_rounds: int = 6,
    ) -> None:
        self._registry = registry
        self._chat = chat_fn
        self._max_tool_rounds = max(1, max_tool_rounds)

    @property
    def registry(self) -> ToolRegistry:
        """Expose the read-only tool registry to unified host runtimes."""
        return self._registry

    def ask(
        self,
        question: str,
        *,
        conversation_id: str = "",
        document_id: str = "",
        job_id: str = "",
        request_message_id: str = "",
        on_event: Callable[[dict[str, Any]], None] | None = None,
        chat_fn: ChatFn | None = None,
        history: list[dict[str, str]] | None = None,
        max_tool_rounds: int | None = None,
        content_source: str = "auto",
        request_control: RequestControl | None = None,
    ) -> AskResult:
        emit = on_event or (lambda event: None)
        chat = chat_fn or self._chat
        scoped_document_id = document_id.strip()
        scoped_job_id = job_id.strip()
        messages = _initial_messages(
            question,
            document_id=scoped_document_id,
            job_id=scoped_job_id,
            history=history,
        )
        citations: dict[int, Citation] = {}
        trace: list[dict[str, Any]] = []
        calculation_refs: dict[str, dict[str, Any]] = {}
        next_ref = 1
        tool_specs = tool_specs_for_scope(
            self._registry,
            scoped_document_id,
            scoped_job_id,
            content_source=content_source,
        )
        allowed_tool_names = {
            str((spec.get("function") or {}).get("name") or "") for spec in tool_specs
        }
        document_reading_mode = bool(allowed_tool_names & DOCUMENT_READING_TOOL_NAMES)
        requires_document_search = bool(scoped_document_id or scoped_job_id) and document_reading_mode
        searched_document = False
        structured_search_available = "search_fulltext" in allowed_tool_names
        markdown_fallback_allowed = not structured_search_available
        round_limit = max(
            1,
            min(
                self._max_tool_rounds,
                max_tool_rounds if max_tool_rounds is not None else self._max_tool_rounds,
            ),
        )

        for round_index in range(1, round_limit + 1):
            if request_control is not None:
                request_control.raise_if_stopped()
            message = chat(messages, tool_specs)
            tool_calls = message.get("tool_calls") or []
            if not tool_calls:
                if requires_document_search and not searched_document:
                    if round_index < round_limit:
                        _request_required_document_search(messages, content_source)
                        continue
                    return AskResult(
                        answer="当前回答尚未完成文档检索，无法可靠回答。请重试。",
                        tool_trace=trace,
                        rounds=round_index,
                    )
                return _answer_result(
                    message, citations, trace, round_index, calculation_refs
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
                name = call.get("function", {}).get("name", "")
                if document_reading_mode and name not in allowed_tool_names:
                    _reject_hidden_tool(
                        call,
                        name=name,
                        round_index=round_index,
                        messages=messages,
                        trace=trace,
                        emit=emit,
                    )
                    continue
                if name in MARKDOWN_TOOL_NAMES and not markdown_fallback_allowed:
                    _reject_early_markdown_fallback(
                        call,
                        name=name,
                        round_index=round_index,
                        messages=messages,
                        trace=trace,
                        emit=emit,
                    )
                    continue
                arguments = _parse_tool_arguments(call)
                arguments = scope_tool_arguments(
                    name,
                    arguments,
                    document_id=scoped_document_id,
                    job_id=scoped_job_id,
                )
                call_id = str(call.get("id") or "")[:256]
                if name in CALCULATION_TOOL_NAMES:
                    arguments = with_tool_context(
                        arguments,
                        conversation_id=conversation_id,
                        request_message_id=request_message_id,
                        document_id=scoped_document_id,
                        job_id=scoped_job_id,
                        tool_call_id=call_id,
                    )
                if name in DOCUMENT_SEARCH_TOOL_NAMES:
                    searched_document = True
                emit(agent_tool_event(name, call_id, "running"))
                result = self._registry.invoke(name, arguments)
                calculation_id = str(result.get("calculation_id") or "").strip()
                if calculation_id:
                    calculation_refs[calculation_id] = {
                        "calculation_id": calculation_id,
                        "status": "failed" if result.get("error") else "completed",
                    }
                if name == "search_fulltext":
                    markdown_fallback_allowed = (
                        result.get("structured_data_available") is False
                    )
                next_ref = assign_refs(result, citations, next_ref)
                emit(
                    agent_tool_event(
                        name,
                        call_id,
                        "failed" if result.get("error") else "completed",
                        result,
                    )
                )
                trace_entry: dict[str, Any] = {"round": round_index, "tool": name}
                if name not in CALCULATION_TOOL_NAMES:
                    trace_entry["arguments"] = arguments
                trace.append(trace_entry)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.get("id", ""),
                        "content": json.dumps(
                            result
                            if name in CALCULATION_TOOL_NAMES
                            else public_tool_payload(result),
                            ensure_ascii=False,
                        ),
                    }
                )

        messages.append(
            {
                "role": "user",
                "content": (
                    "请基于以上已检索到的证据直接给出最终回答,不要再调用工具。"
                    "引用只用 [n]。"
                ),
            }
        )
        # Use the request-level chat transport here as well: deployments may
        # provide credentials per request while the startup transport has none.
        if request_control is not None:
            request_control.raise_if_stopped()
        message = chat(messages, [])
        return _answer_result(
            message,
            citations,
            trace,
            round_limit,
            calculation_refs,
        )


def _initial_messages(
    question: str,
    *,
    document_id: str,
    job_id: str,
    history: list[dict[str, str]] | None,
) -> list[dict[str, Any]]:
    user_content = question.strip()
    if document_id or job_id:
        user_content = (
            f"(限定当前结构化文档 document_id={document_id or 'unknown'}"
            f"{f', job_id={job_id}' if job_id else ''}"
            "。优先使用 search_fulltext / read_blocks 读取同一套原文、译文与版面块；"
            "仅在 search_fulltext 明确报告没有结构化数据时使用 Markdown 兼容工具。)\n"
            f"{user_content}"
        )
    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    if not (document_id or job_id):
        messages[0]["content"] += "\n\n" + (
            "当前请求没有绑定文档。普通聊天、通用知识或连通性测试可以直接回答，"
            "不要求文档检索或引用，也不要声称已读取某篇文档。"
            "若用户确实询问文档内容，应使用检索工具取得证据，"
            "或请用户明确选择文档；不得编造文档内容或引用。"
        )
    for turn in history or []:
        role = str(turn.get("role") or "")
        content = str(turn.get("content") or "").strip()
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_content})
    return messages


def _request_required_document_search(
    messages: list[dict[str, Any]], content_source: str = "auto"
) -> None:
    if content_source == "markdown":
        instruction = (
            "回答当前文档前必须先调用 search_markdown 检索 Markdown，"
            "再用 read_markdown_chunk 读取证据。"
        )
    else:
        instruction = (
            "回答当前文档前必须先调用 search_fulltext 检索结构化块。"
            "结构化数据存在但无命中时应更换关键词继续检索。"
        )
    messages.extend(
        [
            {"role": "assistant", "content": ""},
            {
                "role": "user",
                "content": instruction,
            },
        ]
    )


def _parse_tool_arguments(call: dict[str, Any]) -> dict[str, Any]:
    try:
        arguments = json.loads(call.get("function", {}).get("arguments") or "{}")
    except json.JSONDecodeError:
        return {}
    return arguments if isinstance(arguments, dict) else {}


def _reject_hidden_tool(
    call: dict[str, Any],
    *,
    name: str,
    round_index: int,
    messages: list[dict[str, Any]],
    trace: list[dict[str, Any]],
    emit: Callable[[dict[str, Any]], None],
) -> None:
    arguments = {"skipped": True}
    result = {
        "error": (
            "当前文档问答不允许调用该工具，请使用 search_fulltext / read_blocks；"
            "旧任务缺少结构化数据时才使用 search_markdown / read_markdown_chunk。"
        )
    }
    event = {
        "type": "tool",
        "round": round_index,
        "tool": name,
        "arguments": arguments,
    }
    emit(event)
    trace.append({"round": round_index, "tool": name, "arguments": arguments})
    messages.append(
        {
            "role": "tool",
            "tool_call_id": call.get("id", ""),
            "content": json.dumps(result, ensure_ascii=False),
        }
    )


def _reject_early_markdown_fallback(
    call: dict[str, Any],
    *,
    name: str,
    round_index: int,
    messages: list[dict[str, Any]],
    trace: list[dict[str, Any]],
    emit: Callable[[dict[str, Any]], None],
) -> None:
    arguments = {"skipped": True}
    result = {
        "error": (
            "请先调用 search_fulltext 检索结构化文档块；只有它明确报告当前文档没有"
            f"结构化数据时，才可调用 {name}。单次无命中不会启用 Markdown。"
        )
    }
    emit(
        {
            "type": "tool",
            "round": round_index,
            "tool": name,
            "arguments": arguments,
        }
    )
    trace.append({"round": round_index, "tool": name, "arguments": arguments})
    messages.append(
        {
            "role": "tool",
            "tool_call_id": call.get("id", ""),
            "content": json.dumps(result, ensure_ascii=False),
        }
    )


def _answer_result(
    message: dict[str, Any],
    citations: dict[int, Citation],
    trace: list[dict[str, Any]],
    rounds: int,
    calculation_refs: dict[str, dict[str, Any]] | None = None,
) -> AskResult:
    answer = sanitize_answer_text(str(message.get("content") or "").strip(), citations)
    return AskResult(
        answer=answer,
        citations=referenced_citations(answer, citations),
        tool_trace=trace,
        rounds=rounds,
        calculation_refs=list((calculation_refs or {}).values()),
    )


def scope_tool_arguments(
    name: str,
    arguments: dict[str, Any],
    *,
    document_id: str = "",
    job_id: str = "",
) -> dict[str, Any]:
    """Force tool calls into the current document/job scope."""
    scoped = dict(arguments)
    if name in MARKDOWN_TOOL_NAMES:
        if document_id:
            scoped["document_id"] = document_id
        if job_id:
            scoped["job_id"] = job_id
        return scoped
    if not document_id:
        return scoped
    if name in {"search_fulltext", "search_favorites", "list_documents", "read_blocks"}:
        scoped["document_id"] = document_id
    if name == "search_fulltext" and job_id:
        # Internal scope only: the tool uses this to decide whether the exact
        # reader job has a document.v1 artifact.  Rust full-text search remains
        # document scoped.
        scoped["job_id"] = job_id
    if name == "read_blocks" and job_id and not str(scoped.get("job_id") or "").strip():
        scoped["job_id"] = job_id
    return scoped


def tool_specs_for_scope(
    registry: ToolRegistry,
    document_id: str = "",
    job_id: str = "",
    *,
    content_source: str = "auto",
) -> list[dict[str, Any]]:
    """Expose structured document tools first, with Markdown as legacy fallback."""
    specs = registry.specs()
    names = {str((spec.get("function") or {}).get("name") or "") for spec in specs}
    if document_id.strip() and names & DOCUMENT_READING_TOOL_NAMES:
        by_name = {
            str((spec.get("function") or {}).get("name") or ""): spec
            for spec in specs
        }
        preferred_order = (
            "search_fulltext",
            "read_blocks",
            "search_markdown",
            "read_markdown_chunk",
        )
        preferred = [by_name[name] for name in preferred_order if name in by_name]
        preferred_names = set(preferred_order) | {"list_documents"}
        selected = [
            *preferred,
            *[
                spec
                for spec in specs
                if str((spec.get("function") or {}).get("name") or "")
                not in preferred_names
            ],
        ]
        if content_source == "structured":
            return [
                spec
                for spec in selected
                if str((spec.get("function") or {}).get("name") or "")
                not in MARKDOWN_TOOL_NAMES
            ]
        if content_source == "markdown":
            return [
                spec
                for spec in selected
                if str((spec.get("function") or {}).get("name") or "")
                not in STRUCTURED_READING_TOOL_NAMES
            ]
        if content_source == "none":
            return [
                spec
                for spec in selected
                if str((spec.get("function") or {}).get("name") or "")
                not in DOCUMENT_READING_TOOL_NAMES
            ]
        return selected
    if job_id.strip():
        return [
            spec
            for spec in specs
            if str((spec.get("function") or {}).get("name") or "")
            in MARKDOWN_TOOL_NAMES | CALCULATION_TOOL_NAMES
        ]
    if not document_id.strip():
        return [
            spec
            for spec in specs
            if str((spec.get("function") or {}).get("name") or "")
            not in MARKDOWN_TOOL_NAMES
        ]
    return [
        spec
        for spec in specs
        if str((spec.get("function") or {}).get("name") or "") != "list_documents"
    ]


_scope_tool_arguments = scope_tool_arguments
_tool_specs_for_scope = tool_specs_for_scope

# Historical private import retained for compatibility with tests/integrations.
_request_required_markdown_search = _request_required_document_search
