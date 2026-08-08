from __future__ import annotations

import base64
import sys
from pathlib import Path

import pytest


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
