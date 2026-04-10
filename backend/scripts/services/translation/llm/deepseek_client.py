from __future__ import annotations
import json
import os
import re
import threading
import time
from typing import Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from foundation.shared.prompt_loader import load_prompt
from foundation.shared.local_env import get_secret
from services.translation.diagnostics import get_active_translation_run_diagnostics
from services.translation.diagnostics import infer_stage_from_request_label
from services.translation.llm.decision_hints import build_decision_hints
from services.translation.llm.style_hints import structure_style_hint


DEFAULT_BASE_URL = "https://api.deepseek.com/v1"
DEFAULT_API_KEY_ENV = "DEEPSEEK_API_KEY"
DEFAULT_API_KEY_FILE = "deepseek.env"
TRUST_ENV_PROXY_ENV = "PDF_TRANSLATOR_TRUST_ENV_PROXY"
STREAM_RESPONSES_ENV = "PDF_TRANSLATOR_DEEPSEEK_STREAM"
_THREAD_LOCAL = threading.local()
HTTP_RETRY_ATTEMPTS = 8
HTTP_RETRY_BACKOFF_MAX_SECS = 20
_JSON_QUOTE_TRANSLATION = str.maketrans(
    {
        "“": '"',
        "”": '"',
        "„": '"',
        "‟": '"',
        "‘": '"',
        "’": '"',
        "‚": '"',
        "‛": '"',
        "：": ":",
    }
)
_JSON_KEY_PREFIX_RE = re.compile(r'^\s*"translations"\s*:', re.DOTALL)
_TAGGED_ITEM_BLOCK_RE = re.compile(
    r"<<<ITEM\s+item_id=(?P<item_id>[^\s>]+)(?:\s+decision=(?P<decision>[A-Za-z_-]+))?\s*>>>\s*"
    r"(?P<content>.*?)"
    r"\s*<<<END>>>",
    re.DOTALL,
)
_JSON_ONLY_INSTRUCTION = 'Return only valid JSON with the schema {"translations":[{"item_id":"...","translated_text":"..."}]}.'


def _build_translation_system_prompt(
    *,
    domain_guidance: str = "",
    mode: str = "fast",
    response_style: str = "tagged",
    include_sci_decision: bool = True,
) -> str:
    system_prompt = load_prompt("translation_system.txt")
    if response_style != "json":
        system_prompt = system_prompt.replace(_JSON_ONLY_INSTRUCTION, "").strip()
    if domain_guidance.strip():
        system_prompt = f"{system_prompt}\n\nDocument-specific translation guidance:\n{domain_guidance.strip()}"
    if mode == "sci" and include_sci_decision:
        system_prompt = f"{system_prompt}\n\n{load_prompt('translation_sci_decision.txt')}"
    return system_prompt


def build_messages(batch: list[dict], domain_guidance: str = "", mode: str = "fast") -> list[dict[str, str]]:
    system_prompt = _build_translation_system_prompt(
        domain_guidance=domain_guidance,
        mode=mode,
        response_style="tagged",
    )
    if mode != "sci":
        system_prompt = (
            f"{system_prompt}\n\n"
            "Return one tagged block per item and do not return JSON or markdown.\n"
            "Use this exact format:\n"
            "<<<ITEM item_id=ITEM_ID>>>\n"
            "translated text\n"
            "<<<END>>>\n"
            "Output one block for every requested item_id."
        )
    groups: dict[str, dict[str, Any]] = {}
    items_payload = []
    for item in batch:
        group_id = item.get("continuation_group", "")
        item_payload = {
            "item_id": item["item_id"],
            "source_text": item["protected_source_text"],
        }
        style_hint = structure_style_hint(item.get("metadata", {}) or {})
        if style_hint:
            item_payload["style_hint"] = style_hint
        if mode == "sci":
            item_payload["decision_hints"] = build_decision_hints(item)
        if group_id:
            item_payload["continuation_group"] = group_id
            if item.get("continuation_prev_text"):
                item_payload["context_before"] = item["continuation_prev_text"]
            if item.get("continuation_next_text"):
                item_payload["context_after"] = item["continuation_next_text"]
            group = groups.setdefault(group_id, {"group_id": group_id, "item_ids": [], "combined_source_text": []})
            group["item_ids"].append(item["item_id"])
            group["combined_source_text"].append(item["protected_source_text"])
        items_payload.append(item_payload)
    user_payload = {
        "task": load_prompt("translation_task.txt"),
        "items": items_payload,
    }
    if groups:
        user_payload["continuation_groups"] = [
            {
                "group_id": group["group_id"],
                "item_ids": group["item_ids"],
                "combined_source_text": " ".join(group["combined_source_text"]),
            }
            for group in groups.values()
        ]
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
    ]


def build_single_item_fallback_messages(
    item: dict,
    domain_guidance: str = "",
    mode: str = "fast",
    structured_decision: bool = False,
) -> list[dict[str, str]]:
    if mode == "sci" and structured_decision:
        system_prompt = _build_translation_system_prompt(
            domain_guidance=domain_guidance,
            mode=mode,
            response_style="tagged",
        )
        user_prompt = json.dumps(
            {
                "task": load_prompt("translation_task.txt"),
                "items": [
                    {
                        "item_id": item["item_id"],
                        "source_text": item["protected_source_text"],
                        **(
                            {"style_hint": structure_style_hint(item.get("metadata", {}) or {})}
                            if structure_style_hint(item.get("metadata", {}) or {})
                            else {}
                        ),
                        "decision_hints": build_decision_hints(item),
                    }
                ],
            },
            ensure_ascii=False,
        )
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
    system_prompt = _build_translation_system_prompt(
        domain_guidance=domain_guidance,
        mode=mode,
        response_style="plain_text",
        include_sci_decision=False,
    )
    fallback_system = (
        f"{system_prompt}\n"
        "You are translating exactly one item.\n"
        "Return only the translated_text as plain text.\n"
        "Do not return JSON, markdown, code fences, labels, or explanations."
    )
    user_payload: dict[str, Any] = {
        "task": load_prompt("translation_task.txt"),
        "item": {
            "item_id": item["item_id"],
            "source_text": item["protected_source_text"],
        },
    }
    style_hint = structure_style_hint(item.get("metadata", {}) or {})
    if style_hint:
        user_payload["item"]["style_hint"] = style_hint
    if item.get("continuation_prev_text"):
        user_payload["item"]["context_before"] = item["continuation_prev_text"]
    if item.get("continuation_next_text"):
        user_payload["item"]["context_after"] = item["continuation_next_text"]
    if item.get("continuation_group"):
        user_payload["item"]["continuation_group"] = item["continuation_group"]
    user_prompt = json.dumps(user_payload, ensure_ascii=False)
    return [
        {"role": "system", "content": fallback_system},
        {"role": "user", "content": user_prompt},
    ]


def extract_json_text(content: str) -> str:
    text = content.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    text = _normalize_loose_json_text(text)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("Model response does not contain a JSON object.")
    return text[start : end + 1]


def extract_single_item_translation_text(content: str, item_id: str) -> str:
    text = (content or "").strip()
    if not text:
        return ""

    tagged_matches = list(_TAGGED_ITEM_BLOCK_RE.finditer(text))
    if tagged_matches:
        for match in tagged_matches:
            if (match.group("item_id") or "").strip() == item_id:
                return (match.group("content") or "").strip()
        if len(tagged_matches) == 1:
            return (tagged_matches[0].group("content") or "").strip()

    try:
        payload = json.loads(extract_json_text(text))
    except Exception:
        return text

    translations = payload.get("translations", [])
    if not isinstance(translations, list):
        return text
    for item in translations:
        if str(item.get("item_id", "") or "").strip() == item_id:
            return str(item.get("translated_text", "") or "").strip()
    if len(translations) == 1:
        return str(translations[0].get("translated_text", "") or "").strip()
    return text


def _normalize_loose_json_text(text: str) -> str:
    normalized = (text or "").strip().translate(_JSON_QUOTE_TRANSLATION).strip()
    if _JSON_KEY_PREFIX_RE.match(normalized):
        normalized = "{" + normalized + "}"
    return normalized


def normalize_base_url(base_url: str) -> str:
    normalized = (base_url or DEFAULT_BASE_URL).strip().rstrip("/")
    if normalized.endswith("/chat/completions"):
        normalized = normalized[: -len("/chat/completions")]
    return normalized


def chat_completions_url(base_url: str) -> str:
    return f"{normalize_base_url(base_url)}/chat/completions"


def build_headers(api_key: str) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if api_key.strip():
        headers["Authorization"] = f"Bearer {api_key.strip()}"
    return headers


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
    value = os.environ.get(TRUST_ENV_PROXY_ENV, "")
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _build_session() -> requests.Session:
    session = requests.Session()
    session.trust_env = should_trust_env_proxy()
    if not session.trust_env:
        session.proxies.clear()
    diagnostics = get_active_translation_run_diagnostics()
    pool_size = 10
    if diagnostics is not None and diagnostics.provider_family == "deepseek_official":
        pool_size = min(256, max(32, int(diagnostics.configured_workers)))
    adapter = HTTPAdapter(
        pool_connections=pool_size,
        pool_maxsize=pool_size,
        max_retries=Retry(
            total=0,
            connect=0,
            read=0,
            redirect=0,
            status=0,
            backoff_factor=0,
        )
    )
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


def _drop_session(session_key: str) -> None:
    session = getattr(_THREAD_LOCAL, session_key, None)
    if session is not None:
        try:
            session.close()
        except Exception:
            pass
        setattr(_THREAD_LOCAL, session_key, None)


def get_session() -> requests.Session:
    session_key = "session_trust_env" if should_trust_env_proxy() else "session_direct"
    session = getattr(_THREAD_LOCAL, session_key, None)
    if session is None:
        session = _build_session()
        setattr(_THREAD_LOCAL, session_key, session)
    return session


def _request_session_key() -> str:
    return "session_trust_env" if should_trust_env_proxy() else "session_direct"


def _is_retryable_http_error(exc: Exception) -> bool:
    if isinstance(exc, (ValueError, KeyError, json.JSONDecodeError)):
        return False
    text = str(exc).lower()
    retry_markers = (
        "temporary failure in name resolution",
        "name resolution",
        "failed to resolve",
        "max retries exceeded",
        "connection aborted",
        "connection reset",
        "connection refused",
        "connect timeout",
        "read timeout",
        "timed out",
        "server disconnected",
        "remote end closed connection",
        "service unavailable",
        "bad gateway",
        "gateway timeout",
        "too many requests",
    )
    if any(marker in text for marker in retry_markers):
        return True
    if isinstance(exc, requests.HTTPError) and exc.response is not None:
        return exc.response.status_code in {408, 429, 500, 502, 503, 504}
    if isinstance(exc, requests.RequestException):
        return True
    return False


def _retry_delay(attempt: int) -> int:
    return min(HTTP_RETRY_BACKOFF_MAX_SECS, 2 * attempt)


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
            reasoning_content = delta.get("reasoning_content")
            if isinstance(reasoning_content, str) and reasoning_content:
                chunks.append(reasoning_content)
            continue
        message = choice.get("message")
        if isinstance(message, dict):
            content = message.get("content")
            if isinstance(content, str) and content:
                chunks.append(content)
    return "".join(chunks)


def _read_streaming_chat_content(response: requests.Response) -> str:
    chunks: list[str] = []
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
    return "".join(chunks)


def request_chat_content(
    messages: list[dict[str, str]],
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = DEFAULT_BASE_URL,
    temperature: float = 0.2,
    response_format: dict[str, str] | None = None,
    timeout: int = 120,
    request_label: str = "",
) -> str:
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
    body: dict[str, Any] = {
        "model": model,
        "temperature": temperature,
        "messages": messages,
    }
    use_stream = should_use_stream_responses()
    if use_stream:
        body["stream"] = True
    if active_response_format is not None:
        body["response_format"] = active_response_format

    for attempt in range(1, HTTP_RETRY_ATTEMPTS + 1):
        started = time.perf_counter()
        diagnostics_request_id: int | None = None
        try:
            if diagnostics is not None:
                diagnostics.acquire_request_slot()
                diagnostics_request_id = diagnostics.record_request_start(
                    stage=request_stage,
                    request_label=request_label,
                    timeout_s=timeout,
                    attempt=attempt,
                )
            if request_label:
                print(
                    f"{request_label}: http attempt {attempt}/{HTTP_RETRY_ATTEMPTS} -> {model} {chat_completions_url(base_url)} timeout={timeout}s stream={use_stream}",
                    flush=True,
                )
            response = get_session().post(
                chat_completions_url(base_url),
                headers=build_headers(api_key),
                json=body,
                timeout=timeout,
                stream=use_stream,
            )
            response.raise_for_status()
            if use_stream:
                content = _read_streaming_chat_content(response)
                if not content.strip():
                    raise ValueError("Stream response did not contain any content.")
            else:
                data: dict[str, Any] = response.json()
                content = data["choices"][0]["message"]["content"]
            if request_label:
                elapsed = time.perf_counter() - started
                print(f"{request_label}: http ok in {elapsed:.2f}s", flush=True)
            if diagnostics is not None and diagnostics_request_id is not None:
                diagnostics.record_request_end(
                    diagnostics_request_id,
                    success=True,
                    elapsed_ms=int(round((time.perf_counter() - started) * 1000)),
                )
                diagnostics.release_request_slot(
                    success=True,
                    elapsed_ms=int(round((time.perf_counter() - started) * 1000)),
                )
            return content
        except (requests.RequestException, ValueError, KeyError, json.JSONDecodeError) as exc:
            last_error = exc
            elapsed = time.perf_counter() - started
            status_code = exc.response.status_code if isinstance(exc, requests.HTTPError) and exc.response is not None else None
            if diagnostics is not None and diagnostics_request_id is not None:
                diagnostics.record_request_end(
                    diagnostics_request_id,
                    success=False,
                    elapsed_ms=int(round(elapsed * 1000)),
                    status_code=status_code,
                    error_class=type(exc).__name__,
                )
                diagnostics.release_request_slot(
                    success=False,
                    elapsed_ms=int(round(elapsed * 1000)),
                    status_code=status_code,
                    error_class=type(exc).__name__,
                )
            if request_label:
                print(
                    f"{request_label}: http failed attempt {attempt}/{HTTP_RETRY_ATTEMPTS} after {elapsed:.2f}s: {type(exc).__name__}: {exc}",
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
            if attempt >= HTTP_RETRY_ATTEMPTS or not _is_retryable_http_error(exc):
                raise
            _drop_session(_request_session_key())
            delay_secs = _retry_delay(attempt)
            if request_label:
                print(
                    f"{request_label}: retrying in {delay_secs}s",
                    flush=True,
                )
            time.sleep(delay_secs)

    if last_error is not None:
        raise last_error
    raise RuntimeError("Chat completion failed without an exception.")


def translate_batch(
    batch: list[dict],
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = DEFAULT_BASE_URL,
    mode: str = "fast",
) -> dict[str, str]:
    from .retrying_translator import translate_batch as _translate_batch

    return _translate_batch(batch, api_key=api_key, model=model, base_url=base_url, mode=mode)


def get_api_key(explicit_api_key: str = "", env_var: str = DEFAULT_API_KEY_ENV, required: bool = True) -> str:
    api_key = get_secret(
        explicit_value=explicit_api_key,
        env_var=env_var,
        env_file_name=DEFAULT_API_KEY_FILE,
    )
    if required and not api_key:
        raise RuntimeError(f"Missing API key. Set {env_var}, scripts/.env/{DEFAULT_API_KEY_FILE}, or pass --api-key.")
    return api_key
