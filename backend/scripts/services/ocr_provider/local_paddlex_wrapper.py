from __future__ import annotations

import base64
import json
import os
import sys
from pathlib import Path
from typing import Any

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

import requests

from services.ocr_provider.paddle_api import build_optional_payload

PADDLEX_PIPELINE_MODEL = "PP-StructureV3"
PADDLEX_URL_ENV = "RETAIN_LOCAL_PADDLEX_URL"
PADDLEX_TIMEOUT_ENV = "RETAIN_LOCAL_PADDLEX_TIMEOUT_SECONDS"
DEFAULT_PADDLEX_URL = "http://localhost:8080"
DEFAULT_PADDLEX_TIMEOUT_SECONDS = 900.0


def build_request_payload(source_pdf_path: Path) -> dict[str, Any]:
    file_bytes = source_pdf_path.read_bytes()
    payload: dict[str, Any] = {
        "file": base64.b64encode(file_bytes).decode("ascii"),
        "fileType": 0,
    }
    payload.update(build_optional_payload(PADDLEX_PIPELINE_MODEL))
    return payload


def extract_layout_result(response_json: dict[str, Any]) -> dict[str, Any]:
    error_code = int(response_json.get("errorCode", 0) or 0)
    if error_code != 0:
        raise RuntimeError(
            f"PaddleX layout-parsing failed: code={error_code} "
            f"msg={response_json.get('errorMsg', '')} logId={response_json.get('logId', '')}"
        )
    result = response_json.get("result")
    if not isinstance(result, dict) or not isinstance(result.get("layoutParsingResults"), list):
        raise RuntimeError("PaddleX layout-parsing response missing result.layoutParsingResults")
    return result
