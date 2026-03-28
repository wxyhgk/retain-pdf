from __future__ import annotations

import hashlib
import json
import os
import threading
from pathlib import Path

from common.prompt_loader import load_prompt
from config import paths

from .deepseek_client import extract_single_item_translation_text
from .deepseek_client import normalize_base_url


_PROMPT_HASH = ""
_CACHE_LOCK = threading.Lock()
FORMULA_SEGMENT_STRATEGY_VERSION = "formula_segments_v2"
PLAIN_TEXT_STRATEGY_VERSION = "plain_text_v1"


def _prompt_hash(mode: str = "fast") -> str:
    global _PROMPT_HASH
    cache_key = mode.strip() or "fast"
    if _PROMPT_HASH and cache_key == "fast":
        return _PROMPT_HASH
    digest = hashlib.sha256()
    digest.update(load_prompt("translation_system.txt").encode("utf-8"))
    digest.update(b"\n---\n")
    digest.update(load_prompt("translation_task.txt").encode("utf-8"))
    if cache_key == "sci":
        digest.update(b"\n---\n")
        digest.update(b"SCI_LOCAL_DECISION_PLAIN_TEXT_V1")
    result = digest.hexdigest()
    if cache_key == "fast":
        _PROMPT_HASH = result
    return result


def _unit_source_text(item: dict) -> str:
    return (
        item.get("translation_unit_protected_source_text")
        or item.get("protected_source_text")
        or item.get("source_text")
        or ""
    )


def _strategy_signature(item: dict) -> str:
    source_text = _unit_source_text(item)
    if "[[FORMULA_" in source_text:
        return FORMULA_SEGMENT_STRATEGY_VERSION
    return PLAIN_TEXT_STRATEGY_VERSION


def cache_key_for_item(
    item: dict,
    *,
    model: str,
    base_url: str,
    domain_guidance: str = "",
    mode: str = "fast",
) -> str:
    payload = {
        "model": model.strip(),
        "base_url": normalize_base_url(base_url),
        "domain_guidance": (domain_guidance or "").strip(),
        "mode": mode.strip() or "fast",
        "prompt_hash": _prompt_hash(mode=mode),
        "strategy_signature": _strategy_signature(item),
        "source_text": _unit_source_text(item),
    }
    body = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def _cache_path(cache_key: str) -> Path:
    return paths.TRANSLATION_UNIT_CACHE_DIR / cache_key[:2] / f"{cache_key}.json"


def load_cached_translation(
    item: dict,
    *,
    model: str,
    base_url: str,
    domain_guidance: str = "",
    mode: str = "fast",
) -> dict[str, str]:
    cache_key = cache_key_for_item(
        item,
        model=model,
        base_url=base_url,
        domain_guidance=domain_guidance,
        mode=mode,
    )
    path = _cache_path(cache_key)
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    decision = str(payload.get("decision", "translate") or "translate").strip() or "translate"
    raw_translated_text = str(payload.get("translated_text", "") or "").strip()
    translated_text = extract_single_item_translation_text(raw_translated_text, str(item.get("item_id", "") or ""))
    if translated_text != raw_translated_text:
        healed_payload = {
            "cache_key": cache_key,
            "decision": decision,
            "translated_text": translated_text,
        }
        temp_path = path.with_name(f"{path.name}.tmp-{os.getpid()}-{threading.get_ident()}")
        with _CACHE_LOCK:
            temp_path.write_text(json.dumps(healed_payload, ensure_ascii=False), encoding="utf-8")
            temp_path.replace(path)
    return {
        "decision": decision,
        "translated_text": translated_text,
    }


def store_cached_translation(
    item: dict,
    translation_result: dict[str, str],
    *,
    model: str,
    base_url: str,
    domain_guidance: str = "",
    mode: str = "fast",
) -> None:
    decision = str(translation_result.get("decision", "translate") or "translate").strip() or "translate"
    translated_text = str(translation_result.get("translated_text", "") or "").strip()
    translated_text = extract_single_item_translation_text(translated_text, str(item.get("item_id", "") or ""))
    if not translated_text and decision != "keep_origin":
        return
    cache_key = cache_key_for_item(
        item,
        model=model,
        base_url=base_url,
        domain_guidance=domain_guidance,
        mode=mode,
    )
    path = _cache_path(cache_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "cache_key": cache_key,
        "decision": decision,
        "translated_text": translated_text,
    }
    temp_path = path.with_name(f"{path.name}.tmp-{os.getpid()}-{threading.get_ident()}")
    with _CACHE_LOCK:
        temp_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        temp_path.replace(path)


def split_cached_batch(
    batch: list[dict],
    *,
    model: str,
    base_url: str,
    domain_guidance: str = "",
    mode: str = "fast",
) -> tuple[dict[str, dict[str, str]], list[dict]]:
    cached: dict[str, dict[str, str]] = {}
    missing: list[dict] = []
    for item in batch:
        cached_result = load_cached_translation(
            item,
            model=model,
            base_url=base_url,
            domain_guidance=domain_guidance,
            mode=mode,
        )
        if cached_result:
            cached[item["item_id"]] = cached_result
        else:
            missing.append(item)
    return cached, missing


def store_cached_batch(
    batch: list[dict],
    translated: dict[str, dict[str, str]],
    *,
    model: str,
    base_url: str,
    domain_guidance: str = "",
    mode: str = "fast",
) -> None:
    for item in batch:
        item_id = item.get("item_id", "")
        translated_result = translated.get(item_id, {})
        if not translated_result:
            continue
        store_cached_translation(
            item,
            translated_result,
            model=model,
            base_url=base_url,
            domain_guidance=domain_guidance,
            mode=mode,
        )
