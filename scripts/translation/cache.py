from __future__ import annotations

import hashlib
import json
import os
import threading
from pathlib import Path

from common.config import TRANSLATION_UNIT_CACHE_DIR
from common.prompt_loader import load_prompt
from translation.deepseek_client import normalize_base_url


_PROMPT_HASH = ""
_CACHE_LOCK = threading.Lock()


def _prompt_hash() -> str:
    global _PROMPT_HASH
    if _PROMPT_HASH:
        return _PROMPT_HASH
    digest = hashlib.sha256()
    digest.update(load_prompt("translation_system.txt").encode("utf-8"))
    digest.update(b"\n---\n")
    digest.update(load_prompt("translation_task.txt").encode("utf-8"))
    _PROMPT_HASH = digest.hexdigest()
    return _PROMPT_HASH


def _unit_source_text(item: dict) -> str:
    return (
        item.get("translation_unit_protected_source_text")
        or item.get("protected_source_text")
        or ""
    )


def cache_key_for_item(
    item: dict,
    *,
    model: str,
    base_url: str,
    domain_guidance: str = "",
) -> str:
    payload = {
        "model": model.strip(),
        "base_url": normalize_base_url(base_url),
        "domain_guidance": (domain_guidance or "").strip(),
        "prompt_hash": _prompt_hash(),
        "source_text": _unit_source_text(item),
    }
    body = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def _cache_path(cache_key: str) -> Path:
    return TRANSLATION_UNIT_CACHE_DIR / cache_key[:2] / f"{cache_key}.json"


def load_cached_translation(
    item: dict,
    *,
    model: str,
    base_url: str,
    domain_guidance: str = "",
) -> str:
    cache_key = cache_key_for_item(item, model=model, base_url=base_url, domain_guidance=domain_guidance)
    path = _cache_path(cache_key)
    if not path.exists():
        return ""
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return ""
    return str(payload.get("translated_text", "") or "").strip()


def store_cached_translation(
    item: dict,
    translated_text: str,
    *,
    model: str,
    base_url: str,
    domain_guidance: str = "",
) -> None:
    translated_text = (translated_text or "").strip()
    if not translated_text:
        return
    cache_key = cache_key_for_item(item, model=model, base_url=base_url, domain_guidance=domain_guidance)
    path = _cache_path(cache_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "cache_key": cache_key,
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
) -> tuple[dict[str, str], list[dict]]:
    cached: dict[str, str] = {}
    missing: list[dict] = []
    for item in batch:
        translated_text = load_cached_translation(
            item,
            model=model,
            base_url=base_url,
            domain_guidance=domain_guidance,
        )
        if translated_text:
            cached[item["item_id"]] = translated_text
        else:
            missing.append(item)
    return cached, missing


def store_cached_batch(
    batch: list[dict],
    translated: dict[str, str],
    *,
    model: str,
    base_url: str,
    domain_guidance: str = "",
) -> None:
    for item in batch:
        item_id = item.get("item_id", "")
        translated_text = translated.get(item_id, "")
        if not translated_text:
            continue
        store_cached_translation(
            item,
            translated_text,
            model=model,
            base_url=base_url,
            domain_guidance=domain_guidance,
        )
