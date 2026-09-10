"""Host-side orchestration for the version-pinned fx ACP runtime."""

from __future__ import annotations

import threading
from collections.abc import Callable
from contextlib import nullcontext
from dataclasses import dataclass
from typing import Any

from ..agent import referenced_citations, sanitize_answer_text
from ..agent_command_broker import AgentCommandBroker, BrokerScope
from ..config import Settings, normalize_fx_gateway_base_url
from ..operation_context import load_operation_context
from ..prompts import build_operation_context_block
from ..request_control import RequestControl
from ..rust_client import RustApiClient
from ..tools import ToolRegistry
from ..unified_tools import CALCULATION_TOOL_NAMES, READING_TOOL_NAMES
from .contracts import AskResult, ChatFn, RuntimeCapabilities
from .fx_acp import FxAcpClient
from .fx_coordination import coordinator_for
from .fx_gateway import probe_fx_gateway_endpoint
from .fx_process import start_fx_client
from .fx_turn import safe_tool_event, turn_prompt

FX_RUNTIME_ID = "vercel-fx-acp-v1"
_MAX_ANSWER_CHARS = 1024 * 1024
_MAX_TOOL_EVENTS = 2048


@dataclass(frozen=True)
class FxCapability:
    available: bool
    runtime_id: str
    expected_version: str
    actual_version: str = ""
    detail: str = ""


class FxAcpRuntime:
    """Version-pinned fx ACP adapter behind an explicit feature flag.

    One ACP process is used for one turn. fx persists its own session under a
    private HOME and Rust stores only the opaque session cursor with revision
    CAS. Losing the cursor rebuilds a new fx session from bounded canonical
    conversation history.

    A host-owned broker admits only the fixed retainpdf-agent grammar. Neither
    the Rust API key nor the short-lived capability is inherited by fx.
    """

    runtime_id = FX_RUNTIME_ID
    capabilities = RuntimeCapabilities(
        document_reading=False,
        document_operations=True,
        streaming=True,
        durable_sessions=True,
        model_transport="runtime_managed",
        confirmation_modes=frozenset({"explicit", "green_light"}),
    )

    def __init__(
        self,
        settings: Settings,
        rust: RustApiClient,
        reading_registry: ToolRegistry | None = None,
    ) -> None:
        self._settings = settings
        self._rust = rust
        self._reading_registry = reading_registry
        registered_names = (
            {
                str((spec.get("function") or {}).get("name") or "")
                for spec in reading_registry.specs()
            }
            if reading_registry is not None
            else set()
        )
        reading_available = bool(READING_TOOL_NAMES & registered_names)
        calculation_available = CALCULATION_TOOL_NAMES.issubset(registered_names)
        self.capabilities = RuntimeCapabilities(
            document_reading=reading_available,
            document_operations=True,
            streaming=True,
            durable_sessions=True,
            model_transport="runtime_managed",
            confirmation_modes=frozenset({"explicit", "green_light"}),
            calculation=calculation_available,
            durable_calculations=calculation_available,
            python_analysis=False,
        )
        self._coordinator = coordinator_for(
            settings.fx_state_root,
            settings.fx_max_concurrent_turns,
        )

    def probe(self) -> FxCapability:
        if not (
            self._settings.fx_gateway_api_key
            or self._settings.fx_gateway_credential_ref
            or self._settings.fx_openai_base_url.strip()
        ):
            return FxCapability(
                available=False,
                runtime_id=self.runtime_id,
                expected_version=self._settings.fx_expected_version,
                detail="RETAIN_AI_FX_GATEWAY_API_KEY or RETAIN_AI_FX_OPENAI_BASE_URL is missing",
            )
        try:
            normalize_fx_gateway_base_url(self._settings.fx_gateway_base_url)
            probe_fx_gateway_endpoint(
                self._settings.fx_gateway_base_url,
                timeout=min(self._settings.fx_startup_timeout_s, 2.0),
            )
            with (
                self._coordinator.turn("__probe__"),
                self._start_client(session_key="__probe__") as client,
            ):
                actual = client.initialize()
            if actual != self._settings.fx_expected_version:
                return FxCapability(
                    available=False,
                    runtime_id=self.runtime_id,
                    expected_version=self._settings.fx_expected_version,
                    actual_version=actual,
                    detail="fx ACP version does not match the pinned backend contract",
                )
            return FxCapability(
                available=True,
                runtime_id=self.runtime_id,
                expected_version=self._settings.fx_expected_version,
                actual_version=actual,
            )
        except Exception as exc:  # noqa: BLE001 - capability probe is non-throwing
            return FxCapability(
                available=False,
                runtime_id=self.runtime_id,
                expected_version=self._settings.fx_expected_version,
                detail=str(exc),
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
        del max_tool_rounds, content_source
        if chat_fn is not None:
            raise RuntimeError("fx runtime does not accept the legacy chat_fn transport")
        conversation_id = conversation_id.strip()
        document_id = document_id.strip()
        request_message_id = request_message_id.strip()
        if not conversation_id:
            raise RuntimeError("fx runtime requires a durable RetainPDF conversation")
        if not (
            self._settings.fx_gateway_api_key
            or self._settings.fx_gateway_credential_ref
            or self._settings.fx_openai_base_url.strip()
        ):
            raise RuntimeError(
                "fx runtime is enabled but RETAIN_AI_FX_GATEWAY_API_KEY or RETAIN_AI_FX_OPENAI_BASE_URL is missing"
            )
        if request_control is not None:
            request_control.raise_if_stopped()
        emit = on_event or (lambda _event: None)
        operation_refs: dict[str, dict[str, Any]] = {}
        calculation_refs: dict[str, dict[str, Any]] = {}
        operation_refs_lock = threading.Lock()

        def on_operation_event(event: dict[str, Any]) -> None:
            operation_id = str(event.get("operation_id") or "").strip()
            if not operation_id:
                return
            ref = {
                "operation_id": operation_id,
                "status": str(event.get("status") or ""),
                "current_attempt": int(event.get("current_attempt") or 0),
                "latest_event_seq": int(event.get("latest_event_seq") or 0),
            }
            with operation_refs_lock:
                operation_refs[operation_id] = ref
            emit(event)

        def on_tool_event(event: dict[str, Any]) -> None:
            calculation_id = str(event.get("calculation_id") or "").strip()
            if calculation_id:
                calculation_refs[calculation_id] = {
                    "calculation_id": calculation_id,
                    "status": str(event.get("status") or ""),
                }
            emit(event)

        broker_context = (
            AgentCommandBroker(
                state_root=self._settings.fx_state_root,
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
                    job_id=job_id.strip(),
                    confirmed=confirmed,
                    green_light=(
                        self._settings.agent_confirmation_mode == "green_light"
                    ),
                ),
                on_operation_event=on_operation_event,
                tool_registry=self._reading_registry,
                on_tool_event=on_tool_event,
            )
            if request_message_id
            else nullcontext(None)
        )
        with (
            self._coordinator.turn(conversation_id),
            broker_context as broker,
            self._start_client(broker, session_key=conversation_id) as client,
        ):
            actual_version = client.initialize()
            if actual_version != self._settings.fx_expected_version:
                raise RuntimeError(
                    "fx ACP version mismatch: expected "
                    f"{self._settings.fx_expected_version}, got {actual_version or 'unknown'}"
                )
            session_id, rebuilt = self._open_or_create_session(client, conversation_id)
            client.set_mode("ask")
            operations = load_operation_context(
                self._rust,
                conversation_id=conversation_id,
                document_id=document_id,
            )
            prompt = turn_prompt(
                question,
                history or [],
                rebuilt=rebuilt,
                broker=broker,
                operation_context=build_operation_context_block(operations),
            )
            answer_parts: list[str] = []
            answer_chars = 0
            tool_trace: list[dict[str, Any]] = []

            def on_update(update: dict[str, Any]) -> None:
                nonlocal answer_chars
                kind = str(update.get("sessionUpdate") or "")
                if kind == "agent_message_chunk":
                    content = update.get("content") or {}
                    text = str(content.get("text") or "")
                    if text:
                        answer_chars += len(text)
                        if answer_chars > _MAX_ANSWER_CHARS:
                            raise RuntimeError("fx answer exceeded the backend output limit")
                        answer_parts.append(text)
                        emit({"type": "answer_delta", "text": text})
                    return
                if kind in {"tool_call", "tool_call_update"}:
                    if len(tool_trace) >= _MAX_TOOL_EVENTS:
                        raise RuntimeError("fx tool trace exceeded the backend event limit")
                    safe = safe_tool_event(update)
                    tool_trace.append(safe)

            stop_reason = client.prompt(
                session_id,
                prompt,
                on_update,
                request_control=request_control,
            )
            answer = "".join(answer_parts).strip()
            if not answer and stop_reason == "cancelled":
                raise RuntimeError("fx turn was cancelled")
            if not answer:
                raise RuntimeError(f"fx turn ended without an answer ({stop_reason})")
            citations = broker.citations if broker is not None else {}
            answer = sanitize_answer_text(answer, citations)
            return AskResult(
                answer=answer,
                citations=referenced_citations(answer, citations),
                tool_trace=tool_trace,
                rounds=1,
                operation_refs=list(operation_refs.values()),
                calculation_refs=list(calculation_refs.values()),
            )

    def content_source(self, document_id: str = "", job_id: str = "") -> str:
        resolver = getattr(self._reading_registry, "content_source", None)
        if callable(resolver):
            return str(resolver(document_id, job_id))
        return "unscoped" if not (document_id.strip() or job_id.strip()) else "unknown"

    def _open_or_create_session(
        self,
        client: FxAcpClient,
        conversation_id: str,
    ) -> tuple[str, bool]:
        record = self._rust.get_agent_runtime_session(conversation_id)
        revision = int(record.get("revision") or 0)
        cursor = str(record.get("session_cursor") or "").strip()
        runtime_id = str(record.get("runtime_id") or "").strip()
        if cursor and runtime_id == self.runtime_id:
            try:
                client.load_session(cursor)
                return cursor, False
            except RuntimeError:
                # The Rust cursor survived but fx local session storage did
                # not. Rebuild from canonical conversation history.
                pass
        created = client.create_session()
        try:
            stored = self._rust.put_agent_runtime_session(
                conversation_id,
                runtime_id=self.runtime_id,
                session_cursor=created,
                expected_revision=revision,
            )
            return str(stored.get("session_cursor") or created), True
        except Exception:
            # Another adapter may have won CAS. Never overwrite it; reload the
            # current authoritative cursor when it belongs to this runtime.
            latest = self._rust.get_agent_runtime_session(conversation_id)
            latest_cursor = str(latest.get("session_cursor") or "").strip()
            if latest_cursor and str(latest.get("runtime_id") or "") == self.runtime_id:
                client.load_session(latest_cursor)
                return latest_cursor, False
            raise

    def _start_client(
        self,
        broker: AgentCommandBroker | None = None,
        *,
        session_key: str = "",
    ) -> FxAcpClient:
        return start_fx_client(self._settings, broker, session_key=session_key)
