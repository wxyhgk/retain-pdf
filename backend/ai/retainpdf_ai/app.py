"""FastAPI application assembly for the RetainPDF AI service."""

from __future__ import annotations

import os
import signal
import threading
from collections.abc import Callable
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request
from .stream_response import ControlledStreamingResponse
from .request_control import RequestControl

from . import __version__
from .agent import RetrievalAgent, build_deepseek_chat_fn
from .agent_confirmations import confirmation_requests
from .api_contracts import AskInput, RuntimeConfigUpdate
from .ask_orchestration import AskOrchestrator
from .config import Settings, load_settings
from .conversation_state import ConversationState
from .runtime import AgentRuntime, PythonAgentRuntime, build_agent_runtime
from .runtime_config_api import register_runtime_config_routes
from .rust_client import RustApiClient
from .tools import build_default_registry

__all__ = ["AskInput", "RuntimeConfigUpdate", "build_app"]


def _schedule_process_restart() -> None:
    timer = threading.Timer(0.2, lambda: os.kill(os.getpid(), signal.SIGTERM))
    timer.daemon = True
    timer.start()


# Compatibility aliases for existing consumers importing contracts/helpers here.
_confirmation_requests = confirmation_requests


def build_app(
    settings: Settings | None = None,
    agent: RetrievalAgent | None = None,
    rust: RustApiClient | None = None,
    runtime: AgentRuntime | None = None,
    restart_callback: Callable[[], None] | None = None,
) -> FastAPI:
    settings = settings or load_settings()
    if runtime is None and agent is None:
        # A request may supply LLM credentials, so startup does not require them.
        if not settings.rust_api_key:
            raise RuntimeError("RETAIN_AI_RUST_API_KEY is required")
        rust = rust or RustApiClient(settings)
        agent = RetrievalAgent(
            build_default_registry(settings, rust),
            build_deepseek_chat_fn(settings),
            max_tool_rounds=settings.max_tool_rounds,
        )
    if runtime is None:
        if agent is None:
            raise RuntimeError("agent runtime initialization failed")
        selected_runtime = settings.agent_runtime.strip().lower()
        if selected_runtime in {"fx", "openai"}:
            rust = rust or RustApiClient(settings)
            runtime = build_agent_runtime(settings, rust, agent)
        elif selected_runtime == "python" and (
            rust is None or getattr(agent, "registry", None) is None
        ):
            runtime = PythonAgentRuntime(agent)
        elif selected_runtime == "python":
            runtime = build_agent_runtime(settings, rust, agent)
        else:
            raise RuntimeError(
                f"unsupported RETAIN_AI_RUNTIME={settings.agent_runtime!r}; "
                "expected python, openai, or fx"
            )

    runtime_id = runtime.runtime_id
    reading_runtime = (
        PythonAgentRuntime(agent)
        if agent is not None
        else (runtime if runtime.capabilities.document_reading else None)
    )
    restart_runtime = restart_callback or _schedule_process_restart

    app = FastAPI(title="retainpdf-ai", version=__version__)

    def require_api_key(request: Request) -> None:
        if not settings.api_keys:
            raise HTTPException(
                status_code=500, detail="RETAIN_AI_API_KEYS is not configured"
            )
        provided = request.headers.get("X-API-Key", "")
        if provided not in settings.api_keys:
            raise HTTPException(status_code=401, detail="invalid api key")

    @app.get("/healthz")
    def healthz() -> dict[str, Any]:
        return {
            "ok": True,
            "version": __version__,
            "agent_runtime": runtime_id,
            "capabilities": runtime.capabilities.public_view(),
        }

    register_runtime_config_routes(
        app,
        active_settings=settings,
        runtime=runtime,
        runtime_id=runtime_id,
        rust=rust,
        agent=agent,
        restart_runtime=restart_runtime,
        require_api_key=require_api_key,
    )

    ask_orchestrator = AskOrchestrator(
        settings=settings,
        runtime=runtime,
        reading_runtime=reading_runtime,
        conversation_state=ConversationState(settings, rust),
        # Keep the app-level symbols injectable for existing consumers/tests.
        chat_fn_builder=build_deepseek_chat_fn,
        confirmation_projector=_confirmation_requests,
    )

    @app.post("/v1/ask", dependencies=[Depends(require_api_key)])
    def ask(payload: AskInput) -> Any:
        # Preparation intentionally runs outside the SSE generator so routing and
        # credential HTTPExceptions remain ordinary 4xx responses.
        prepared = ask_orchestrator.prepare(payload)
        if payload.stream:
            control = RequestControl(settings.ai_request_deadline_s)
            return ControlledStreamingResponse(
                ask_orchestrator.sse_events(payload, prepared, request_control=control),
                control=control,
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )
        return ask_orchestrator.ask(payload, prepared)

    return app
