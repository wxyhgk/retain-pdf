import json
import os
import threading
import time
from typing import Any

import requests

from common.prompt_loader import load_prompt


DEFAULT_BASE_URL = "https://api.deepseek.com/v1"
DEFAULT_API_KEY_ENV = "DEEPSEEK_API_KEY"
_THREAD_LOCAL = threading.local()


def build_messages(batch: list[dict], domain_guidance: str = "") -> list[dict[str, str]]:
    system_prompt = load_prompt("translation_system.txt")
    if domain_guidance.strip():
        system_prompt = f"{system_prompt}\n\nDocument-specific translation guidance:\n{domain_guidance.strip()}"
    groups: dict[str, dict[str, Any]] = {}
    items_payload = []
    for item in batch:
        group_id = item.get("continuation_group", "")
        item_payload = {
            "item_id": item["item_id"],
            "source_text": item["protected_source_text"],
        }
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


def build_single_item_fallback_messages(item: dict, domain_guidance: str = "") -> list[dict[str, str]]:
    system_prompt = load_prompt("translation_system.txt")
    if domain_guidance.strip():
        system_prompt = f"{system_prompt}\n\nDocument-specific translation guidance:\n{domain_guidance.strip()}"
    fallback_system = (
        f"{system_prompt}\n"
        "You are translating exactly one item.\n"
        "Return only the translated_text as plain text.\n"
        "Do not return JSON, markdown, code fences, labels, or explanations."
    )
    user_prompt = (
        f"{load_prompt('translation_task.txt')}\n\n"
        f"item_id: {item['item_id']}\n"
        f"source_text:\n{item['protected_source_text']}"
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
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("Model response does not contain a JSON object.")
    return text[start : end + 1]


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


def get_session() -> requests.Session:
    session = getattr(_THREAD_LOCAL, "session", None)
    if session is None:
        session = requests.Session()
        _THREAD_LOCAL.session = session
    return session


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
    body: dict[str, Any] = {
        "model": model,
        "temperature": temperature,
        "messages": messages,
    }
    if response_format is not None:
        body["response_format"] = response_format

    for attempt in range(1, 5):
        started = time.perf_counter()
        try:
            if request_label:
                print(
                    f"{request_label}: http attempt {attempt}/4 -> {model} {chat_completions_url(base_url)} timeout={timeout}s",
                    flush=True,
                )
            response = get_session().post(
                chat_completions_url(base_url),
                headers=build_headers(api_key),
                json=body,
                timeout=timeout,
            )
            response.raise_for_status()
            data: dict[str, Any] = response.json()
            if request_label:
                elapsed = time.perf_counter() - started
                print(f"{request_label}: http ok in {elapsed:.2f}s", flush=True)
            return data["choices"][0]["message"]["content"]
        except (requests.RequestException, ValueError, KeyError, json.JSONDecodeError) as exc:
            last_error = exc
            elapsed = time.perf_counter() - started
            if request_label:
                print(
                    f"{request_label}: http failed attempt {attempt}/4 after {elapsed:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if attempt >= 4:
                raise
            time.sleep(min(8, 2 * attempt))

    if last_error is not None:
        raise last_error
    raise RuntimeError("Chat completion failed without an exception.")


def translate_batch(
    batch: list[dict],
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = DEFAULT_BASE_URL,
) -> dict[str, str]:
    from .retrying_translator import translate_batch as _translate_batch

    return _translate_batch(batch, api_key=api_key, model=model, base_url=base_url)


def get_api_key(explicit_api_key: str = "", env_var: str = DEFAULT_API_KEY_ENV, required: bool = True) -> str:
    api_key = explicit_api_key or os.environ.get(env_var, "")
    if required and not api_key:
        raise RuntimeError(f"Missing API key. Set {env_var} or pass --api-key.")
    return api_key
