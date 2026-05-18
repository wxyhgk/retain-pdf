from __future__ import annotations

import sys
from pathlib import Path

import pytest
import requests


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.ocr_provider import paddle_api
from services.ocr_provider import paddle_markdown
from services.mineru import mineru_api


class _Response:
    def __init__(self, status_code: int, headers: dict[str, str] | None = None) -> None:
        self.status_code = status_code
        self.headers = headers or {}
        self.url = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
        self.reason = "error"

    def raise_for_status(self) -> None:
        raise requests.HTTPError(f"{self.status_code} Client Error", response=self)


class _Session:
    def __init__(self, response: _Response) -> None:
        self.response = response
        self.calls = 0

    def request(self, *_args, **_kwargs):
        self.calls += 1
        return self.response


def test_paddle_request_retries_429_and_raises_rate_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _Session(_Response(429, headers={"Retry-After": "1"}))
    sleeps: list[float] = []

    monkeypatch.setattr(paddle_api, "_get_session", lambda: session)
    monkeypatch.setenv(paddle_api.PADDLE_RETRY_ATTEMPTS_ENV, "2")
    monkeypatch.setattr(paddle_api.time, "sleep", lambda seconds: sleeps.append(seconds))

    with pytest.raises(paddle_api.PaddleRateLimitError):
        paddle_api._request_with_retry("get", "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs", timeout=1)

    assert session.calls == 2
    assert sleeps == [1.0]


def test_paddle_request_does_not_retry_auth_failures(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _Session(_Response(401))

    monkeypatch.setattr(paddle_api, "_get_session", lambda: session)
    monkeypatch.setenv(paddle_api.PADDLE_RETRY_ATTEMPTS_ENV, "3")

    with pytest.raises(requests.HTTPError):
        paddle_api._request_with_retry("get", "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs", timeout=1)

    assert session.calls == 1


def test_paddle_optional_payload_sets_page_limit() -> None:
    payload = paddle_api.build_optional_payload("PaddleOCR-VL-1.5")
    assert payload["max_num_input_imgs"] == 999

    structure_payload = paddle_api.build_optional_payload("PP-StructureV3")
    assert structure_payload["max_num_input_imgs"] == 999


def test_mineru_request_retries_429_and_raises_rate_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _Session(_Response(429, headers={"Retry-After": "1"}))
    sleeps: list[float] = []

    monkeypatch.setattr(mineru_api, "_get_session", lambda: session)
    monkeypatch.setenv(mineru_api.MINERU_RETRY_ATTEMPTS_ENV, "2")
    monkeypatch.setattr(mineru_api.time, "sleep", lambda seconds: sleeps.append(seconds))

    with pytest.raises(mineru_api.MinerURateLimitError):
        mineru_api.request_mineru("get", "https://mineru.net/api/v4/extract/task/test", timeout=1)

    assert session.calls == 2
    assert sleeps == [1.0]


def test_paddle_markdown_remote_image_uses_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    class Response:
        content = b"image-bytes"

    calls: list[tuple[str, str]] = []

    def fake_request_with_retry(_session, method, url, **_kwargs):
        calls.append((method, url))
        return Response()

    monkeypatch.setattr(paddle_markdown, "request_with_retry", fake_request_with_retry)

    assert paddle_markdown.decode_paddle_markdown_image("https://example.test/image.png") == b"image-bytes"
    assert calls == [("get", "https://example.test/image.png")]
