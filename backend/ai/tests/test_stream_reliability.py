"""Offline regression for completion, deadlines, and request-owned cleanup."""

import json
import sys
import threading
import time
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from retainpdf_ai.agent_llm import assemble_streaming_message, friendly_llm_error, build_deepseek_chat_fn
from retainpdf_ai.api_contracts import AskInput
from retainpdf_ai.ask_orchestration import AskOrchestrator, PreparedAsk
from retainpdf_ai.config import Settings
from retainpdf_ai.conversation_state import ConversationState
from retainpdf_ai.request_control import AIStreamIncomplete, AIRequestTimeout, RequestControl, public_error_event
from retainpdf_ai.request_routing import RouteDecision
from retainpdf_ai.runtime import RuntimeCapabilities


def event(delta=None, finish=None):
    return 'data: ' + json.dumps({'choices': [{'delta': delta or {}, 'finish_reason': finish}]})


@pytest.mark.parametrize('tail', [
    [], ['data: [DONE]'], [event(finish='stop')],
    [event(finish='length'), 'data: [DONE]'],
    [event(finish='content_filter'), 'data: [DONE]'],
    ['data: {"error":{"message":"private"}}', 'data: [DONE]'],
    ['data: {broken', event(finish='stop'), 'data: [DONE]'],
    ['data: []', 'data: [DONE]'],
    ['data: {"choices":"bad"}', 'data: [DONE]'],
    [b'data: \xff'],
    [event({'tool_calls': ['bad']}), 'data: [DONE]'],
    [event(finish='tool_calls'), 'data: [DONE]'],
])
def test_partial_or_invalid_stream_is_not_a_completed_message(tail):
    with pytest.raises(AIStreamIncomplete):
        assemble_streaming_message([event({'content': 'partial'}), *tail])


def test_usage_and_reasoning_events_do_not_break_valid_completion():
    deltas = []
    result = assemble_streaming_message([
        ': heartbeat', event({'reasoning_content': 'private reasoning'}),
        event({'content': '回答'}), event(finish='stop'),
        'data: {"choices":[],"usage":{"completion_tokens":2}}', 'data: [DONE]',
    ], deltas.append)
    assert result['content'] == '回答'
    assert deltas == ['回答']


def test_continuous_reasoning_events_check_deadline():
    control = RequestControl(10)
    closed = []
    control.add_cancel_callback(lambda: closed.append(True))
    def lines():
        yield event({'reasoning_content': 'thinking'})
        control._deadline_at = time.monotonic() - 1
        yield 'data: {"choices":[],"usage":{}}'
        pytest.fail('read beyond deadline')
    with pytest.raises(AIRequestTimeout):
        assemble_streaming_message(lines(), request_control=control)
    control.finish()
    control.cancel()
    assert closed == [True]


def test_errors_never_echo_synthetic_provider_or_internal_details():
    marker = 'SYNTHETIC_SECRET_PROMPT'
    for error in [friendly_llm_error(429, marker), RuntimeError(marker)]:
        assert marker not in json.dumps(public_error_event(error))
    assert '限流' in public_error_event(friendly_llm_error(429, marker))['message']


def test_cancel_only_closes_its_request_owned_transport(monkeypatch):
    clients = []
    class Client:
        def __init__(self, **kwargs):
            self.closed = 0
            clients.append(self)
        def close(self):
            self.closed += 1
    monkeypatch.setattr('retainpdf_ai.agent_llm.httpx.Client', Client)
    first, second = RequestControl(5), RequestControl(5)
    settings = Settings(llm_api_key='synthetic')
    build_deepseek_chat_fn(settings, request_control=first)
    build_deepseek_chat_fn(settings, request_control=second)
    first.cancel()
    first.finish()
    assert [client.closed for client in clients] == [1, 0]
    second.finish()
    assert [client.closed for client in clients] == [1, 1]


def make_stream(runtime, monkeypatch, deadline=5):
    settings = Settings(ai_request_deadline_s=deadline, ai_heartbeat_interval_s=0.01)
    state = ConversationState(settings, None)
    persisted = []
    monkeypatch.setattr(state, 'persist_agent_request_message', lambda *a, **k: ('request', True))
    monkeypatch.setattr(state, 'persist_turn', lambda *a, **k: persisted.append(True) or True)
    orchestrator = AskOrchestrator(
        settings=settings, runtime=runtime, reading_runtime=runtime,
        conversation_state=state, chat_fn_builder=lambda _: None,
        confirmation_projector=lambda *a: [],
    )
    prepared = PreparedAsk(runtime, runtime.runtime_id, settings,
        RouteDecision('auto', 'reading', 'safe_reading_default'), 'unscoped', 3)
    return orchestrator.sse_events(AskInput(question='test', stream=True), prepared), persisted


class Runtime:
    runtime_id = 'test-stream-runtime'
    capabilities = RuntimeCapabilities(document_reading=True, document_operations=False,
        streaming=True, durable_sessions=False, model_transport='runtime_managed')


def test_queued_events_cannot_hide_expired_deadline(monkeypatch):
    ready, stopped = threading.Event(), threading.Event()
    class BacklogRuntime(Runtime):
        def ask(self, question, *, request_control, on_event, **kwargs):
            self.control = request_control
            for _ in range(100):
                on_event({'type': 'answer_delta', 'text': 'x'})
            ready.set()
            try:
                while True:
                    request_control.raise_if_stopped()
                    time.sleep(0.001)
            finally:
                stopped.set()
    runtime = BacklogRuntime()
    stream, persisted = make_stream(runtime, monkeypatch)
    next(stream)  # routing; next call starts worker
    next(stream)
    assert ready.wait(1)
    runtime.control._deadline_at = time.monotonic() - 1
    remaining = [json.loads(line.removeprefix('data: ')) for line in stream]
    assert len(remaining) == 1
    assert remaining[0]['code'] == 'AI_RESPONSE_TIMEOUT'
    assert stopped.wait(1)
    assert persisted == []


def test_disconnect_cancels_and_late_runtime_result_is_not_persisted(monkeypatch):
    entered, release, stopped = threading.Event(), threading.Event(), threading.Event()
    finished = threading.Event()
    cleanup = []
    class LateRuntime(Runtime):
        def ask(self, question, *, request_control, **kwargs):
            self.control = request_control
            original_finish = request_control.finish
            def finish():
                original_finish()
                finished.set()
            request_control.finish = finish
            request_control.add_cancel_callback(lambda: cleanup.append(True))
            entered.set()
            assert release.wait(2)
            stopped.set()
            return SimpleNamespace(answer='late result', rounds=1)
    runtime = LateRuntime()
    stream, persisted = make_stream(runtime, monkeypatch)
    next(stream)
    next(stream)
    assert entered.wait(1)
    stream.close()
    assert runtime.control.cancelled
    release.set()
    assert stopped.wait(1)
    assert finished.wait(1)
    assert cleanup == [True]
    assert persisted == []
