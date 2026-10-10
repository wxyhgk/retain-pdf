"""助手用量台账：问答（流式 / 非流式）和终端转发每次模型返回各记一行。"""
import io
import json
from contextlib import contextmanager
from pathlib import Path

import retainpdf_ai.fx_openai_bridge as bridge_module
from retainpdf_ai.agent import build_deepseek_chat_fn
from retainpdf_ai.config import Settings
from retainpdf_ai.fx_openai_bridge import FxOpenAIChatBridge
from retainpdf_ai.usage_ledger import ASSISTANT_LEDGER_RELATIVE_PATH


def _rows(root: Path):
    path = root / ASSISTANT_LEDGER_RELATIVE_PATH
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


def _settings(tmp_path: Path) -> Settings:
    return Settings(llm_api_key="synthetic-key", llm_model="deepseek-flash",
                    llm_base_url="https://api.deepseek.com/v1", usage_ledger_root=tmp_path)


class _JsonResponse:
    status_code = 200

    def __init__(self, payload):
        self._payload = payload

    def json(self):
        return self._payload


def test_non_streaming_answer_is_recorded_with_its_book(tmp_path):
    class Client:
        def post(self, *_args, **_kwargs):
            return _JsonResponse({
                "choices": [{"message": {"role": "assistant", "content": "答"}}],
                "usage": {"prompt_tokens": 900, "completion_tokens": 40, "prompt_cache_hit_tokens": 512},
            })

    chat = build_deepseek_chat_fn(_settings(tmp_path), client=Client(), usage_document_id="doc-1")
    assert chat([{"role": "user", "content": "q"}], [])["content"] == "答"

    (row,) = _rows(tmp_path)
    assert (row["source"], row["stage"], row["document_id"]) == ("assistant", "assistant_ask", "doc-1")
    assert (row["input"], row["output"], row["cache_hit"]) == (900, 40, 512)
    assert (row["model"], row["host"]) == ("deepseek-flash", "api.deepseek.com")


def _sse(obj) -> str:
    return "data: " + json.dumps(obj, ensure_ascii=False)


STREAM = [
    _sse({"choices": [{"delta": {"content": "答"}}]}),
    _sse({"choices": [{"delta": {}, "finish_reason": "stop"}]}),
    _sse({"choices": [], "usage": {"prompt_tokens": 300, "completion_tokens": 12,
                                   "prompt_tokens_details": {"cached_tokens": 256}}}),
    "data: [DONE]",
]


class _StreamResponse:
    def __init__(self, status_code, lines=()):
        self.status_code = status_code
        self._lines = list(lines)

    def close(self):
        pass

    def iter_lines(self):
        return iter(self._lines)


def test_streaming_answer_asks_for_usage_and_records_it(tmp_path):
    bodies = []

    class Client:
        @contextmanager
        def stream(self, *_args, json=None, **_kwargs):
            bodies.append(json)
            yield _StreamResponse(200, STREAM)

    chat = build_deepseek_chat_fn(_settings(tmp_path), client=Client(), on_delta=lambda _: None)
    message = chat([{"role": "user", "content": "q"}], [])

    assert message == {"role": "assistant", "content": "答"}, "用量不混进回传给上游的消息"
    assert bodies[0]["stream_options"] == {"include_usage": True}
    (row,) = _rows(tmp_path)
    assert (row["input"], row["output"], row["cache_hit"]) == (300, 12, 256)


def test_a_relay_that_rejects_stream_options_still_answers(tmp_path):
    bodies = []

    class Client:
        @contextmanager
        def stream(self, *_args, json=None, **_kwargs):
            bodies.append(dict(json))
            if "stream_options" in json:
                yield _StreamResponse(400)
            else:
                yield _StreamResponse(200, [line for line in STREAM if '"usage"' not in line])

    chat = build_deepseek_chat_fn(_settings(tmp_path), client=Client(), on_delta=lambda _: None)
    assert chat([{"role": "user", "content": "q"}], [])["content"] == "答"
    assert chat([{"role": "user", "content": "q"}], [])["content"] == "答"

    assert ["stream_options" in body for body in bodies] == [True, False, False], "拒过一次就不再带"
    rows = _rows(tmp_path)
    assert len(rows) == 2 and all(row["usage_reported"] is False for row in rows)


def test_settings_built_directly_do_not_write_a_ledger(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    class Client:
        def post(self, *_args, **_kwargs):
            return _JsonResponse({"choices": [{"message": {"content": "答"}}],
                                  "usage": {"prompt_tokens": 1, "completion_tokens": 1}})

    settings = Settings(llm_api_key="synthetic-key")
    assert settings.usage_ledger_root is None
    build_deepseek_chat_fn(settings, client=Client())([{"role": "user", "content": "q"}], [])
    assert not list(tmp_path.rglob("assistant.v1.jsonl"))


def test_terminal_bridge_records_upstream_usage(tmp_path, monkeypatch):
    payload = {"choices": [{"message": {"content": "ok"}, "finish_reason": "stop"}],
               "usage": {"prompt_tokens": 70, "completion_tokens": 7,
                         "completion_tokens_details": {"reasoning_tokens": 3}}}

    class Opener:
        def open(self, _request, timeout=None):
            return io.BytesIO(json.dumps(payload).encode())

    monkeypatch.setattr(bridge_module, "build_opener", lambda *_args: Opener())
    bridge = FxOpenAIChatBridge(base_url="https://api.deepseek.com/v1", model="deepseek-flash",
                                api_key="synthetic-key", usage_data_root=tmp_path)
    bridge._request_upstream({"model": "deepseek-flash", "messages": []})

    (row,) = _rows(tmp_path)
    assert (row["stage"], row["input"], row["output"], row["reasoning"]) == ("assistant_terminal", 70, 7, 3)
