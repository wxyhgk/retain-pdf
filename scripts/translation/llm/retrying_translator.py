import re
import json
import time

from .cache import split_cached_batch
from .cache import store_cached_batch
from .deepseek_client import build_messages
from .deepseek_client import build_single_item_fallback_messages
from .deepseek_client import extract_json_text
from .deepseek_client import request_chat_content


PLACEHOLDER_RE = re.compile(r"\[\[FORMULA_\d+]]")
EN_WORD_RE = re.compile(r"[A-Za-z]+(?:[-'][A-Za-z]+)?")


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


def _placeholders(text: str) -> set[str]:
    return set(PLACEHOLDER_RE.findall(text or ""))


def _strip_placeholders(text: str) -> str:
    return PLACEHOLDER_RE.sub(" ", text or "")


def _looks_like_english_prose(text: str) -> bool:
    cleaned = _strip_placeholders(text).strip()
    if not cleaned:
        return False
    if "@" in cleaned or "http://" in cleaned or "https://" in cleaned:
        return False
    words = EN_WORD_RE.findall(cleaned)
    if len(words) < 8:
        return False
    alpha_chars = sum(ch.isalpha() for ch in cleaned)
    if alpha_chars < 30:
        return False
    return True


def _validate_batch_result(batch: list[dict], result: dict[str, str]) -> None:
    expected_ids = {item["item_id"] for item in batch}
    actual_ids = set(result)
    if actual_ids != expected_ids:
        missing = sorted(expected_ids - actual_ids)
        extra = sorted(actual_ids - expected_ids)
        raise ValueError(f"translation item_id mismatch: missing={missing} extra={extra}")

    for item in batch:
        item_id = item["item_id"]
        source_text = item.get("protected_source_text", "")
        translated_text = result.get(item_id, "")
        source_placeholders = _placeholders(source_text)
        translated_placeholders = _placeholders(translated_text)
        if not translated_placeholders.issubset(source_placeholders):
            unexpected = sorted(translated_placeholders - source_placeholders)
            raise ValueError(f"{item_id}: unexpected placeholders in translation: {unexpected}")
        if translated_text.strip() == source_text.strip() and _looks_like_english_prose(source_text):
            raise ValueError(f"{item_id}: translation unchanged from English source")


def _translate_single_item_plain_text(
    item: dict,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
) -> dict[str, str]:
    content = request_chat_content(
        build_single_item_fallback_messages(item, domain_guidance=domain_guidance),
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
    domain_guidance: str = "",
) -> dict[str, str]:
    content = request_chat_content(
        build_messages(batch, domain_guidance=domain_guidance),
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.2,
        response_format={"type": "json_object"},
        timeout=120,
        request_label=request_label,
    )
    result = _parse_translation_payload(content)
    _validate_batch_result(batch, result)
    return result


def translate_batch(
    batch: list[dict],
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
) -> dict[str, str]:
    cached_result, uncached_batch = split_cached_batch(
        batch,
        model=model,
        base_url=base_url,
        domain_guidance=domain_guidance,
    )
    if request_label and cached_result:
        print(
            f"{request_label}: cache hit {len(cached_result)}/{len(batch)}",
            flush=True,
        )
    if not uncached_batch:
        return cached_result

    last_error: Exception | None = None
    for attempt in range(1, 5):
        started = time.perf_counter()
        try:
            if request_label:
                print(
                    f"{request_label}: translate attempt {attempt}/4 items={len(uncached_batch)}",
                    flush=True,
                )
            result = _translate_batch_once(
                uncached_batch,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=f"{request_label} req#{attempt}" if request_label else "",
                domain_guidance=domain_guidance,
            )
            store_cached_batch(
                uncached_batch,
                result,
                model=model,
                base_url=base_url,
                domain_guidance=domain_guidance,
            )
            merged = {**cached_result, **result}
            if request_label:
                elapsed = time.perf_counter() - started
                print(f"{request_label}: translate ok in {elapsed:.2f}s", flush=True)
            return merged
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            last_error = exc
            elapsed = time.perf_counter() - started
            if request_label:
                print(
                    f"{request_label}: parse failed attempt {attempt}/4 after {elapsed:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if attempt >= 4:
                if len(uncached_batch) > 1:
                    if request_label:
                        print(f"{request_label}: falling back to single-item translation", flush=True)
                    result: dict[str, str] = dict(cached_result)
                    for item_index, item in enumerate(uncached_batch, start=1):
                        single = translate_batch(
                            [item],
                            api_key=api_key,
                            model=model,
                            base_url=base_url,
                            request_label=f"{request_label} item {item_index}/{len(uncached_batch)} {item['item_id']}",
                            domain_guidance=domain_guidance,
                        )
                        result.update(single)
                    return result
                single = _translate_single_item_plain_text(
                    uncached_batch[0],
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    request_label=f"{request_label} plain-text fallback {uncached_batch[0]['item_id']}",
                    domain_guidance=domain_guidance,
                )
                store_cached_batch(
                    uncached_batch,
                    single,
                    model=model,
                    base_url=base_url,
                    domain_guidance=domain_guidance,
                )
                return {**cached_result, **single}
            time.sleep(min(8, 2 * attempt))

    if last_error is not None:
        raise last_error
    raise RuntimeError("Translation response parsing failed without an exception.")


def translate_items_to_text_map(
    items: list[dict],
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    domain_guidance: str = "",
) -> dict[str, str]:
    return translate_batch(items, api_key=api_key, model=model, base_url=base_url, domain_guidance=domain_guidance)
