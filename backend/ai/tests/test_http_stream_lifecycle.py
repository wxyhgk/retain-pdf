"""Real loopback HTTP disconnect with a synthetic runtime/transport; no provider."""
import socket
import asyncio
import threading
import time
from types import SimpleNamespace

import httpx
import pytest
import uvicorn
from starlette.applications import Starlette
from starlette.routing import Route

from retainpdf_ai.api_contracts import AskInput
from retainpdf_ai.ask_orchestration import AskOrchestrator, PreparedAsk
from retainpdf_ai.config import Settings
from retainpdf_ai.conversation_state import ConversationState
from retainpdf_ai.request_control import RequestControl
from retainpdf_ai.request_routing import RouteDecision
from retainpdf_ai.runtime import RuntimeCapabilities
from retainpdf_ai.stream_response import ControlledStreamingResponse


def test_asgi_24_send_failure_cancels_even_when_response_is_retained():
    from starlette.requests import ClientDisconnect
    control = RequestControl(10)
    closed = []
    control.add_cancel_callback(lambda: closed.append(True))
    response = ControlledStreamingResponse(iter(["data: synthetic\n\n"]), control=control)

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        raise OSError("synthetic disconnected socket")

    with pytest.raises(ClientDisconnect):
        asyncio.run(response({"type": "http", "asgi": {"spec_version": "2.4"}}, receive, send))
    assert control.cancelled
    assert closed == [True]


@pytest.mark.parametrize("emit_delta", [False, True])
def test_http_disconnect_cancels_worker_without_generator_collection(monkeypatch, emit_delta):
    entered, finished = threading.Event(), threading.Event()
    transport, peer = socket.socketpair()
    control = RequestControl(10)
    original_finish = control.finish

    def finish():
        original_finish()
        finished.set()

    control.finish = finish
    settings = Settings(ai_request_deadline_s=10, ai_heartbeat_interval_s=5)
    state = ConversationState(settings, None)
    persisted = []
    monkeypatch.setattr(state, "persist_agent_request_message", lambda *a, **k: ("request", True))
    monkeypatch.setattr(state, "persist_turn", lambda *a, **k: persisted.append(True))

    class Runtime:
        runtime_id = "synthetic"
        capabilities = RuntimeCapabilities(
            document_reading=True, document_operations=False,
            streaming=True, durable_sessions=False, model_transport="runtime_managed",
        )

        def ask(self, question, *, request_control, on_event, **kwargs):
            request_control.add_cancel_callback(lambda: transport.shutdown(socket.SHUT_RDWR))
            entered.set()
            if emit_delta:
                on_event({"type": "answer_delta", "text": "synthetic"})
            transport.recv(1)  # Awakened by explicit cancellation, not GC.
            return SimpleNamespace(answer="late answer", rounds=1)

    runtime = Runtime()
    orchestrator = AskOrchestrator(
        settings=settings, runtime=runtime, reading_runtime=runtime,
        conversation_state=state, chat_fn_builder=lambda _: None,
        confirmation_projector=lambda *a: [],
    )
    prepared = PreparedAsk(runtime, runtime.runtime_id, settings,
        RouteDecision("auto", "reading", "safe_reading_default"), "unscoped", 3)
    # Keep references deliberately: response lifecycle must not rely on GC.
    retained = []

    async def endpoint(request):
        generator = orchestrator.sse_events(
            AskInput(question="synthetic", stream=True), prepared, request_control=control,
        )
        response = ControlledStreamingResponse(generator, control=control, media_type="text/event-stream")
        retained.extend([generator, response])
        return response

    listener = socket.socket()
    listener.bind(("127.0.0.1", 0))
    listener.listen()
    server = uvicorn.Server(uvicorn.Config(
        Starlette(routes=[Route("/stream", endpoint)]),
        log_level="error", lifespan="off", timeout_graceful_shutdown=1,
    ))
    thread = threading.Thread(target=lambda: server.run(sockets=[listener]), daemon=True)
    thread.start()
    try:
        deadline = time.monotonic() + 3
        while not server.started and time.monotonic() < deadline:
            time.sleep(0.01)
        assert server.started
        with httpx.Client(timeout=3, trust_env=False) as client:
            with client.stream("GET", f"http://127.0.0.1:{listener.getsockname()[1]}/stream") as response:
                for line in response.iter_lines():
                    if ("answer_delta" if emit_delta else "agent_session") in line:
                        break
                assert entered.wait(1)
        assert finished.wait(2), "worker did not exit after HTTP disconnect"
        assert control.cancelled
        peer.settimeout(1)
        assert peer.recv(1) == b""
        assert persisted == []
    finally:
        control.cancel()
        server.should_exit = True
        thread.join(3)
        listener.close()
        transport.close()
        peer.close()
    assert not thread.is_alive()
