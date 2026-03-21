import json
import time

from translation.deepseek_client import build_messages
from translation.deepseek_client import build_single_item_fallback_messages
from translation.deepseek_client import extract_json_text
from translation.deepseek_client import request_chat_content


def _parse_translation_payload(content: str) -> dict[str, str]:
    payload = json.loads(extract_json_text(content))
    translations = payload.get("translations", [])
    result: dict[str, str] = {}
    for item in translations:
        item_id = item.get("item_id")
        translated_text = item.get("translated_text", "").strip()
        if item_id:
            result[item_id] = translated_text
    return result


def _translate_single_item_plain_text(
    item: dict,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
) -> dict[str, str]:
    content = request_chat_content(
        build_single_item_fallback_messages(item),
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.0,
        response_format=None,
        timeout=120,
        request_label=request_label,
    )
    return {item["item_id"]: content.strip()}


def _translate_batch_once(
    batch: list[dict],
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
) -> dict[str, str]:
    content = request_chat_content(
        build_messages(batch),
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.2,
        response_format={"type": "json_object"},
        timeout=120,
        request_label=request_label,
    )
    return _parse_translation_payload(content)


def translate_batch(
    batch: list[dict],
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
) -> dict[str, str]:
    last_error: Exception | None = None
    for attempt in range(1, 5):
        started = time.perf_counter()
        try:
            if request_label:
                print(
                    f"{request_label}: translate attempt {attempt}/4 items={len(batch)}",
                    flush=True,
                )
            result = _translate_batch_once(
                batch,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=f"{request_label} req#{attempt}" if request_label else "",
            )
            if request_label:
                elapsed = time.perf_counter() - started
                print(f"{request_label}: translate ok in {elapsed:.2f}s", flush=True)
            return result
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            last_error = exc
            elapsed = time.perf_counter() - started
            if request_label:
                print(
                    f"{request_label}: parse failed attempt {attempt}/4 after {elapsed:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if attempt >= 4:
                if len(batch) > 1:
                    if request_label:
                        print(f"{request_label}: falling back to single-item translation", flush=True)
                    result: dict[str, str] = {}
                    for item_index, item in enumerate(batch, start=1):
                        result.update(
                            translate_batch(
                                [item],
                                api_key=api_key,
                                model=model,
                                base_url=base_url,
                                request_label=f"{request_label} item {item_index}/{len(batch)} {item['item_id']}",
                            )
                        )
                    return result
                return _translate_single_item_plain_text(
                    batch[0],
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    request_label=f"{request_label} plain-text fallback {batch[0]['item_id']}",
                )
            time.sleep(min(8, 2 * attempt))

    if last_error is not None:
        raise last_error
    raise RuntimeError("Translation response parsing failed without an exception.")


def translate_items_to_text_map(
    items: list[dict],
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
) -> dict[str, str]:
    return translate_batch(items, api_key=api_key, model=model, base_url=base_url)
