from __future__ import annotations

import hashlib
import json
import os
import re
import threading
import time
from pathlib import Path

from foundation.shared.prompt_loader import load_prompt
from foundation.config import paths

from services.translation.core.payload.parts.result_entries import with_sanitized_translation
from services.translation.llm.shared.provider_runtime import extract_single_item_translation_text
from services.translation.llm.shared.provider_runtime import normalize_base_url


# Cache writes need no process-wide lock: each writer uses a pid+thread-unique
# temp file and os.replace is atomic, so concurrent writers cannot corrupt an
# entry — the last replace simply wins.
_PROMPT_HASHES: dict[str, str] = {}
FORMULA_SEGMENT_STRATEGY_VERSION = "formula_segments_v2"
PLAIN_TEXT_STRATEGY_VERSION = "plain_text_v2"
TRANSLATION_PROTOCOL_VERSION = "translation_control_v5_no_reasoning_content"
TRANSLATION_POLICY_VERSION = "policy_hints_v2_memory_context_v1"
UNESCAPED_INLINE_DOLLAR_RE = re.compile(r"(?<!\\)\$")
TRANSLATION_PROMPT_FILES = (
    "translation_system.txt",
    "translation_system_plain_text.txt",
    "translation_task.txt",
    "translation_task_plain_text.txt",
    "translation_direct_typst_guidance.txt",
    "translation_output_json.txt",
    "translation_output_plain_text.txt",
    "translation_output_single_json.txt",
    "translation_output_tagged.txt",
)


def _prompt_hash(mode: str = "fast") -> str:
    cache_key = mode.strip() or "fast"
    cached = _PROMPT_HASHES.get(cache_key)
    if cached:
        return cached
    digest = hashlib.sha256()
    for prompt_name in TRANSLATION_PROMPT_FILES:
        digest.update(f"\n--- {prompt_name} ---\n".encode("utf-8"))
        digest.update(load_prompt(prompt_name).encode("utf-8"))
    if cache_key == "sci":
        digest.update(b"\n---\n")
        digest.update(b"SCI_LOCAL_DECISION_PLAIN_TEXT_V1")
    result = digest.hexdigest()
    _PROMPT_HASHES[cache_key] = result
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
    if "[[FORMULA_" in source_text or "<f" in source_text:
        return FORMULA_SEGMENT_STRATEGY_VERSION
    return PLAIN_TEXT_STRATEGY_VERSION


def _has_balanced_inline_math_delimiters(text: str) -> bool:
    return len(UNESCAPED_INLINE_DOLLAR_RE.findall(text or "")) % 2 == 0


def cache_key_for_item(
    item: dict,
    *,
    model: str,
    base_url: str,
    domain_guidance: str = "",
    mode: str = "fast",
    target_lang: str = "zh-CN",
    target_language_name: str = "简体中文",
) -> str:
    payload = {
        "model": model.strip(),
        "base_url": normalize_base_url(base_url),
        "domain_guidance": (domain_guidance or "").strip(),
        "mode": mode.strip() or "fast",
        "target_lang": (target_lang or "zh-CN").strip() or "zh-CN",
        "target_language_name": (target_language_name or "简体中文").strip() or "简体中文",
        "prompt_hash": _prompt_hash(mode=mode),
        "translation_protocol_version": TRANSLATION_PROTOCOL_VERSION,
        "translation_policy_version": TRANSLATION_POLICY_VERSION,
        "strategy_signature": _strategy_signature(item),
        "translation_style_hint": str(item.get("translation_style_hint", "") or "").strip(),
        "translation_structure_kind": str(item.get("translation_structure_kind", "") or "").strip(),
        "source_text": _unit_source_text(item),
    }
    body = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def _cache_path(cache_key: str) -> Path:
    return paths.TRANSLATION_UNIT_CACHE_DIR / cache_key[:2] / f"{cache_key}.json"


_ENSURED_SHARD_DIRS: set[str] = set()
_PRUNE_DONE = False
_PRUNE_LOCK = threading.Lock()
UNIT_CACHE_TTL_DAYS_ENV = "RETAIN_TRANSLATION_UNIT_CACHE_TTL_DAYS"
DEFAULT_UNIT_CACHE_TTL_DAYS = 90


def _ensure_shard_dir(path: Path) -> None:
    shard = str(path.parent)
    if shard in _ENSURED_SHARD_DIRS:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    _ENSURED_SHARD_DIRS.add(shard)


def _unit_cache_ttl_seconds() -> float:
    raw = str(os.environ.get(UNIT_CACHE_TTL_DAYS_ENV, "") or "").strip()
    try:
        days = float(raw) if raw else float(DEFAULT_UNIT_CACHE_TTL_DAYS)
    except ValueError:
        days = float(DEFAULT_UNIT_CACHE_TTL_DAYS)
    return days * 86400.0


def _prune_expired_cache_entries_once() -> None:
    # Nhớ tạm key Dấu vân tay với lời nhắc và phiên bản giao thức,Từ nhắc thay đổi các mục nhập thế hệ cũ tất cả trở thành
    # Một đứa trẻ mồ côi sẽ không bao giờ chết,Trước đây không có cơ chế tái chế、Tăng trưởng vô hạn。án mtime TTL
    # (ngầm thừa nhận 90 ngày,RETAIN_TRANSLATION_UNIT_CACHE_TTL_DAYS=0 Đóng)
    # Làm sạch tối đa một lần cho mỗi quy trình,Im lặng do lỗi——Đây là vệ sinh bộ nhớ cache,Không đúng。
    global _PRUNE_DONE
    with _PRUNE_LOCK:
        if _PRUNE_DONE:
            return
        _PRUNE_DONE = True
    ttl = _unit_cache_ttl_seconds()
    if ttl <= 0:
        return
    root = paths.TRANSLATION_UNIT_CACHE_DIR
    try:
        if not root.exists():
            return
        cutoff = time.time() - ttl
        removed = 0
        for shard in root.iterdir():
            if not shard.is_dir():
                continue
            for entry in shard.iterdir():
                try:
                    if entry.is_file() and entry.stat().st_mtime < cutoff:
                        entry.unlink()
                        removed += 1
                except OSError:
                    continue
        if removed:
            print(f"translation unit cache pruned: {removed} expired entries", flush=True)
    except Exception:
        return


def _sanitize_cached_translation_text(text: str) -> tuple[str, bool]:
    sanitized, metadata = with_sanitized_translation(str(text or "").strip(), {})
    return sanitized, bool(metadata)


def load_cached_translation(
    item: dict,
    *,
    model: str,
    base_url: str,
    domain_guidance: str = "",
    mode: str = "fast",
    target_lang: str = "zh-CN",
    target_language_name: str = "简体中文",
) -> dict[str, str]:
    cache_key = cache_key_for_item(
        item,
        model=model,
        base_url=base_url,
        domain_guidance=domain_guidance,
        mode=mode,
        target_lang=target_lang,
        target_language_name=target_language_name,
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
    translated_text, sanitized = _sanitize_cached_translation_text(translated_text)
    if str(item.get("math_mode", "") or "").strip() == "direct_typst" and translated_text and not _has_balanced_inline_math_delimiters(translated_text):
        return {}
    if translated_text != raw_translated_text or sanitized:
        healed_payload = {
            "cache_key": cache_key,
            "decision": decision,
            "translated_text": translated_text,
        }
        temp_path = path.with_name(f"{path.name}.tmp-{os.getpid()}-{threading.get_ident()}")
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
    target_lang: str = "zh-CN",
    target_language_name: str = "简体中文",
) -> None:
    decision = str(translation_result.get("decision", "translate") or "translate").strip() or "translate"
    translated_text = str(translation_result.get("translated_text", "") or "").strip()
    translated_text = extract_single_item_translation_text(translated_text, str(item.get("item_id", "") or ""))
    translated_text, _sanitized = _sanitize_cached_translation_text(translated_text)
    if not translated_text and decision != "keep_origin":
        return
    cache_key = cache_key_for_item(
        item,
        model=model,
        base_url=base_url,
        domain_guidance=domain_guidance,
        mode=mode,
        target_lang=target_lang,
        target_language_name=target_language_name,
    )
    _prune_expired_cache_entries_once()
    path = _cache_path(cache_key)
    _ensure_shard_dir(path)
    payload = {
        "cache_key": cache_key,
        "decision": decision,
        "translated_text": translated_text,
    }
    temp_path = path.with_name(f"{path.name}.tmp-{os.getpid()}-{threading.get_ident()}")
    temp_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    temp_path.replace(path)


def split_cached_batch(
    batch: list[dict],
    *,
    model: str,
    base_url: str,
    domain_guidance: str = "",
    mode: str = "fast",
    target_lang: str = "zh-CN",
    target_language_name: str = "简体中文",
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
            target_lang=target_lang,
            target_language_name=target_language_name,
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
    target_lang: str = "zh-CN",
    target_language_name: str = "简体中文",
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
            target_lang=target_lang,
            target_language_name=target_language_name,
        )
