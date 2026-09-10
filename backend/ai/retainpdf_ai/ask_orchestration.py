"""Request-scoped orchestration for synchronous and streaming AI turns."""

from __future__ import annotations

import inspect
import json
import queue
import threading
from collections.abc import Callable, Iterator
from dataclasses import asdict, dataclass, replace
from typing import Any

from fastapi import HTTPException

from .api_contracts import AskInput
from .config import Settings
from .conversation_state import ConversationState
from .credential_vault import CredentialReferenceError, resolve_credential
from .request_control import (
    AIRequestError,
    AIRequestTimeout,
    EmptyAIResponse,
    RequestControl,
    public_error_event,
)
from .request_routing import RouteDecision, resolve_assistant_mode
from .runtimes.contracts import AgentRuntime

ChatFnBuilder = Callable[..., Any]
ConfirmationProjector = Callable[[Any, str], list[dict[str, Any]]]


@dataclass(frozen=True)
class PreparedAsk:
    """Validated runtime and model settings for one request."""

    runtime: AgentRuntime
    runtime_id: str
    settings: Settings
    route: RouteDecision
    content_source: str
    max_tool_rounds: int


class AskOrchestrator:
    """Coordinate runtime routing, durable conversation state, and SSE delivery."""

    def __init__(
        self,
        *,
        settings: Settings,
        runtime: AgentRuntime,
        reading_runtime: AgentRuntime | None,
        conversation_state: ConversationState,
        chat_fn_builder: ChatFnBuilder,
        confirmation_projector: ConfirmationProjector,
    ) -> None:
        self._settings = settings
        self._runtime = runtime
        self._runtime_id = runtime.runtime_id
        self._reading_runtime = reading_runtime
        self._conversation_state = conversation_state
        self._chat_fn_builder = chat_fn_builder
        self._confirmation_projector = confirmation_projector

    def prepare(self, payload: AskInput) -> PreparedAsk:
        """Select a runtime and validate model credentials before responding."""
        route = resolve_assistant_mode(payload.assistant_mode, payload.question)
        request_runtime, request_runtime_id = self._request_runtime(payload, route)
        document_id = self._resolve_document_id(payload)
        content_source = self._content_source(
            request_runtime,
            document_id=document_id,
            job_id=payload.job_id.strip(),
        )
        if route.resolved_mode == "reading" and content_source == "none":
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "AI_DOCUMENT_CONTENT_UNAVAILABLE",
                    "message": "当前文档没有可用于问答的结构化数据或 Markdown 产物",
                    "retryable": False,
                },
            )
        return PreparedAsk(
            runtime=request_runtime,
            runtime_id=request_runtime_id,
            settings=self._resolve_llm_settings(payload, request_runtime),
            route=route,
            content_source=content_source,
            max_tool_rounds=(
                self._settings.reading_max_tool_rounds
                if route.resolved_mode == "reading"
                else self._settings.max_tool_rounds
            ),
        )

    def ask(self, payload: AskInput, prepared: PreparedAsk) -> dict[str, Any]:
        """Execute one synchronous turn and durably persist its final result."""
        control = RequestControl(self._settings.ai_request_deadline_s)
        request_runtime = prepared.runtime
        chat_fn = self._request_chat_fn(payload, prepared, control)
        document_id = self._conversation_state.resolve_document_id(payload)
        conversation_id = self._conversation_state.ensure_conversation_id(
            payload, document_id
        )
        history, _compress_event, memory_debug, summary_id = self._prepare_memory(
            payload, conversation_id
        )
        request_message_id, request_persisted = (
            self._conversation_state.persist_agent_request_message(
                conversation_id,
                payload,
                request_runtime,
                chain_parent_id=summary_id,
            )
        )
        try:
            result = self._invoke_runtime(
                request_runtime,
                payload.question,
                conversation_id=conversation_id,
                document_id=document_id,
                job_id=payload.job_id.strip(),
                chat_fn=chat_fn,
                history=history,
                max_tool_rounds=prepared.max_tool_rounds,
                content_source=prepared.content_source,
                request_control=control,
                **self._operation_arguments(
                    payload, request_runtime, request_message_id
                ),
            )
            control.raise_if_stopped()
            self._ensure_answer(result)
        except AIRequestError as exc:
            event = public_error_event(exc)
            raise HTTPException(
                status_code=504 if event["code"] == "AI_RESPONSE_TIMEOUT" else 502,
                detail=event,
            ) from exc
        finally:
            control.finish()
        persisted = request_persisted and self._conversation_state.persist_turn(
            conversation_id,
            payload,
            result,
            request_runtime,
            chain_parent_id=summary_id,
            prepersisted_user_id=request_message_id,
        )
        return {
            "code": 0,
            "message": "ok",
            "data": self._result_payload(
                result,
                request_runtime_id=prepared.runtime_id,
                conversation_id=conversation_id,
                persisted=persisted,
                memory=memory_debug,
            ),
        }

    def sse_events(
        self,
        payload: AskInput,
        prepared: PreparedAsk,
        *,
        request_control: RequestControl | None = None,
    ) -> Iterator[str]:
        """Yield the existing SSE protocol while work runs in a host thread."""
        # Emit immediately, before conversation persistence or model setup.
        yield self._encode_event(
            {
                "type": "progress",
                "stage": "routing",
                "message": "正在判断任务类型",
            }
        )
        # The runtime loop is synchronous. A queue lets the HTTP response expose
        # tool events and final-answer deltas as soon as they are produced.
        events: queue.Queue[dict[str, Any] | None] = queue.Queue()
        control = request_control or RequestControl(self._settings.ai_request_deadline_s)
        control.add_cancel_callback(lambda: events.put(None))
        control.raise_if_stopped()
        request_runtime = prepared.runtime
        document_id = self._conversation_state.resolve_document_id(payload)
        conversation_id = self._conversation_state.ensure_conversation_id(
            payload, document_id
        )
        history, compress_event, memory_debug, summary_id = self._prepare_memory(
            payload, conversation_id
        )
        chat_fn = (
            None
            if request_runtime.capabilities.model_transport == "runtime_managed"
            else self._build_chat_fn(
                prepared.settings,
                on_delta=lambda text: events.put({"type": "answer_delta", "text": text}),
                request_control=control,
            )
        )

        def run() -> None:
            try:
                if compress_event:
                    events.put(compress_event)
                request_message_id, request_persisted = (
                    self._conversation_state.persist_agent_request_message(
                        conversation_id,
                        payload,
                        request_runtime,
                        chain_parent_id=summary_id,
                    )
                )
                events.put(
                    self._agent_session_event(
                        payload,
                        prepared,
                        conversation_id=conversation_id,
                        document_id=document_id,
                        request_message_id=request_message_id,
                    )
                )
                if prepared.route.resolved_mode == "reading":
                    events.put(
                        {
                            "type": "progress",
                            "stage": "retrieval",
                            "message": "正在检索文档",
                        }
                    )
                result = self._invoke_runtime(
                    request_runtime,
                    payload.question,
                    conversation_id=conversation_id,
                    document_id=document_id,
                    job_id=payload.job_id.strip(),
                    on_event=events.put,
                    chat_fn=chat_fn,
                    history=history,
                    max_tool_rounds=prepared.max_tool_rounds,
                    content_source=prepared.content_source,
                    request_control=control,
                    **self._operation_arguments(payload, request_runtime, request_message_id),
                )
                control.raise_if_stopped()
                self._ensure_answer(result)
                for confirmation in self._confirmation_projector(
                    result, self._settings.agent_confirmation_mode
                ):
                    events.put(
                        {
                            "type": "agent_confirmation_required",
                            **confirmation,
                        }
                    )
                control.raise_if_stopped()
                persisted = request_persisted and self._conversation_state.persist_turn(
                    conversation_id,
                    payload,
                    result,
                    request_runtime,
                    chain_parent_id=summary_id,
                    prepersisted_user_id=request_message_id,
                )
                control.raise_if_stopped()
                events.put(
                    {
                        "type": "done",
                        **self._result_payload(
                            result,
                            request_runtime_id=prepared.runtime_id,
                            conversation_id=conversation_id,
                            memory=memory_debug,
                            persisted=persisted,
                        ),
                    }
                )
            except Exception as exc:  # noqa: BLE001 - SSE serializes runtime errors
                events.put(public_error_event(exc))
            finally:
                control.finish()
                events.put(None)

        threading.Thread(target=run, daemon=True).start()
        terminal_seen = False
        try:
            while True:
                if control.remaining_seconds <= 0:
                    control.cancel("deadline_exceeded")
                    terminal_seen = True
                    yield self._encode_event(public_error_event(AIRequestTimeout()))
                    break
                timeout = min(
                    self._settings.ai_heartbeat_interval_s,
                    max(0.05, control.remaining_seconds),
                )
                try:
                    event = events.get(timeout=timeout)
                except queue.Empty:
                    if control.remaining_seconds <= 0:
                        control.cancel("deadline_exceeded")
                        event = public_error_event(AIRequestTimeout())
                        terminal_seen = True
                        yield self._encode_event(event)
                        break
                    yield self._encode_event(
                        {"type": "heartbeat", "elapsed_ms": control.elapsed_ms}
                    )
                    continue
                if control.remaining_seconds <= 0:
                    control.cancel("deadline_exceeded")
                    terminal_seen = True
                    yield self._encode_event(public_error_event(AIRequestTimeout()))
                    break
                if event is None:
                    if not terminal_seen:
                        yield self._encode_event(
                            {
                                "type": "error",
                                "code": "AI_RESPONSE_INCOMPLETE",
                                "message": "AI 响应意外中断，请重试",
                                "retryable": True,
                            }
                        )
                    break
                if event.get("type") in {"done", "error", "cancelled"}:
                    terminal_seen = True
                yield self._encode_event(event)
                if terminal_seen:
                    break
        finally:
            if not terminal_seen:
                control.cancel("client_disconnected")

    def _request_runtime(
        self, payload: AskInput, route: RouteDecision
    ) -> tuple[AgentRuntime, str]:
        mode = route.resolved_mode
        if mode == "reading":
            reading_runtime = self._reading_runtime or (
                self._runtime if self._runtime.capabilities.document_reading else None
            )
            if reading_runtime is None:
                raise HTTPException(
                    status_code=409,
                    detail="当前 AI 服务没有可用的文档阅读运行时，请重启后再试。",
                )
            return reading_runtime, reading_runtime.runtime_id
        if mode == "operations":
            if not self._runtime.capabilities.document_operations:
                raise HTTPException(
                    status_code=409,
                    detail="当前 AI Agent 未启用 PDF 操作模式，请先在 API 设置中选择 OpenAI Agent 或 FX Agent。",
                )
            return self._runtime, self._runtime_id
        raise HTTPException(status_code=400, detail="无效的 assistant_mode")

    def _resolve_llm_settings(
        self,
        payload: AskInput,
        request_runtime: AgentRuntime,
    ) -> Settings:
        if request_runtime.capabilities.model_transport == "runtime_managed":
            if not (
                self._settings.fx_gateway_api_key
                or self._settings.fx_gateway_credential_ref
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "fx runtime 缺少 RETAIN_AI_FX_GATEWAY_API_KEY；"
                        "不会把现有 Rust API key 或普通 DeepSeek key 交给 fx。"
                    ),
                )
            return self._settings
        api_key = payload.llm_api_key.strip()
        if not api_key and self._settings.llm_credential_ref:
            try:
                api_key = resolve_credential(
                    self._settings.data_root,
                    self._settings.llm_credential_ref,
                    "agent_llm_api_key",
                )
            except CredentialReferenceError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
        if not api_key:
            api_key = self._settings.llm_api_key.strip()
        if not api_key:
            raise HTTPException(
                status_code=400,
                detail="缺少 LLM API Key:请在前端凭据设置中填写模型 API Key。",
            )
        return replace(
            self._settings,
            llm_api_key=api_key,
            llm_base_url=(payload.llm_base_url or self._settings.llm_base_url).rstrip(
                "/"
            ),
            llm_model=payload.llm_model or self._settings.llm_model,
        )

    def _request_chat_fn(
        self,
        payload: AskInput,
        prepared: PreparedAsk,
        control: RequestControl,
    ) -> Any:
        if prepared.runtime.capabilities.model_transport == "runtime_managed":
            return None
        return self._build_chat_fn(
            prepared.settings,
            request_control=control,
        )

    def _build_chat_fn(self, settings: Settings, **kwargs: Any) -> Any:
        parameters = inspect.signature(self._chat_fn_builder).parameters
        supported = {key: value for key, value in kwargs.items() if key in parameters}
        return self._chat_fn_builder(settings, **supported)

    @staticmethod
    def _invoke_runtime(
        runtime: AgentRuntime,
        question: str,
        **kwargs: Any,
    ) -> Any:
        parameters = inspect.signature(runtime.ask).parameters
        if any(
            parameter.kind == inspect.Parameter.VAR_KEYWORD
            for parameter in parameters.values()
        ):
            return runtime.ask(question, **kwargs)
        supported = {key: value for key, value in kwargs.items() if key in parameters}
        return runtime.ask(question, **supported)

    @staticmethod
    def _ensure_answer(result: Any) -> None:
        if not str(getattr(result, "answer", "") or "").strip():
            raise EmptyAIResponse()

    @staticmethod
    def _encode_event(event: dict[str, Any]) -> str:
        return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    @staticmethod
    def _content_source(
        runtime: AgentRuntime,
        *,
        document_id: str,
        job_id: str,
    ) -> str:
        if not (document_id.strip() or job_id.strip()):
            return "unscoped"
        resolver = getattr(runtime, "content_source", None)
        if callable(resolver):
            source = str(resolver(document_id, job_id)).strip().lower()
            if source in {"structured", "markdown", "none", "unknown"}:
                return source
        return "unknown"

    def _resolve_document_id(self, payload: AskInput) -> str:
        if self._conversation_state is None:
            return payload.document_id.strip()
        return self._conversation_state.resolve_document_id(payload)

    def _prepare_memory(
        self,
        payload: AskInput,
        conversation_id: str,
    ) -> tuple[list[dict[str, str]], dict[str, Any] | None, dict[str, Any], str]:
        memory_stop = (
            payload.parent_id.strip()
            if payload.regenerate and payload.parent_id.strip()
            else ""
        )
        return self._conversation_state.prepare_memory(
            conversation_id,
            force_compress=bool(payload.force_compress),
            stop_at=memory_stop,
        )

    def _operation_arguments(
        self,
        payload: AskInput,
        request_runtime: AgentRuntime,
        request_message_id: str,
    ) -> dict[str, Any]:
        if not (
            request_runtime.capabilities.document_operations
            or request_runtime.capabilities.durable_calculations
        ):
            return {}
        return {
            "request_message_id": request_message_id,
            "confirmed": bool(payload.confirm_document_operation)
            or self._settings.agent_confirmation_mode == "green_light",
        }

    def _agent_session_event(
        self,
        payload: AskInput,
        prepared: PreparedAsk,
        *,
        conversation_id: str,
        document_id: str,
        request_message_id: str,
    ) -> dict[str, Any]:
        request_runtime = prepared.runtime
        return {
            "type": "agent_session",
            "assistant_mode": payload.assistant_mode,
            "resolved_mode": prepared.route.resolved_mode,
            "content_source": prepared.content_source,
            "conversation_id": conversation_id,
            "request_message_id": request_message_id or payload.user_message_id.strip(),
            "agent_runtime": prepared.runtime_id,
            "capabilities": {
                **request_runtime.capabilities.public_view(),
                "document_operations": bool(
                    request_runtime.capabilities.document_operations
                    and document_id
                    and request_message_id
                ),
                "document_operation_confirmation_mode": (
                    self._settings.agent_confirmation_mode
                ),
            },
        }

    def _result_payload(
        self,
        result: Any,
        *,
        request_runtime_id: str,
        conversation_id: str = "",
        memory: dict[str, Any] | None = None,
        persisted: bool = True,
    ) -> dict[str, Any]:
        confirmation_requests = self._confirmation_projector(
            result, self._settings.agent_confirmation_mode
        )
        payload: dict[str, Any] = {
            "answer": result.answer,
            "citations": [asdict(citation) for citation in result.citations],
            "tool_trace": result.tool_trace,
            "rounds": result.rounds,
            "persisted": persisted,
            "agent_runtime": request_runtime_id,
            "operation_refs": list(getattr(result, "operation_refs", []) or []),
            "calculation_refs": list(
                getattr(result, "calculation_refs", []) or []
            ),
            "confirmation_mode": self._settings.agent_confirmation_mode,
            "confirmation_requests": confirmation_requests,
        }
        if conversation_id:
            payload["conversation_id"] = conversation_id
        if memory:
            payload["memory"] = memory
        return payload
