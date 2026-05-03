from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from foundation.shared.local_env import get_secret


PADDLE_BASE_URL = "https://paddleocr.aistudio-app.com"
PADDLE_TOKEN_ENV = "RETAIN_PADDLE_API_TOKEN"
PADDLE_ENV_FILE = "paddle.env"
PADDLE_RETRY_ATTEMPTS_ENV = "RETAIN_PADDLE_RETRY_ATTEMPTS"
PADDLE_RETRY_BACKOFF_ENV = "RETAIN_PADDLE_RETRY_BACKOFF_SECONDS"

_SESSION: requests.Session | None = None


def get_paddle_token(*, explicit_value: str = "") -> str:
    return get_secret(
        explicit_value=explicit_value,
        env_var=PADDLE_TOKEN_ENV,
        env_file_name=PADDLE_ENV_FILE,
    )


def normalize_model_name(model: str) -> str:
    trimmed = str(model or "").strip()
    if not trimmed:
        return "PaddleOCR-VL-1.5"
    lowered = trimmed.lower()
    if lowered in {"paddleocr-vl", "paddle-ocr-vl"}:
        return "PaddleOCR-VL"
    if lowered in {"paddleocr-vl-1.5", "paddle-ocr-vl-1.5"}:
        return "PaddleOCR-VL-1.5"
    return trimmed


def build_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"bearer {token.strip()}",
        "Accept": "application/json",
    }


def _retry_attempts() -> int:
    raw = os.environ.get(PADDLE_RETRY_ATTEMPTS_ENV, "").strip()
    try:
        value = int(raw) if raw else 3
    except ValueError:
        value = 3
    return max(1, value)


def _retry_backoff_seconds() -> float:
    raw = os.environ.get(PADDLE_RETRY_BACKOFF_ENV, "").strip()
    try:
        value = float(raw) if raw else 0.5
    except ValueError:
        value = 0.5
    return max(0.1, value)


def _build_session() -> requests.Session:
    session = requests.Session()
    session.trust_env = False
    session.proxies.clear()
    retry = Retry(
        total=0,
        connect=0,
        read=0,
        redirect=0,
        status=0,
        backoff_factor=0,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=8, pool_maxsize=8)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


def _get_session() -> requests.Session:
    global _SESSION
    if _SESSION is None:
        _SESSION = _build_session()
    return _SESSION


def _request_with_retry(method: str, url: str, *, timeout: int, **kwargs: Any) -> requests.Response:
    attempts = _retry_attempts()
    backoff_seconds = _retry_backoff_seconds()
    last_error: Exception | None = None
    session = _get_session()
    for attempt in range(1, attempts + 1):
        try:
            response = session.request(method, url, timeout=timeout, **kwargs)
            response.raise_for_status()
            return response
        except (requests.Timeout, requests.ConnectionError, requests.RequestException) as err:
            last_error = err
            if attempt >= attempts:
                break
            time.sleep(backoff_seconds * attempt)
    assert last_error is not None
    raise last_error


def build_optional_payload(model: str) -> dict[str, Any]:
    normalized = normalize_model_name(model).lower()
    if "pp-structurev3" in normalized:
        return {
            "markdownIgnoreLabels": [
                "header",
                "header_image",
                "footer",
                "footer_image",
                "number",
                "footnote",
                "aside_text",
            ],
            "useChartRecognition": False,
            "useRegionDetection": True,
            "useDocOrientationClassify": False,
            "useDocUnwarping": False,
            "useTextlineOrientation": False,
            "useSealRecognition": True,
            "useFormulaRecognition": True,
            "useTableRecognition": True,
            "layoutThreshold": 0.5,
            "layoutNms": True,
            "layoutUnclipRatio": 1,
            "textDetLimitType": "min",
            "textDetLimitSideLen": 64,
            "textDetThresh": 0.3,
            "textDetBoxThresh": 0.6,
            "textDetUnclipRatio": 1.5,
            "textRecScoreThresh": 0,
            "sealDetLimitType": "min",
            "sealDetLimitSideLen": 736,
            "sealDetThresh": 0.2,
            "sealDetBoxThresh": 0.6,
            "sealDetUnclipRatio": 0.5,
            "sealRecScoreThresh": 0,
            "useTableOrientationClassify": True,
            "useOcrResultsWithTableCells": True,
            "useE2eWiredTableRecModel": False,
            "useE2eWirelessTableRecModel": False,
            "useWiredTableCellsTransToHtml": False,
            "useWirelessTableCellsTransToHtml": False,
            "parseLanguage": "default",
            "visualize": False,
        }
    return {
        "mergeLayoutBlocks": False,
        "markdownIgnoreLabels": [
            "header",
            "header_image",
            "footer",
            "footer_image",
            "number",
            "footnote",
            "aside_text",
        ],
        "useDocOrientationClassify": False,
        "useDocUnwarping": False,
        "useLayoutDetection": True,
        "useChartRecognition": False,
        "useSealRecognition": True,
        "useOcrForImageBlock": False,
        "mergeTables": True,
        "relevelTitles": True,
        "layoutShapeMode": "auto",
        "promptLabel": "ocr",
        "repetitionPenalty": 1,
        "temperature": 0,
        "topP": 1,
        "minPixels": 147384,
        "maxPixels": 2822400,
        "layoutNms": True,
        "restructurePages": True,
        "visualize": False,
    }


def _check_envelope(payload: dict[str, Any], *, stage: str) -> dict[str, Any]:
    if int(payload.get("errorCode", 0) or 0) != 0:
        raise RuntimeError(
            f"Paddle {stage} failed: code={payload.get('errorCode')} msg={payload.get('errorMsg', '')} logId={payload.get('logId', '')}"
        )
    return payload


def submit_local_file(
    *,
    token: str,
    file_path: Path,
    model: str,
    optional_payload: dict[str, Any],
    base_url: str = "",
) -> tuple[str, str]:
    resolved_base = (base_url or PADDLE_BASE_URL).strip().rstrip("/")
    file_bytes = file_path.read_bytes()
    response = _request_with_retry(
        "post",
        f"{resolved_base}/api/v2/ocr/jobs",
        headers=build_headers(token),
        data={
            "model": model,
            "optionalPayload": json.dumps(optional_payload, ensure_ascii=False),
        },
        files={"file": (file_path.name, file_bytes)},
        timeout=120,
    )
    envelope = _check_envelope(response.json(), stage="submit")
    data = dict(envelope.get("data") or {})
    job_id = str(data.get("jobId", "") or "").strip()
    if not job_id:
        raise RuntimeError("Paddle submit returned empty jobId")
    return job_id, str(envelope.get("logId", "") or "").strip()


def submit_remote_url(
    *,
    token: str,
    source_url: str,
    model: str,
    optional_payload: dict[str, Any],
    base_url: str = "",
) -> tuple[str, str]:
    resolved_base = (base_url or PADDLE_BASE_URL).strip().rstrip("/")
    response = _request_with_retry(
        "post",
        f"{resolved_base}/api/v2/ocr/jobs",
        headers={**build_headers(token), "Content-Type": "application/json"},
        json={
            "fileUrl": source_url,
            "model": model,
            "optionalPayload": optional_payload,
        },
        timeout=120,
    )
    envelope = _check_envelope(response.json(), stage="submit")
    data = dict(envelope.get("data") or {})
    job_id = str(data.get("jobId", "") or "").strip()
    if not job_id:
        raise RuntimeError("Paddle submit returned empty jobId")
    return job_id, str(envelope.get("logId", "") or "").strip()


def query_job(*, token: str, job_id: str, base_url: str = "") -> dict[str, Any]:
    resolved_base = (base_url or PADDLE_BASE_URL).strip().rstrip("/")
    response = _request_with_retry(
        "get",
        f"{resolved_base}/api/v2/ocr/jobs/{job_id}",
        headers=build_headers(token),
        timeout=120,
    )
    envelope = _check_envelope(response.json(), stage="poll")
    return dict(envelope.get("data") or {})


def download_jsonl_result(*, jsonl_url: str) -> dict[str, Any]:
    response = _request_with_retry("get", jsonl_url, timeout=300)
    layout_results: list[Any] = []
    data_info: dict[str, Any] = {}
    line_count = 0
    for raw_line in response.text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        line_count += 1
        payload = json.loads(line)
        result = dict(payload.get("result") or {})
        items = result.get("layoutParsingResults") or []
        if isinstance(items, list):
            layout_results.extend(items)
        if not data_info and isinstance(result.get("dataInfo"), dict):
            data_info = dict(result.get("dataInfo") or {})
    return {
        "layoutParsingResults": layout_results,
        "dataInfo": data_info,
        "_meta": {
            "source": "paddle_jsonl",
            "lineCount": line_count,
        },
    }


def poll_until_done(
    *,
    token: str,
    job_id: str,
    poll_interval: int,
    poll_timeout: int,
    base_url: str = "",
) -> tuple[dict[str, Any], str]:
    started = time.time()
    while True:
        payload = query_job(token=token, job_id=job_id, base_url=base_url)
        state = str(payload.get("state", "") or "").strip()
        print(f"paddle task {job_id}: state={state}", flush=True)
        if state == "done":
            result_url = dict(payload.get("resultUrl") or {})
            jsonl_url = str(result_url.get("jsonUrl", "") or "").strip()
            if not jsonl_url:
                raise RuntimeError("Paddle task finished but resultUrl.jsonUrl is missing")
            return payload, jsonl_url
        if state == "failed":
            raise RuntimeError(f"Paddle task failed: {payload.get('errorMsg', '') or 'unknown error'}")
        if time.time() - started > poll_timeout:
            raise TimeoutError(f"Timed out waiting for Paddle task {job_id}")
        time.sleep(max(1, poll_interval))
