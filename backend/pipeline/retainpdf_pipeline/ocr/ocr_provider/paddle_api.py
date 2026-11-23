from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any
from typing import Callable

import requests

from retainpdf_base.local_env import get_secret
from retainpdf_base.upstream import tag_upstream
from retainpdf_pipeline.ocr.retry import RetainNetworkError
from retainpdf_pipeline.ocr.retry import RetainRateLimitError
from retainpdf_pipeline.ocr.retry import direct_session
from retainpdf_pipeline.ocr.retry import request_with_retry
from retainpdf_pipeline.ocr.retry import stepped_poll_interval
from retainpdf_pipeline.ocr.ocr_provider.provider_config import normalize_paddle_model_name


PADDLE_BASE_URL = "https://paddleocr.aistudio-app.com"
PADDLE_TOKEN_ENV = "RETAIN_PADDLE_API_TOKEN"
PADDLE_ENV_FILE = "paddle.env"
PADDLE_RETRY_ATTEMPTS_ENV = "RETAIN_PADDLE_RETRY_ATTEMPTS"
PADDLE_RETRY_BACKOFF_ENV = "RETAIN_PADDLE_RETRY_BACKOFF_SECONDS"
PADDLE_MAX_INPUT_IMAGES = 999
_SESSION: requests.Session | None = None


class PaddleNetworkError(RetainNetworkError):
    pass


class PaddleRateLimitError(RetainRateLimitError, PaddleNetworkError):
    pass


# 官方异步接口：当日解析页数额度用完（HTTP 403）。不是 Token 不对，换 Key 当天也不一定好。
PADDLE_DAILY_QUOTA_CODE = 12001


class PaddleRequestRejected(requests.HTTPError):
    """Paddle 明确拒绝了请求：不重试的 4xx，或者 HTTP 200 但包里的 code 不是 0。

    报错文字只带状态码、业务码、服务商原话和 traceId，不带请求地址（签名地址不能进日志）。
    仍是 `requests.HTTPError`，原来按 HTTPError 接的地方照旧。"""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        provider_code: str = "",
        response: Any = None,
        request: Any = None,
    ) -> None:
        super().__init__(message, response=response, request=request)
        self.status_code = status_code
        self.provider_code = provider_code


class PaddleQuotaExhausted(PaddleRequestRejected):
    """当日页数额度用完（12001）。类名带 QuotaExhausted，结构化失败归 `upstream_quota_exhausted`（不可重试），
    不再因为 HTTP 403 被说成「鉴权失败」。"""

    failure_summary = "PaddleOCR 今日解析页数额度已用完（12001）"
    failure_suggestion = "PaddleOCR 每个账号每天有解析页数额度，次日恢复：明天再试，或换一个 Token、换用其他 OCR。"


def _error_fields(payload: Any) -> tuple[int, str, str]:
    """从 Paddle 的返回包里读 (业务码, 说明, traceId)。官方异步接口是 code/msg/traceId，
    同步接口和旧写法是 errorCode/errorMsg/logId，两种都认。读不出业务码时为 0。"""
    if not isinstance(payload, dict):
        return 0, "", ""
    code = 0
    for key in ("errorCode", "code"):
        try:
            value = int(payload.get(key) or 0)
        except (TypeError, ValueError):
            value = 0
        if value:
            code = value
            break
    message = str(payload.get("errorMsg") or payload.get("msg") or payload.get("message") or "").strip()
    trace_id = str(payload.get("logId") or payload.get("traceId") or "").strip()
    return code, message[:200], trace_id


def _rejected_error(
    summary: str,
    *,
    code: int,
    message: str,
    trace_id: str,
    status_code: int | None = None,
    response: Any = None,
    request: Any = None,
) -> PaddleRequestRejected:
    error_class = PaddleQuotaExhausted if code == PADDLE_DAILY_QUOTA_CODE else PaddleRequestRejected
    text = f"{summary} code={code or ''} msg={message} logId={trace_id}"
    if error_class is PaddleQuotaExhausted:
        text = f"PaddleOCR 今日解析页数额度已用完：{text}"
    return error_class(
        text,
        status_code=status_code,
        provider_code=str(code) if code else "",
        response=response,
        request=request,
    )


def get_paddle_token(*, explicit_value: str = "") -> str:
    return get_secret(
        explicit_value=explicit_value,
        env_var=PADDLE_TOKEN_ENV,
        env_file_name=PADDLE_ENV_FILE,
    )


def normalize_model_name(model: str) -> str:
    return normalize_paddle_model_name(model)


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
    return direct_session(pool_connections=8, pool_maxsize=8)


def _get_session() -> requests.Session:
    global _SESSION
    if _SESSION is None:
        _SESSION = _build_session()
    return _SESSION


def _request_with_retry(method: str, url: str, *, timeout: int, **kwargs: Any) -> requests.Response:
    try:
        return request_with_retry(
            _get_session(),
            method,
            url,
            timeout=timeout,
            attempts=_retry_attempts(),
            backoff_seconds=_retry_backoff_seconds(),
            label="Paddle OCR",
            **kwargs,
        )
    except RetainRateLimitError as err:
        raise PaddleRateLimitError(str(err)) from err
    except RetainNetworkError as err:
        raise PaddleNetworkError(str(err)) from err
    except requests.HTTPError as err:
        # 不重试的 4xx：把服务商的业务码和说明带上（403 可能是 Token 不对，也可能是 12001 当日额度用完）
        response = err.response
        try:
            payload = response.json() if response is not None else None
        except Exception:  # noqa: BLE001 - 返回体不是 JSON 时只留状态码
            payload = None
        code, message, trace_id = _error_fields(payload)
        if not code:
            raise
        raise _rejected_error(
            str(err),
            code=code,
            message=message,
            trace_id=trace_id,
            status_code=getattr(response, "status_code", None),
            response=response,
            request=err.request,
        ) from None


def build_optional_payload(model: str) -> dict[str, Any]:
    normalized = normalize_model_name(model).lower()
    if "pp-structurev3" in normalized:
        return {
            "max_num_input_imgs": PADDLE_MAX_INPUT_IMAGES,
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
        "max_num_input_imgs": PADDLE_MAX_INPUT_IMAGES,
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
    code, message, trace_id = _error_fields(payload)
    if code:
        # 类型和业务码来自 fix/failure-fallback-classes（12001 当日额度），上游编号来自 feat/failure-upstream
        raise tag_upstream(
            _rejected_error(f"Paddle {stage} failed:", code=code, message=message, trace_id=trace_id),
            provider="paddle",
            code=code,
        )
    return payload


def submit_local_file(
    *,
    token: str,
    file_path: Path,
    model: str,
    optional_payload: dict[str, Any],
    page_ranges: str = "",
    base_url: str = "",
) -> tuple[str, str]:
    resolved_base = (base_url or PADDLE_BASE_URL).strip().rstrip("/")
    file_bytes = file_path.read_bytes()
    form_data = {
        "model": model,
        "optionalPayload": json.dumps(optional_payload, ensure_ascii=False),
    }
    if page_ranges.strip():
        form_data["pageRanges"] = page_ranges.strip()
    response = _request_with_retry(
        "post",
        f"{resolved_base}/api/v2/ocr/jobs",
        headers=build_headers(token),
        data=form_data,
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
    page_ranges: str = "",
    base_url: str = "",
) -> tuple[str, str]:
    resolved_base = (base_url or PADDLE_BASE_URL).strip().rstrip("/")
    body = {
        "fileUrl": source_url,
        "model": model,
        "optionalPayload": optional_payload,
    }
    if page_ranges.strip():
        body["pageRanges"] = page_ranges.strip()
    response = _request_with_retry(
        "post",
        f"{resolved_base}/api/v2/ocr/jobs",
        headers={**build_headers(token), "Content-Type": "application/json"},
        json=body,
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


def _merge_data_info(
    current: dict[str, Any],
    incoming: dict[str, Any],
    *,
    chunk_layout_count: int,
    total_layout_count: int,
) -> dict[str, Any]:
    """Merge per-line Paddle metadata without dropping later page records.

    The official endpoint emits JSONL chunks.  Depending on the model/version,
    ``dataInfo.pages`` is either chunk-local or a repeated complete snapshot.
    Scalars are therefore filled non-destructively, while page lists are
    appended only until the advertised total is reached.
    """

    merged = dict(current)
    incoming_pages = incoming.get("pages")
    for key, value in incoming.items():
        if key == "pages":
            continue
        if key not in merged or merged.get(key) in (None, "", [], {}):
            merged[key] = value

    if not isinstance(incoming_pages, list):
        return merged

    current_pages = merged.get("pages")
    pages = list(current_pages) if isinstance(current_pages, list) else []
    expected_values = [
        value
        for value in (current.get("numPages"), incoming.get("numPages"))
        if isinstance(value, (int, float)) and value >= 0
    ]
    expected = max((int(value) for value in expected_values), default=0)
    if expected:
        merged["numPages"] = expected

    if not pages:
        pages = list(incoming_pages)
    elif total_layout_count and len(incoming_pages) == total_layout_count:
        # Cumulative snapshot: replace prior chunk-local metadata.
        pages = list(incoming_pages)
    elif chunk_layout_count and len(incoming_pages) == chunk_layout_count:
        # Chunk-local metadata: append even when page dictionaries are equal;
        # equal-sized PDF pages commonly have identical metadata.
        pages.extend(incoming_pages)
    elif expected and len(incoming_pages) >= expected:
        # A complete snapshot is more authoritative than prior chunk-local
        # fragments and must not be appended repeatedly.
        pages = list(incoming_pages[:expected])
    elif len(incoming_pages) > len(pages) and incoming_pages[: len(pages)] == pages:
        # Cumulative metadata can arrive ahead of its matching layout chunk.
        pages = list(incoming_pages)
    elif not expected or len(pages) < expected:
        remaining = expected - len(pages) if expected else len(incoming_pages)
        pages.extend(incoming_pages[:remaining])

    merged["pages"] = pages[:expected] if expected else pages
    return merged


def download_jsonl_result(*, jsonl_url: str) -> dict[str, Any]:
    response = _request_with_retry("get", jsonl_url, timeout=300)
    layout_results: list[Any] = []
    data_info: dict[str, Any] = {}
    provider_result_extras: list[dict[str, Any]] = []
    provider_envelope_extras: list[dict[str, Any]] = []
    provider_data_info_records: list[dict[str, Any]] = []
    line_count = 0
    data_info_line_count = 0
    for raw_line in response.text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        line_count += 1
        payload = json.loads(line)
        result = dict(payload.get("result") or {})
        envelope_extras = {key: value for key, value in payload.items() if key != "result"}
        result_extras = {
            key: value
            for key, value in result.items()
            if key not in {"layoutParsingResults", "dataInfo"}
        }
        provider_envelope_extras.append(envelope_extras)
        provider_result_extras.append(result_extras)
        items = result.get("layoutParsingResults") or []
        chunk_layout_count = len(items) if isinstance(items, list) else 0
        if isinstance(items, list):
            layout_results.extend(items)
        if isinstance(result.get("dataInfo"), dict):
            data_info_line_count += 1
            incoming_data_info = dict(result.get("dataInfo") or {})
            provider_data_info_records.append(incoming_data_info)
            data_info = _merge_data_info(
                data_info,
                incoming_data_info,
                chunk_layout_count=chunk_layout_count,
                total_layout_count=len(layout_results),
            )
    data_info_pages = data_info.get("pages")
    data_info_page_count = len(data_info_pages) if isinstance(data_info_pages, list) else 0
    if layout_results and data_info_page_count == len(layout_results):
        data_info["numPages"] = len(layout_results)
    return {
        "layoutParsingResults": layout_results,
        "dataInfo": data_info,
        # Preserve new/unknown JSONL fields at the raw transport boundary so a
        # future adapter can consume them without another OCR request.
        "providerResultExtras": provider_result_extras,
        "providerEnvelopeExtras": provider_envelope_extras,
        "providerDataInfoRecords": provider_data_info_records,
        "_meta": {
            "source": "paddle_jsonl",
            "lineCount": line_count,
            "layoutPageCount": len(layout_results),
            "dataInfoLineCount": data_info_line_count,
            "dataInfoPageCount": data_info_page_count,
            "dataInfoComplete": data_info_page_count == len(layout_results),
            "dataInfoConflictKeys": sorted(
                key
                for key in {
                    key
                    for record in provider_data_info_records
                    for key in record
                    if key != "pages"
                }
                if len(
                    {
                        json.dumps(record.get(key), ensure_ascii=False, sort_keys=True)
                        for record in provider_data_info_records
                        if key in record
                    }
                )
                > 1
            ),
        },
    }


def poll_until_done(
    *,
    token: str,
    job_id: str,
    poll_interval: int,
    poll_timeout: int,
    base_url: str = "",
    progress_callback: Callable[[str, dict[str, Any]], None] | None = None,
) -> tuple[dict[str, Any], str]:
    started = time.time()
    while True:
        payload = query_job(token=token, job_id=job_id, base_url=base_url)
        state = str(payload.get("state", "") or "").strip()
        print(f"paddle task {job_id}: state={state}", flush=True)
        if progress_callback is not None:
            progress_callback(state, payload)
        if state == "done":
            result_url = dict(payload.get("resultUrl") or {})
            jsonl_url = str(result_url.get("jsonUrl", "") or "").strip()
            if not jsonl_url:
                raise RuntimeError("Paddle task finished but resultUrl.jsonUrl is missing")
            return payload, jsonl_url
        if state == "failed":
            raise RuntimeError(f"Paddle task failed: {payload.get('errorMsg', '') or 'unknown error'}")
        elapsed = time.time() - started
        if elapsed > poll_timeout:
            raise TimeoutError(f"Timed out waiting for Paddle task {job_id}")
        time.sleep(stepped_poll_interval(elapsed, poll_interval))
