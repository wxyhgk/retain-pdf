"""OCR 请求被服务商限流退避等待时报 upstream_wait（user_stage=ocr）；没给服务商的下载不报。"""
from __future__ import annotations

import json
from pathlib import Path

import requests

from retainpdf_base.events import PipelineEventWriter
from retainpdf_base.events import pipeline_event_writer_scope
from retainpdf_pipeline.ocr import retry


class _Session:
    def __init__(self, responses):
        self.responses = list(responses)

    def request(self, method, url, timeout=None, **kwargs):
        return self.responses.pop(0)


def _response(status: int, headers: dict | None = None, body: bytes = b"{}") -> requests.Response:
    response = requests.Response()
    response.status_code = status
    response._content = body
    response.headers.update(headers or {})
    response.url = "https://example.invalid/x"
    return response


def _rows(writer: PipelineEventWriter) -> list[dict]:
    if not writer.path.exists():
        return []
    return [json.loads(line) for line in writer.path.read_text(encoding="utf-8").splitlines() if line.strip()]


def test_ocr_429_reports_wait_for_the_provider(monkeypatch, tmp_path: Path) -> None:
    sleeps: list[float] = []
    monkeypatch.setattr(retry.time, "sleep", sleeps.append)
    session = _Session([_response(429, {"Retry-After": "4"}, b'{"error":{"code":"1302"}}'), _response(200)])
    writer = PipelineEventWriter(job_id="job-ocr", job_root=tmp_path, logs_dir=tmp_path / "logs")
    with pipeline_event_writer_scope(writer):
        retry.request_with_retry(
            session, "post", "https://open.bigmodel.cn/api/paas/v4/layout_parsing",
            timeout=5, attempts=3, backoff_seconds=0.1, label="GLM-OCR", upstream_provider="glm_ocr",
        )
    assert sleeps == [4.0]
    rows = _rows(writer)
    assert [row["payload"]["upstream_wait_transition"] for row in rows] == ["started", "ended"]
    wait = rows[0]["payload"]["upstream_wait"]
    assert (wait["provider"], wait["http_status"], wait["code"], wait["retry_after_s"], wait["attempt"], wait["max_attempts"]) == (
        "glm_ocr", 429, "1302", 4.0, 1, 3,
    )
    assert all(row["user_stage"] == "ocr" for row in rows)


def test_downloads_without_provider_do_not_report(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(retry.time, "sleep", lambda seconds: None)
    session = _Session([_response(429, {"Retry-After": "1"}), _response(200)])
    writer = PipelineEventWriter(job_id="job-ocr", job_root=tmp_path, logs_dir=tmp_path / "logs")
    with pipeline_event_writer_scope(writer):
        retry.request_with_retry(session, "get", "https://example.invalid/a.pdf", timeout=5, attempts=3, backoff_seconds=0.1, label="Source PDF")
    assert _rows(writer) == []
