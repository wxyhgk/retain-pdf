from __future__ import annotations

import base64
import json
import sys
from pathlib import Path
from typing import Any

import pytest
import requests


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from services.ocr_provider import local_paddlex_wrapper


def test_build_request_payload_embeds_base64_file_and_pp_structurev3_options(tmp_path: Path) -> None:
    pdf_path = tmp_path / "source.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\nfake pdf bytes\n")

    payload = local_paddlex_wrapper.build_request_payload(pdf_path)

    assert payload["fileType"] == 0
    assert base64.b64decode(payload["file"]) == pdf_path.read_bytes()
    assert payload["useTableRecognition"] is True
    assert payload["useFormulaRecognition"] is True


def test_extract_layout_result_returns_result_on_success() -> None:
    response_json = {
        "logId": "log-1",
        "errorCode": 0,
        "errorMsg": "Success",
        "result": {"layoutParsingResults": [{"prunedResult": {}}], "dataInfo": {}},
    }

    result = local_paddlex_wrapper.extract_layout_result(response_json)

    assert result == {"layoutParsingResults": [{"prunedResult": {}}], "dataInfo": {}}


def test_extract_layout_result_raises_on_error_envelope() -> None:
    response_json = {"logId": "log-2", "errorCode": 13, "errorMsg": "boom"}

    with pytest.raises(RuntimeError, match="boom"):
        local_paddlex_wrapper.extract_layout_result(response_json)


def test_extract_layout_result_raises_when_layout_results_missing() -> None:
    response_json = {"errorCode": 0, "errorMsg": "Success", "result": {"dataInfo": {}}}

    with pytest.raises(RuntimeError, match="layoutParsingResults"):
        local_paddlex_wrapper.extract_layout_result(response_json)


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict[str, Any]) -> None:
        self.status_code = status_code
        self._payload = payload

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code} error")

    def json(self) -> dict[str, Any]:
        return self._payload


def test_run_writes_result_to_raw_payload_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    pdf_path = tmp_path / "source.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\nfake\n")
    raw_payload_path = tmp_path / "ocr" / "local_raw" / "payload.json"
    captured: dict[str, Any] = {}

    def fake_post(url: str, json: dict[str, Any], timeout: float):
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return _FakeResponse(
            200,
            {
                "errorCode": 0,
                "errorMsg": "Success",
                "result": {"layoutParsingResults": [{"prunedResult": {}}], "dataInfo": {}},
            },
        )

    monkeypatch.setattr(local_paddlex_wrapper.requests, "post", fake_post)
    monkeypatch.setenv(local_paddlex_wrapper.PADDLEX_URL_ENV, "http://paddlex.test:8080")

    local_paddlex_wrapper.run(pdf_path, raw_payload_path)

    assert captured["url"] == "http://paddlex.test:8080/layout-parsing"
    assert captured["timeout"] == local_paddlex_wrapper.DEFAULT_PADDLEX_TIMEOUT_SECONDS
    written = json.loads(raw_payload_path.read_text(encoding="utf-8"))
    assert written == {"layoutParsingResults": [{"prunedResult": {}}], "dataInfo": {}}


def test_main_returns_1_and_prints_stderr_on_missing_source_pdf_env(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("RETAIN_OCR_SOURCE_PDF", raising=False)
    monkeypatch.setenv("RETAIN_OCR_RAW_PAYLOAD_JSON", "/tmp/does-not-matter.json")

    exit_code = local_paddlex_wrapper.main()

    assert exit_code == 1
    assert "RETAIN_OCR_SOURCE_PDF" in capsys.readouterr().err


def test_main_returns_1_and_prints_stderr_on_http_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    pdf_path = tmp_path / "source.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\nfake\n")
    raw_payload_path = tmp_path / "payload.json"

    def fake_post(*_args, **_kwargs):
        return _FakeResponse(503, {})

    monkeypatch.setattr(local_paddlex_wrapper.requests, "post", fake_post)
    monkeypatch.setenv("RETAIN_OCR_SOURCE_PDF", str(pdf_path))
    monkeypatch.setenv("RETAIN_OCR_RAW_PAYLOAD_JSON", str(raw_payload_path))

    exit_code = local_paddlex_wrapper.main()

    assert exit_code == 1
    assert "503" in capsys.readouterr().err
    assert not raw_payload_path.exists()
