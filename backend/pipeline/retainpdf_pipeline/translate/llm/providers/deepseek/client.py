from __future__ import annotations
import hashlib
import json
import os
import re
import socket
import time
from typing import Any

import requests

from retainpdf_pipeline.foundation.shared.local_env import get_secret
from retainpdf_pipeline.translate.artifacts import get_active_translation_run_diagnostics
from retainpdf_pipeline.translate.artifacts import infer_stage_from_request_label
from retainpdf_pipeline.translate.llm.shared import upstream_resilience as _resilience
from retainpdf_pipeline.translate.llm.providers.deepseek import transport
from retainpdf_pipeline.translate.llm.shared.prompt_building import build_messages
from retainpdf_pipeline.translate.llm.shared.prompt_building import build_single_item_fallback_messages
from retainpdf_pipeline.translate.llm.shared.response_parsing import extract_json_text
from retainpdf_pipeline.translate.llm.shared.response_parsing import extract_single_item_translation_text
from retainpdf_pipeline.translate.llm.shared.response_parsing import unwrap_translation_shell


DEFAULT_BASE_URL = "https://api.deepseek.com/v1"
DEFAULT_MODEL = "deepseek-v4-flash"
DEFAULT_API_KEY_ENV = "DEEPSEEK_API_KEY"
DEFAULT_API_KEY_FILE = "deepseek.env"
STREAM_RESPONSES_ENV = "PDF_TRANSLATOR_DEEPSEEK_STREAM"
HTTP_RETRY_ATTEMPTS = transport.HTTP_RETRY_ATTEMPTS
DNS_RETRY_MIN_ATTEMPTS = transport.DNS_RETRY_MIN_ATTEMPTS
HTTP_RATE_LIMIT_WAIT_MAX_SECS = transport.HTTP_RATE_LIMIT_WAIT_MAX_SECS
TRANSPORT_RECOVERY_ATTEMPTS_ENV = "RETAIN_TRANSLATION_TRANSPORT_RECOVERY_ATTEMPTS"
TRANSPORT_RECOVERY_SECONDS_ENV = "RETAIN_TRANSLATION_TRANSPORT_RECOVERY_SECONDS"
DEFAULT_TRANSPORT_RECOVERY_ATTEMPTS = 4
DEFAULT_TRANSPORT_RECOVERY_SECONDS = 60


def _env_int(name: str, default: int, *, minimum: int = 1) -> int:
    return transport.env_int(name, default, minimum=minimum)


def normalize_base_url(base_url: str) -> str:
    return transport.normalize_base_url(base_url)


def _hostname_from_base_url(base_url: str) -> str:
    return transport.hostname_from_base_url(base_url)


def is_dns_resolution_error(exc: Exception) -> bool:
    return transport.is_dns_resolution_error(exc)


def _prewarm_dns(base_url: str, *, request_label: str = "") -> None:
    transport.prewarm_dns(base_url, request_label=request_label)


def chat_completions_url(base_url: str) -> str:
    return transport.chat_completions_url(base_url)


def build_headers(api_key: str) -> dict[str, str]:
    return transport.build_headers(api_key)


def _message_chars(messages: list[dict[str, str]]) -> int:
    total = 0
    for message in messages:
        if not isinstance(message, dict):
            continue
        total += len(str(message.get("content", "") or ""))
    return total


def _body_bytes(body: dict[str, Any]) -> int:
    return len(json.dumps(body, ensure_ascii=False).encode("utf-8"))


def _request_journal_key(*, base_url: str, body: dict[str, Any]) -> str:
    canonical = json.dumps(
        {"endpoint": chat_completions_url(base_url), "body": body},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def _request_journal_outcome(exc: Exception) -> str:
    if isinstance(exc, requests.HTTPError) and exc.response is not None:
        return "rejected"
    if isinstance(exc, (ValueError, KeyError, json.JSONDecodeError)):
        return "invalid_response"
    return "ambiguous"


def _response_text_excerpt(response: requests.Response, *, max_chars: int = 800) -> str:
    try:
        text = response.text or ""
    except Exception as exc:  # noqa: BLE001
        return f"<failed to read response body: {type(exc).__name__}: {exc}>"
    compact = " ".join(text.strip().split())
    if len(compact) > max_chars:
        return f"{compact[:max_chars]}...<truncated>"
    return compact


def _request_meta_summary(
    *,
    model: str,
    messages: list[dict[str, str]],
    body: dict[str, Any],
    use_stream: bool,
) -> str:
    response_format = body.get("response_format")
    response_format_type = (
        str(response_format.get("type", "") or "")
        if isinstance(response_format, dict)
        else ("present" if response_format is not None else "none")
    )
    return (
        f"model={model} messages={len(messages)} message_chars={_message_chars(messages)} "
        f"body_bytes={_body_bytes(body)} stream={use_stream} response_format={response_format_type or 'none'}"
    )


def _raise_for_status_with_context(
    response: requests.Response,
    *,
    model: str,
    messages: list[dict[str, str]],
    body: dict[str, Any],
    use_stream: bool,
) -> None:
    status_code = int(getattr(response, "status_code", 200) or 200)
    if status_code < 400:
        return
    response_body = _response_text_excerpt(response) or "<empty>"
    reason = getattr(response, "reason", "") or "Error"
    url = getattr(response, "url", "") or "<unknown-url>"
    hint = _resilience.hint_for_status(status_code)
    hint_suffix = f" | {hint}" if hint else ""
    raise requests.HTTPError(
        f"{status_code} Client Error: {reason} for url: {url} | "
        f"response_body={response_body} | "
        f"request_meta={_request_meta_summary(model=model, messages=messages, body=body, use_stream=use_stream)}"
        f"{hint_suffix}",
        response=response,
    )


def _supports_response_schema_fallback(response_format: dict[str, Any] | None) -> bool:
    if not isinstance(response_format, dict):
        return False
    return str(response_format.get("type", "") or "").strip().lower() == "json_schema"


def _provider_supports_json_schema(*, model: str, base_url: str) -> bool:
    normalized_base = normalize_base_url(base_url).lower()
    normalized_model = (model or "").strip().lower()
    if "api.deepseek.com" in normalized_base:
        return False
    if normalized_model.startswith("deepseek"):
        return False
    return True


def _fallback_response_format(response_format: dict[str, Any] | None) -> dict[str, str] | None:
    if not _supports_response_schema_fallback(response_format):
        return response_format
    return {"type": "json_object"}


def should_use_stream_responses() -> bool:
    value = os.environ.get(STREAM_RESPONSES_ENV, "")
    return value.strip().lower() in {"1", "true", "yes", "on"}


def should_trust_env_proxy() -> bool:
    return transport.should_trust_env_proxy()


def _build_session() -> requests.Session:
    return transport.build_session()


def _drop_session(session_key: str) -> None:
    transport.drop_session(session_key)


def get_session() -> requests.Session:
    return transport.get_session()


def _request_session_key() -> str:
    return transport.request_session_key()


def is_transport_error(exc: Exception) -> bool:
    return transport.is_transport_error(exc)


def _is_retryable_http_error(exc: Exception) -> bool:
    return is_transport_error(exc)


def _should_drop_session_after_error(exc: Exception) -> bool:
    return transport.should_drop_session_after_error(exc)


def _retry_delay(attempt: int) -> float:
    return transport.retry_delay(attempt)


def _retry_after_delay(exc: Exception, attempt: int) -> tuple[float, str]:
    return transport.retry_after_delay(exc, attempt)


def _extract_stream_delta_text(data: dict[str, Any]) -> str:
    choices = data.get("choices")
    if not isinstance(choices, list):
        return ""
    chunks: list[str] = []
    for choice in choices:
        if not isinstance(choice, dict):
            continue
        delta = choice.get("delta")
        if isinstance(delta, dict):
            content = delta.get("content")
            if isinstance(content, str) and content:
                chunks.append(content)
            continue
        message = choice.get("message")
        if isinstance(message, dict):
            content = message.get("content")
            if isinstance(content, str) and content:
                chunks.append(content)
    return "".join(chunks)


def _read_streaming_chat_content(response: requests.Response) -> tuple[str, dict | None]:
    chunks: list[str] = []
    usage: dict | None = None
    for raw_line in response.iter_lines(decode_unicode=True):
        if raw_line is None:
            continue
        line = raw_line.strip()
        if not line or not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if not payload or payload == "[DONE]":
            continue
        data = json.loads(payload)
        piece = _extract_stream_delta_text(data)
        if piece:
            chunks.append(piece)
        # DeepSeek reports token usage on the final stream chunk.
        chunk_usage = data.get("usage")
        if isinstance(chunk_usage, dict):
            usage = chunk_usage
    return "".join(chunks), usage


def request_chat_content(
    messages: list[dict[str, str]],
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    temperature: float = 0.2,
    response_format: dict[str, str] | None = None,
    timeout: int = 120,
    request_label: str = "",
    max_attempts: int | None = None,
) -> str:
    from retainpdf_pipeline.translate.llm.shared.executor_context import execution_enabled, runtime
    if execution_enabled():
        # Rust owns provider policy, deadlines, concurrency and network retries.
        # No Python slot, HTTP request, API key lookup or direct fallback here.
        return runtime().request(messages, temperature=temperature, response_format=response_format)
    last_error: Exception | None = None
    request_stage = infer_stage_from_request_label(request_label)
    diagnostics = get_active_translation_run_diagnostics()
    active_response_format = response_format
    if _supports_response_schema_fallback(active_response_format) and not _provider_supports_json_schema(
        model=model,
        base_url=base_url,
    ):
        active_response_format = _fallback_response_format(active_response_format)
    attempted_schema_fallback = False
    accumulated_rate_limit_wait = 0
    body: dict[str, Any] = {
        "model": model,
        "temperature": temperature,
        "messages": messages,
    }
    # DashScope Qwen3.8 Flash defaults to thinking. Translation does not need
    # this extra generation pass; leave other providers/models untouched.
    if model.strip().lower() == "qwen3.8-flash" and _hostname_from_base_url(base_url) == "dashscope.aliyuncs.com":
        body["enable_thinking"] = False
    use_stream = should_use_stream_responses()
    if use_stream:
        body["stream"] = True
    if active_response_format is not None:
        body["response_format"] = active_response_format

    attempt_limit = max(1, int(max_attempts or HTTP_RETRY_ATTEMPTS))
    dns_retry_limit = max(attempt_limit, DNS_RETRY_MIN_ATTEMPTS)
    transport_recovery_attempt_limit = max(
        attempt_limit,
        _env_int(
            TRANSPORT_RECOVERY_ATTEMPTS_ENV,
            DEFAULT_TRANSPORT_RECOVERY_ATTEMPTS,
            minimum=1,
        ),
    )
    transport_recovery_seconds = _env_int(
        TRANSPORT_RECOVERY_SECONDS_ENV,
        DEFAULT_TRANSPORT_RECOVERY_SECONDS,
        minimum=0,
    )
    transport_recovery_started_at: float | None = None
    attempt = 1
    while attempt <= attempt_limit:
        started = time.perf_counter()
        diagnostics_request_id: int | None = None
        slot_acquired = False
        try:
            if diagnostics is not None:
                diagnostics.acquire_request_slot()
                slot_acquired = True
                diagnostics_request_id = diagnostics.record_request_start(
                    stage=request_stage,
                    request_label=request_label,
                    timeout_s=timeout,
                    attempt=attempt,
                )
            _prewarm_dns(base_url, request_label=request_label)
            if diagnostics is not None and diagnostics_request_id is not None:
                try:
                    diagnostics.record_request_dispatch(
                        diagnostics_request_id,
                        request_key=_request_journal_key(base_url=base_url, body=body),
                    )
                except BaseException:  # a request must never leave without its durable dispatch record
                    elapsed_ms = int(round((time.perf_counter() - started) * 1000))
                    if slot_acquired:
                        diagnostics.release_request_slot(
                            success=False,
                            elapsed_ms=elapsed_ms,
                            error_class="RequestJournalError",
                        )
                        slot_acquired = False
                    diagnostics.record_request_end(
                        diagnostics_request_id,
                        success=False,
                        elapsed_ms=elapsed_ms,
                        error_class="RequestJournalError",
                    )
                    diagnostics_request_id = None
                    raise
            if request_label:
                print(
                    f"{request_label}: http attempt {attempt}/{attempt_limit} -> {model} {chat_completions_url(base_url)} timeout={timeout}s stream={use_stream}",
                    flush=True,
                )
            response = get_session().post(
                chat_completions_url(base_url),
                headers=build_headers(api_key),
                json=body,
                timeout=timeout,
                stream=use_stream,
            )
            _raise_for_status_with_context(
                response,
                model=model,
                messages=messages,
                body=body,
                use_stream=use_stream,
            )
            if use_stream:
                content, usage = _read_streaming_chat_content(response)
                if not content.strip():
                    raise ValueError("Stream response did not contain any content.")
            else:
                data: dict[str, Any] = response.json()
                content = data["choices"][0]["message"]["content"]
                usage = data.get("usage")
            if diagnostics is not None and isinstance(usage, dict):
                diagnostics.record_token_usage(usage)
            if request_label:
                elapsed = time.perf_counter() - started
                print(f"{request_label}: http ok in {elapsed:.2f}s", flush=True)
            if diagnostics is not None and slot_acquired:
                diagnostics.release_request_slot(
                    success=True,
                    elapsed_ms=int(round((time.perf_counter() - started) * 1000)),
                )
                slot_acquired = False
            if diagnostics is not None and diagnostics_request_id is not None:
                diagnostics.record_request_end(
                    diagnostics_request_id,
                    success=True,
                    elapsed_ms=int(round((time.perf_counter() - started) * 1000)),
                    journal_outcome="succeeded",
                )
            return content
        except (requests.RequestException, ValueError, KeyError, json.JSONDecodeError, socket.gaierror) as exc:
            last_error = exc
            elapsed = time.perf_counter() - started
            status_code = exc.response.status_code if isinstance(exc, requests.HTTPError) and exc.response is not None else None
            if diagnostics is not None and slot_acquired:
                diagnostics.release_request_slot(
                    success=False,
                    elapsed_ms=int(round(elapsed * 1000)),
                    status_code=status_code,
                    error_class=type(exc).__name__,
                )
                slot_acquired = False
            if diagnostics is not None and diagnostics_request_id is not None:
                diagnostics.record_request_end(
                    diagnostics_request_id,
                    success=False,
                    elapsed_ms=int(round(elapsed * 1000)),
                    status_code=status_code,
                    error_class=type(exc).__name__,
                    journal_outcome=_request_journal_outcome(exc),
                )
            if request_label:
                print(
                    f"{request_label}: http failed attempt {attempt}/{attempt_limit} after {elapsed:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if (
                not attempted_schema_fallback
                and _supports_response_schema_fallback(active_response_format)
                and isinstance(exc, requests.HTTPError)
                and exc.response is not None
                and exc.response.status_code == 400
            ):
                attempted_schema_fallback = True
                active_response_format = _fallback_response_format(active_response_format)
                if active_response_format is None:
                    body.pop("response_format", None)
                else:
                    body["response_format"] = active_response_format
                if request_label:
                    print(f"{request_label}: response_format fallback json_schema -> json_object after 400", flush=True)
                continue
            dns_failure = is_dns_resolution_error(exc)
            if dns_failure and attempt_limit < dns_retry_limit:
                attempt_limit = dns_retry_limit
            retryable_transport = _is_retryable_http_error(exc) and is_transport_error(exc)
            if retryable_transport and transport_recovery_seconds > 0:
                if transport_recovery_started_at is None:
                    transport_recovery_started_at = time.perf_counter()
                recovery_elapsed = time.perf_counter() - transport_recovery_started_at
                if (
                    attempt < transport_recovery_attempt_limit
                    and recovery_elapsed < transport_recovery_seconds
                ):
                    attempt_limit = max(attempt_limit, attempt + 1)
            if attempt >= attempt_limit or not _is_retryable_http_error(exc):
                raise
            if _should_drop_session_after_error(exc):
                _drop_session(_request_session_key())
            if dns_failure:
                transport.clear_dns_cache_for_base_url(base_url)
            delay_secs, delay_kind = _retry_after_delay(exc, attempt)
            if status_code == 429:
                accumulated_rate_limit_wait += delay_secs
                if accumulated_rate_limit_wait > HTTP_RATE_LIMIT_WAIT_MAX_SECS:
                    raise requests.HTTPError(
                        f"rate-limit wait budget exceeded ({accumulated_rate_limit_wait}s > {HTTP_RATE_LIMIT_WAIT_MAX_SECS}s)",
                        response=exc.response if isinstance(exc, requests.HTTPError) else None,
                    ) from exc
            if request_label:
                print(
                    f"{request_label}: retrying in {delay_secs:.2f}s ({delay_kind})",
                    flush=True,
                )
            time.sleep(delay_secs)
        attempt += 1

    if last_error is not None:
        raise last_error
    raise RuntimeError("Chat completion failed without an exception.")


def translate_batch(
    batch: list[dict],
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    mode: str = "fast",
) -> dict[str, str]:
    from retainpdf_pipeline.translate.llm.shared.orchestration.retrying_translator import translate_batch as _translate_batch

    return _translate_batch(batch, api_key=api_key, model=model, base_url=base_url, mode=mode)


def get_api_key(explicit_api_key: str = "", env_var: str = DEFAULT_API_KEY_ENV, required: bool = True) -> str:
    from retainpdf_pipeline.translate.llm.shared.executor_context import execution_enabled
    if execution_enabled():
        return ""
    api_key = get_secret(
        explicit_value=explicit_api_key,
        env_var=env_var,
        env_file_name=DEFAULT_API_KEY_FILE,
    )
    if required and not api_key:
        raise RuntimeError(f"Missing API key. Set {env_var}, scripts/.env/{DEFAULT_API_KEY_FILE}, or pass --api-key.")
    return api_key
