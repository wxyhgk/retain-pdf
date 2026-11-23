"""翻译请求被服务商限流（429 + Retry-After）退避等待时，阶段进度里报一条开始、一条结束。"""
from __future__ import annotations

import json
from pathlib import Path
from unittest import mock

import requests

from retainpdf_base.events import PipelineEventWriter
from retainpdf_base.events import emit_stage_progress
from retainpdf_base.events import pipeline_event_writer_scope
from retainpdf_translation.llm.providers.deepseek import client
from retainpdf_translation.llm.shared.rust_executor import RustModelExecutorClient


def _response(status: int, body: bytes, headers: dict | None = None) -> requests.Response:
    response = requests.Response()
    response.status_code = status
    response._content = body
    response.headers.update(headers or {})
    return response


def _patch_client(monkeypatch, responses: list[requests.Response], sleeps: list[float]) -> None:
    class Session:
        def post(self, url, **kwargs):
            return responses.pop(0)

    monkeypatch.setattr(client, "get_session", lambda: Session())
    monkeypatch.setattr(client, "_prewarm_dns", lambda *args, **kwargs: None)
    monkeypatch.setattr(client, "should_use_stream_responses", lambda: False)
    monkeypatch.setattr(client.time, "sleep", sleeps.append)
    monkeypatch.delenv("RETAIN_MODEL_EXECUTOR_URL", raising=False)
    monkeypatch.delenv("RETAIN_MODEL_EXECUTOR_ENABLED", raising=False)


def _rows(writer: PipelineEventWriter) -> list[dict]:
    return [json.loads(line) for line in writer.path.read_text(encoding="utf-8").splitlines() if line.strip()]


def _start_progress() -> None:
    emit_stage_progress(
        stage="translating", substage="translation_batches", message="已翻译 2/8 块",
        progress_current=2, progress_total=8, payload={"progress_unit": "block"},
    )


def test_429_with_retry_after_reports_one_wait_start_and_end(monkeypatch, tmp_path: Path) -> None:
    sleeps: list[float] = []
    _patch_client(monkeypatch, [
        _response(429, b'{"error":{"code":"rate_limit_exceeded","message":"slow down"}}', {"Retry-After": "7"}),
        _response(200, b'{"choices":[{"message":{"content":"ok"}}]}'),
    ], sleeps)
    writer = PipelineEventWriter(job_id="job-1", job_root=tmp_path, logs_dir=tmp_path / "logs")
    with pipeline_event_writer_scope(writer):
        _start_progress()
        assert client.request_chat_content(
            [{"role": "user", "content": "hi"}], api_key="k", model="deepseek-flash",
            base_url="https://api.deepseek.com/v1", max_attempts=2,
        ) == "ok"
    assert sleeps == [7.0]
    rows = _rows(writer)
    assert [row["payload"].get("upstream_wait_transition") for row in rows] == [None, "started", "ended"]
    wait = rows[1]["payload"]["upstream_wait"]
    assert {k: wait[k] for k in ("provider", "http_status", "reason", "code", "retry_after_s", "wait_source", "attempt", "max_attempts")} == {
        "provider": "deepseek", "http_status": 429, "reason": "rate_limited", "code": "rate_limit_exceeded",
        "retry_after_s": 7.0, "wait_source": "retry_after", "attempt": 1, "max_attempts": 2,
    }
    assert rows[2]["payload"]["upstream_wait"] is None
    assert all(row["progress_current"] == 2 and row["progress_total"] == 8 for row in rows)


def test_requests_without_rate_limit_emit_no_wait_events(monkeypatch, tmp_path: Path) -> None:
    sleeps: list[float] = []
    _patch_client(monkeypatch, [
        _response(502, b"bad gateway"),
        _response(200, b'{"choices":[{"message":{"content":"ok"}}]}'),
        _response(200, b'{"choices":[{"message":{"content":"ok"}}]}'),
    ], sleeps)
    writer = PipelineEventWriter(job_id="job-1", job_root=tmp_path, logs_dir=tmp_path / "logs")
    with pipeline_event_writer_scope(writer):
        _start_progress()
        for _ in range(2):
            client.request_chat_content(
                [{"role": "user", "content": "hi"}], api_key="k", model="deepseek-flash",
                base_url="https://api.deepseek.com/v1", max_attempts=2,
            )
    assert len(sleeps) == 1  # 502 照旧退避重试，只是不报等待
    rows = _rows(writer)
    assert len(rows) == 1 and "upstream_wait" not in rows[0]["payload"]


def test_rust_executor_operation_wait_is_reported_once(tmp_path: Path) -> None:
    def op(status: str, wait: dict | None = None):
        result = mock.Mock(status_code=200)
        body = {"operation_id": "op", "unit_id": "unit", "status": status, "result": {"content": "译文"}}
        if wait is not None:
            body["upstream_wait"] = wait
        result.json.return_value = body
        return result

    wait = {"provider": "qwen", "http_status": 429, "retry_after_s": 3, "attempt": 1, "max_attempts": 2}
    executor = RustModelExecutorClient("http://127.0.0.1:41000", "job", "a" * 64)
    session = mock.Mock()
    session.request.side_effect = [op("queued"), op("running", wait), op("running", wait), op("running"), op("succeeded")]
    writer = PipelineEventWriter(job_id="job-1", job_root=tmp_path, logs_dir=tmp_path / "logs")
    with pipeline_event_writer_scope(writer), mock.patch.object(executor, "_session", return_value=session), mock.patch("time.sleep"):
        _start_progress()
        assert executor.request(operation_id="op", unit_id="unit", messages=[{"role": "user", "content": "x"}]).content == "译文"
    rows = _rows(writer)
    assert [row["payload"].get("upstream_wait_transition") for row in rows] == [None, "started", "ended"]
    assert rows[1]["payload"]["upstream_wait"]["provider"] == "qwen"
    assert rows[1]["payload"]["upstream_wait"]["retry_after_s"] == 3.0


def test_rust_executor_wait_is_closed_when_the_operation_fails(tmp_path: Path) -> None:
    result = mock.Mock(status_code=200)
    result.json.return_value = {"operation_id": "op", "unit_id": "unit", "status": "running",
                                "upstream_wait": {"provider": "deepseek", "http_status": 429, "retry_after_s": 1}}
    failed = mock.Mock(status_code=200)
    failed.json.return_value = {"operation_id": "op", "unit_id": "unit", "status": "failed"}
    executor = RustModelExecutorClient("http://127.0.0.1:41000", "job", "a" * 64)
    session = mock.Mock()
    session.request.side_effect = [result, failed]
    writer = PipelineEventWriter(job_id="job-1", job_root=tmp_path, logs_dir=tmp_path / "logs")
    with pipeline_event_writer_scope(writer), mock.patch.object(executor, "_session", return_value=session), mock.patch("time.sleep"):
        try:
            executor.request(operation_id="op", unit_id="unit", messages=[{"role": "user", "content": "x"}])
        except Exception:  # noqa: BLE001
            pass
    assert [row["payload"].get("upstream_wait_transition") for row in _rows(writer)] == ["started", "ended"]


def test_agent_engine_reporter_turns_transport_waits_into_events(tmp_path: Path) -> None:
    from retainpdf_translation_agent_engine import agent_flow

    on_wait = agent_flow._upstream_wait_reporter("https://api.anthropic.com/v1")
    writer = PipelineEventWriter(job_id="job-1", job_root=tmp_path, logs_dir=tmp_path / "logs")
    with pipeline_event_writer_scope(writer):
        _start_progress()
        on_wait({"http_status": 529, "code": "overloaded_error", "retry_after_s": 2.5, "wait_source": "backoff", "attempt": 2, "max_attempts": 6})
        on_wait(None)
        on_wait(None)  # 多报一次结束不另发事件
    rows = _rows(writer)
    assert [row["payload"].get("upstream_wait_transition") for row in rows] == [None, "started", "ended"]
    wait = rows[1]["payload"]["upstream_wait"]
    assert (wait["provider"], wait["http_status"], wait["reason"], wait["code"]) == ("anthropic", 529, "overloaded", "overloaded_error")
