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
KEEP_ORIGIN_LABEL = "keep_origin"
SHORT_FRAGMENT_RE = re.compile(r"^[A-Za-z][A-Za-z0-9._/-]{0,7}$")


class SuspiciousKeepOriginError(ValueError):
    def __init__(self, item_id: str, result: dict[str, dict[str, str]]) -> None:
        super().__init__(f"{item_id}: suspicious keep_origin for long English body text")
        self.item_id = item_id
        self.result = result


def _normalize_decision(value: str) -> str:
    normalized = (value or "translate").strip().lower().replace("-", "_")
    if normalized in {"keep", "skip", "no_translate", "keeporigin"}:
        return KEEP_ORIGIN_LABEL
    if normalized == KEEP_ORIGIN_LABEL:
        return KEEP_ORIGIN_LABEL
    return "translate"


def _result_entry(decision: str, translated_text: str) -> dict[str, str]:
    return {
        "decision": _normalize_decision(decision),
        "translated_text": (translated_text or "").strip(),
    }


def _parse_translation_payload(content: str) -> dict[str, dict[str, str]]:
    payload = json.loads(extract_json_text(content))
    translations = payload.get("translations", [])
    result: dict[str, dict[str, str]] = {}
    for item in translations:
        item_id = item.get("item_id")
        translated_text = item.get("translated_text", "")
        decision = item.get("decision", "translate")
        if item_id:
            result[item_id] = _result_entry(decision, translated_text)
    return result


def _placeholders(text: str) -> set[str]:
    return set(PLACEHOLDER_RE.findall(text or ""))


def _unit_source_text(item: dict) -> str:
    return (
        item.get("translation_unit_protected_source_text")
        or item.get("group_protected_source_text")
        or item.get("protected_source_text")
        or item.get("source_text")
        or ""
    )


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


def _looks_like_reference_entry(text: str) -> bool:
    cleaned = _strip_placeholders(text)
    if not re.search(r"\b(?:19|20)\d{2}\b", cleaned):
        return False
    if not re.search(r"\b(?:doi|journal|vol\.|volume|no\.|pp\.|pages?|proceedings|conference|springer|elsevier|acm|ieee)\b", cleaned, re.I):
        return False
    return cleaned.count(",") >= 2 or bool(re.search(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4}\b", cleaned))


def _looks_like_short_fragment(text: str) -> bool:
    stripped = text.strip()
    if not stripped or " " in stripped:
        return False
    return bool(SHORT_FRAGMENT_RE.fullmatch(stripped))


def _looks_like_garbled_fragment(text: str) -> bool:
    cleaned = _strip_placeholders(text).strip()
    if not cleaned:
        return True
    if "\ufffd" in cleaned:
        return True
    visible = [ch for ch in cleaned if not ch.isspace()]
    if not visible:
        return True
    weird = sum(1 for ch in visible if not (ch.isalnum() or ch in ".,;:!?()[]{}'\"-_/+*&%$#=@"))
    return weird / max(1, len(visible)) > 0.35


def _should_force_translate_body_text(item: dict) -> bool:
    source_text = _unit_source_text(item).strip()
    if not source_text:
        return False
    if _looks_like_garbled_fragment(source_text):
        return False
    if _looks_like_short_fragment(source_text):
        return False
    if str(item.get("block_type", "") or "") != "text":
        return False
    structure_role = str((item.get("metadata", {}) or {}).get("structure_role", "") or "")
    if structure_role and structure_role != "body":
        return False
    words = EN_WORD_RE.findall(_strip_placeholders(source_text))
    if item.get("continuation_group"):
        return len(words) >= 6 and _looks_like_english_prose(source_text)
    if item.get("block_type") == "text" and bool(item.get("formula_map") or item.get("translation_unit_formula_map")):
        return len(words) >= 5 and _looks_like_english_prose(source_text)
    return _looks_like_english_prose(source_text) and len(words) >= 8


def _should_reject_keep_origin(item: dict, decision: str) -> bool:
    if decision != KEEP_ORIGIN_LABEL:
        return False
    block_type = item.get("block_type")
    if block_type not in {"", None, "text"}:
        return False
    return _should_force_translate_body_text(item)


def _validate_batch_result(batch: list[dict], result: dict[str, dict[str, str]]) -> None:
    expected_ids = {item["item_id"] for item in batch}
    actual_ids = set(result)
    if actual_ids != expected_ids:
        missing = sorted(expected_ids - actual_ids)
        extra = sorted(actual_ids - expected_ids)
        raise ValueError(f"translation item_id mismatch: missing={missing} extra={extra}")

    for item in batch:
        item_id = item["item_id"]
        source_text = _unit_source_text(item)
        translated_result = result.get(item_id, {})
        translated_text = translated_result.get("translated_text", "")
        decision = _normalize_decision(translated_result.get("decision", "translate"))
        if _should_reject_keep_origin(item, decision):
            raise SuspiciousKeepOriginError(item_id, result)
        if decision == KEEP_ORIGIN_LABEL:
            continue
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
) -> dict[str, dict[str, str]]:
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
    return {item["item_id"]: _result_entry("translate", content.strip())}


def _translate_single_item_with_decision(
    item: dict,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
    mode: str = "fast",
) -> dict[str, dict[str, str]]:
    content = request_chat_content(
        build_single_item_fallback_messages(item, domain_guidance=domain_guidance, mode=mode),
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.0,
        response_format={"type": "json_object"},
        timeout=120,
        request_label=request_label,
    )
    result = _parse_translation_payload(content)
    _validate_batch_result([item], result)
    return result


def _translate_batch_once(
    batch: list[dict],
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
    mode: str = "fast",
) -> dict[str, dict[str, str]]:
    content = request_chat_content(
        build_messages(batch, domain_guidance=domain_guidance, mode=mode),
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
    mode: str = "fast",
) -> dict[str, dict[str, str]]:
    cached_result, uncached_batch = split_cached_batch(
        batch,
        model=model,
        base_url=base_url,
        domain_guidance=domain_guidance,
        mode=mode,
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
                mode=mode,
            )
            store_cached_batch(
                uncached_batch,
                result,
                model=model,
                base_url=base_url,
                domain_guidance=domain_guidance,
                mode=mode,
            )
            merged = {**cached_result, **result}
            if request_label:
                elapsed = time.perf_counter() - started
                print(f"{request_label}: translate ok in {elapsed:.2f}s", flush=True)
            return merged
        except SuspiciousKeepOriginError as exc:
            last_error = exc
            elapsed = time.perf_counter() - started
            if request_label:
                print(
                    f"{request_label}: suspicious keep_origin after {elapsed:.2f}s for {exc.item_id}; "
                    "downgrading only that item to single-item force-translate",
                    flush=True,
                )
            suspect_item = next((item for item in uncached_batch if item.get("item_id") == exc.item_id), None)
            if suspect_item is None:
                raise
            preserved = {item_id: value for item_id, value in exc.result.items() if item_id != exc.item_id}
            single = _translate_single_item_plain_text(
                suspect_item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=f"{request_label} forced-single {exc.item_id}",
                domain_guidance=domain_guidance,
            )
            merged = {**preserved, **single}
            store_cached_batch(
                uncached_batch,
                merged,
                model=model,
                base_url=base_url,
                domain_guidance=domain_guidance,
                mode=mode,
            )
            return {**cached_result, **merged}
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
                            mode=mode,
                        )
                        result.update(single)
                    return result
                if mode == "sci":
                    single = _translate_single_item_with_decision(
                        uncached_batch[0],
                        api_key=api_key,
                        model=model,
                        base_url=base_url,
                        request_label=f"{request_label} single-item fallback {uncached_batch[0]['item_id']}",
                        domain_guidance=domain_guidance,
                        mode=mode,
                    )
                else:
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
                    mode=mode,
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
    mode: str = "fast",
) -> dict[str, str]:
    translated = translate_batch(
        items,
        api_key=api_key,
        model=model,
        base_url=base_url,
        domain_guidance=domain_guidance,
        mode=mode,
    )
    return {item_id: result.get("translated_text", "") for item_id, result in translated.items()}
