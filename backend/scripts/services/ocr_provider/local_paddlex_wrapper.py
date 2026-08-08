from __future__ import annotations

import os
import sys

# When this module is invoked directly as a script (`python local_paddlex_wrapper.py`,
# exactly how local_command_driver spawns it), the interpreter auto-inserts this
# script's own directory at sys.path[0]. That directory also contains a sibling
# `types.py` module, which then shadows the stdlib `types` module and breaks
# further stdlib imports (enum/dataclasses/weakref all import from stdlib `types`).
# Drop that auto-inserted entry before importing anything from the stdlib that
# could pull in `types` transitively (e.g. base64 -> re -> enum -> types).
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if sys.path and sys.path[0] == _SCRIPT_DIR:
    sys.path.pop(0)

import base64
import json
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


def _paddlex_base_url() -> str:
    return (os.environ.get(PADDLEX_URL_ENV, "") or DEFAULT_PADDLEX_URL).strip().rstrip("/")


def _paddlex_timeout_seconds() -> float:
    raw = os.environ.get(PADDLEX_TIMEOUT_ENV, "").strip()
    if not raw:
        return DEFAULT_PADDLEX_TIMEOUT_SECONDS
    try:
        return float(raw)
    except ValueError:
        return DEFAULT_PADDLEX_TIMEOUT_SECONDS


def run(source_pdf_path: Path, raw_payload_json_path: Path) -> None:
    request_payload = build_request_payload(source_pdf_path)
    response = requests.post(
        f"{_paddlex_base_url()}/layout-parsing",
        json=request_payload,
        timeout=_paddlex_timeout_seconds(),
    )
    response.raise_for_status()
    result = extract_layout_result(response.json())
    raw_payload_json_path.parent.mkdir(parents=True, exist_ok=True)
    raw_payload_json_path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")


def main() -> int:
    source_pdf = os.environ.get("RETAIN_OCR_SOURCE_PDF", "").strip()
    raw_payload_json = os.environ.get("RETAIN_OCR_RAW_PAYLOAD_JSON", "").strip()
    if not source_pdf:
        print("local_paddlex_wrapper: RETAIN_OCR_SOURCE_PDF is empty", file=sys.stderr)
        return 1
    if not raw_payload_json:
        print("local_paddlex_wrapper: RETAIN_OCR_RAW_PAYLOAD_JSON is empty", file=sys.stderr)
        return 1
    try:
        run(Path(source_pdf), Path(raw_payload_json))
    except Exception as exc:
        print(f"local_paddlex_wrapper: {exc}", file=sys.stderr)
        return 1
    print(f"local_paddlex_wrapper: wrote {raw_payload_json}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
