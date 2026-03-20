import json
import os
import time
from typing import Any

import requests


DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"


def build_messages(batch: list[dict]) -> list[dict[str, str]]:
    system_prompt = (
        "You are a scientific translator. Translate English OCR text into concise, natural Simplified Chinese. "
        "Translate only the natural-language text. Keep placeholders like [[FORMULA_1]] exactly unchanged. "
        "Do not rewrite, remove, renumber, or explain placeholders. "
        "Keep code snippets, emails, person names, version strings, citation metadata, and technical abbreviations unchanged when appropriate. "
        "For bibliography or reference entries, keep author lists, journal names, years, volume/issue numbers, and page ranges unchanged; "
        "translate only the work title into Simplified Chinese and keep the citation order intact. "
        "Do not transliterate author names. "
        "Return only valid JSON with the schema "
        '{"translations":[{"item_id":"...","translated_text":"..."}]}.'
    )
    user_payload = {
        "task": "Translate each source_text into Simplified Chinese while preserving meaning and technical terms. Do not translate placeholders or code.",
        "items": [{"item_id": item["item_id"], "source_text": item["protected_source_text"]} for item in batch],
    }
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
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


def translate_batch(batch: list[dict], api_key: str, model: str = "deepseek-chat") -> dict[str, str]:
    last_error: Exception | None = None
    for attempt in range(1, 5):
        try:
            response = requests.post(
                DEEPSEEK_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "temperature": 0.2,
                    "messages": build_messages(batch),
                    "response_format": {"type": "json_object"},
                },
                timeout=120,
            )
            response.raise_for_status()
            data: dict[str, Any] = response.json()
            content = data["choices"][0]["message"]["content"]
            payload = json.loads(extract_json_text(content))
            break
        except (requests.RequestException, ValueError, KeyError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt >= 4:
                raise
            time.sleep(min(8, 2 * attempt))
    else:
        if last_error is not None:
            raise last_error
        raise RuntimeError("DeepSeek translation failed without an exception.")

    translations = payload.get("translations", [])
    result = {}
    for item in translations:
        item_id = item.get("item_id")
        translated_text = item.get("translated_text", "").strip()
        if item_id:
            result[item_id] = translated_text
    return result


def get_api_key(explicit_api_key: str = "") -> str:
    api_key = explicit_api_key or os.environ.get("DEEPSEEK_API_KEY", "")
    if not api_key:
        raise RuntimeError("Missing DeepSeek API key. Set DEEPSEEK_API_KEY or pass --api-key.")
    return api_key
