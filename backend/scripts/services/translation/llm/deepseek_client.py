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
HTTP_RETRY_ATTEMPTS = 2
HTTP_RETRY_BACKOFF_MAX_SECS = 20
HTTP_RATE_LIMIT_WAIT_MAX_SECS = 300
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
_CONTEXT_PLACEHOLDER_RE = re.compile(r"<[a-z]\d+-[0-9a-z]{3}/>|@@P\d+@@|\[\[FORMULA_\d+]]")
_JSON_ONLY_INSTRUCTION = 'Return only valid JSON with the schema {"translations":[{"item_id":"...","translated_text":"..."}]}.'
_TRANSPORT_RETRY_MARKERS = (
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
_TRANSPORT_STATUS_CODES = {408, 429, 500, 502, 503, 504}


def sanitize_prompt_context_text(text: str) -> str:
    sanitized = _CONTEXT_PLACEHOLDER_RE.sub(" ", str(text or ""))
    sanitized = re.sub(r"\s+", " ", sanitized).strip()
    return sanitized


def _item_math_mode(item: dict) -> str:
    return str(item.get("math_mode", "placeholder") or "placeholder").strip() or "placeholder"


def _direct_math_guidance() -> str:
    return (
        "当前启用 direct_typst 公式直出模式。\n"
        "请先理解整句语义，再直接输出中文译文。\n"
        "凡是语义上属于公式、变量、上下标、数学表达式、化学式、物理量符号、带上标或下标的单位与记号，请主动用 `$...$` 包裹。\n"
        "不要把裸露的 LaTeX 风格数学片段直接留在正文里。\n"
        "普通正文不要随意放进 `$...$`。\n"
        "如果 OCR 造成公式存在明显且局部的错误，例如空格错乱、括号缺失、花括号缺失、上下标脱落或命令被截断，你可以按语义做最小修复后再输出，使其可以正常渲染。\n"
        "不要补写缺失的正文内容，不要扩写原文，不要编造新的科学信息。\n"
        "不要输出占位符、JSON、标签、代码块或解释，只输出最终译文。"
    )


def _direct_typst_batch_user_prompt(
    batch: list[dict],
    *,
    mode: str,
) -> str:
    lines: list[str] = [load_prompt("translation_task.txt"), "", "Items:"]
    for item in batch:
        lines.append(f"<<<SOURCE item_id={item['item_id']}>>>")
        lines.append(str(item.get("protected_source_text", "") or ""))
        style_hint = structure_style_hint(item.get("metadata", {}) or {})
        if style_hint:
            lines.append(f"[style_hint] {style_hint}")
        if mode == "sci":
            decision_hints = build_decision_hints(item)
            if decision_hints:
                lines.append(f"[decision_hints] {decision_hints}")
        if item.get("continuation_group"):
            lines.append(f"[continuation_group] {item['continuation_group']}")
        if item.get("continuation_prev_text"):
            context_before = sanitize_prompt_context_text(item["continuation_prev_text"])
            if context_before:
                lines.append(f"[context_before] {context_before}")
        if item.get("continuation_next_text"):
            context_after = sanitize_prompt_context_text(item["continuation_next_text"])
            if context_after:
                lines.append(f"[context_after] {context_after}")
        lines.append("<<<END SOURCE>>>")
        lines.append("")
    return "\n".join(lines).strip()


def _direct_typst_single_user_prompt(
    item: dict,
    *,
    mode: str,
) -> str:
    lines: list[str] = [
        load_prompt("translation_task.txt"),
        "",
        f"<<<SOURCE item_id={item['item_id']}>>>",
        str(item.get("protected_source_text", "") or ""),
    ]
    style_hint = structure_style_hint(item.get("metadata", {}) or {})
    if style_hint:
        lines.append(f"[style_hint] {style_hint}")
    if mode == "sci":
        decision_hints = build_decision_hints(item)
        if decision_hints:
            lines.append(f"[decision_hints] {decision_hints}")
    if item.get("continuation_group"):
        lines.append(f"[continuation_group] {item['continuation_group']}")
    if item.get("continuation_prev_text"):
        context_before = sanitize_prompt_context_text(item["continuation_prev_text"])
        if context_before:
            lines.append(f"[context_before] {context_before}")
    if item.get("continuation_next_text"):
        context_after = sanitize_prompt_context_text(item["continuation_next_text"])
        if context_after:
            lines.append(f"[context_after] {context_after}")
    lines.append("<<<END SOURCE>>>")
    return "\n".join(lines).strip()


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


def build_messages(
    batch: list[dict],
    domain_guidance: str = "",
    mode: str = "fast",
    response_style: str = "tagged",
) -> list[dict[str, str]]:
    direct_typst_mode = any(_item_math_mode(item) == "direct_typst" for item in batch)
    system_prompt = _build_translation_system_prompt(
        domain_guidance=domain_guidance,
        mode=mode,
        response_style=response_style,
    )
    if response_style == "json":
        system_prompt = (
            f"{system_prompt}\n\n"
            "Return only JSON matching this shape:\n"
            '{"translations":[{"item_id":"ITEM_ID","translated_text":"translated text","decision":"translate"}]}.\n'
            "Output one object for every requested item_id. Do not include markdown, code fences, or explanations."
        )
    else:
        tagged_header = "<<<ITEM item_id=ITEM_ID decision=translate>>>" if mode == "sci" else "<<<ITEM item_id=ITEM_ID>>>"
        system_prompt = (
            f"{system_prompt}\n\n"
            "Return one tagged block per item and do not return JSON or markdown.\n"
            "Use this exact format:\n"
            f"{tagged_header}\n"
            "translated text\n"
            "<<<END>>>\n"
            "Output one block for every requested item_id."
        )
    if direct_typst_mode:
        system_prompt = f"{system_prompt}\n\n{_direct_math_guidance()}"
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
                context_before = sanitize_prompt_context_text(item["continuation_prev_text"])
                if context_before:
                    item_payload["context_before"] = context_before
            if item.get("continuation_next_text"):
                context_after = sanitize_prompt_context_text(item["continuation_next_text"])
                if context_after:
                    item_payload["context_after"] = context_after
            group = groups.setdefault(group_id, {"group_id": group_id, "item_ids": [], "combined_source_text": []})
            group["item_ids"].append(item["item_id"])
            group["combined_source_text"].append(sanitize_prompt_context_text(item["protected_source_text"]))
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
    user_content = (
        _direct_typst_batch_user_prompt(batch, mode=mode)
        if direct_typst_mode
        else json.dumps(user_payload, ensure_ascii=False)
    )
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]


def build_single_item_fallback_messages(
    item: dict,
    domain_guidance: str = "",
    mode: str = "fast",
    structured_decision: bool = False,
    response_style: str = "plain_text",
) -> list[dict[str, str]]:
    direct_typst_mode = _item_math_mode(item) == "direct_typst"
    if mode == "sci" and structured_decision:
        system_prompt = _build_translation_system_prompt(
            domain_guidance=domain_guidance,
            mode=mode,
            response_style="json" if response_style == "json" else "tagged",
        )
        if response_style == "json":
            system_prompt = (
                f"{system_prompt}\n\n"
                'Return only JSON matching {"decision":"translate","translated_text":"translated text"}. '
                "Do not include markdown, code fences, or explanations."
            )
        user_prompt = (
            _direct_typst_single_user_prompt(item, mode=mode)
            if direct_typst_mode
            else json.dumps(
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
        )
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
    system_prompt = _build_translation_system_prompt(
        domain_guidance=domain_guidance,
        mode=mode,
        response_style="json" if response_style == "json" else "plain_text",
        include_sci_decision=False,
    )
    if response_style == "json":
        fallback_system = (
            f"{system_prompt}\n"
            "You are translating exactly one item.\n"
            'Return only JSON matching {"translated_text":"translated text"}.\n'
            "Do not return markdown, code fences, labels, or explanations."
        )
    else:
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
    if direct_typst_mode:
        fallback_system = f"{fallback_system}\n{_direct_math_guidance()}"
    style_hint = structure_style_hint(item.get("metadata", {}) or {})
    if style_hint:
        user_payload["item"]["style_hint"] = style_hint
    if item.get("continuation_prev_text"):
        context_before = sanitize_prompt_context_text(item["continuation_prev_text"])
        if context_before:
            user_payload["item"]["context_before"] = context_before
    if item.get("continuation_next_text"):
        context_after = sanitize_prompt_context_text(item["continuation_next_text"])
        if context_after:
            user_payload["item"]["context_after"] = context_after
    if item.get("continuation_group"):
        user_payload["item"]["continuation_group"] = item["continuation_group"]
    user_prompt = (
        _direct_typst_single_user_prompt(item, mode=mode)
        if direct_typst_mode
        else json.dumps(user_payload, ensure_ascii=False)
    )
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

    if isinstance(payload, dict) and "translated_text" in payload:
        return unwrap_translation_shell(str(payload.get("translated_text", "") or "").strip(), item_id=item_id)

    translations = payload.get("translations", [])
    if not isinstance(translations, list):
        return text
    for item in translations:
        if str(item.get("item_id", "") or "").strip() == item_id:
            return unwrap_translation_shell(str(item.get("translated_text", "") or "").strip(), item_id=item_id)
    if len(translations) == 1:
        return unwrap_translation_shell(str(translations[0].get("translated_text", "") or "").strip(), item_id=item_id)
    return text


def unwrap_translation_shell(text: str, item_id: str = "") -> str:
    current = str(text or "").strip()
    for _ in range(3):
        if not current or "translated_text" not in current or "{" not in current:
            return current
        try:
            payload = json.loads(extract_json_text(current))
        except Exception:
            return current
        if isinstance(payload, dict):
            if "translated_text" in payload:
                next_text = str(payload.get("translated_text", "") or "").strip()
                if next_text == current:
                    return current
                current = next_text
                continue
            translations = payload.get("translations", [])
            if isinstance(translations, list):
                for item in translations:
                    if not isinstance(item, dict):
                        continue
                    if item_id and str(item.get("item_id", "") or "").strip() == item_id:
                        next_text = str(item.get("translated_text", "") or "").strip()
                        if next_text == current:
                            return current
                        current = next_text
                        break
                else:
                    if len(translations) != 1 or not isinstance(translations[0], dict):
                        return current
                    next_text = str(translations[0].get("translated_text", "") or "").strip()
                    if next_text == current:
                        return current
                    current = next_text
                continue
        return current
    return current


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


def _message_chars(messages: list[dict[str, str]]) -> int:
    total = 0
    for message in messages:
        if not isinstance(message, dict):
            continue
        total += len(str(message.get("content", "") or ""))
    return total


def _body_bytes(body: dict[str, Any]) -> int:
    return len(json.dumps(body, ensure_ascii=False).encode("utf-8"))


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
    raise requests.HTTPError(
        f"{status_code} Client Error: {reason} for url: {url} | "
        f"response_body={response_body} | "
        f"request_meta={_request_meta_summary(model=model, messages=messages, body=body, use_stream=use_stream)}",
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


def is_transport_error(exc: Exception) -> bool:
    if isinstance(exc, (ValueError, KeyError, json.JSONDecodeError)):
        return False
    if isinstance(exc, (requests.Timeout, requests.ConnectionError)):
        return True
    text = str(exc).lower()
    if any(marker in text for marker in _TRANSPORT_RETRY_MARKERS):
        return True
    if isinstance(exc, requests.HTTPError) and exc.response is not None:
        return exc.response.status_code in _TRANSPORT_STATUS_CODES
    return isinstance(exc, requests.RequestException)


def _is_retryable_http_error(exc: Exception) -> bool:
    return is_transport_error(exc)


def _retry_delay(attempt: int) -> int:
    return min(HTTP_RETRY_BACKOFF_MAX_SECS, 2 * attempt)


def _retry_after_delay(exc: Exception, attempt: int) -> tuple[int, str]:
    if isinstance(exc, requests.HTTPError) and exc.response is not None and exc.response.status_code == 429:
        header = str(exc.response.headers.get("Retry-After", "") or "").strip()
        if header.isdigit():
            return max(1, int(header)), "retry_after"
    return _retry_delay(attempt), "backoff"


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
    max_attempts: int | None = None,
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
    accumulated_rate_limit_wait = 0
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

    attempt_limit = max(1, int(max_attempts or HTTP_RETRY_ATTEMPTS))
    for attempt in range(1, attempt_limit + 1):
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
            if attempt >= attempt_limit or not _is_retryable_http_error(exc):
                raise
            _drop_session(_request_session_key())
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
                    f"{request_label}: retrying in {delay_secs}s ({delay_kind})",
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
