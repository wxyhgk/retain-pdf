from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
import threading
import time
from pathlib import Path

from retainpdf_pipeline.foundation.config import paths

from retainpdf_pipeline.translate.core.context import build_item_context
from retainpdf_pipeline.translate.core.engine_identity import _PROMPT_HASHES
from retainpdf_pipeline.translate.core.engine_identity import FORMULA_SEGMENT_STRATEGY_VERSION
from retainpdf_pipeline.translate.core.engine_identity import PLAIN_TEXT_STRATEGY_VERSION
from retainpdf_pipeline.translate.core.engine_identity import TRANSLATION_POLICY_VERSION
from retainpdf_pipeline.translate.core.engine_identity import TRANSLATION_PROMPT_FILES
from retainpdf_pipeline.translate.core.engine_identity import TRANSLATION_PROTOCOL_VERSION
from retainpdf_pipeline.translate.core.engine_identity import translation_engine_identity
from retainpdf_pipeline.translate.core.payload.parts.result_entries import with_sanitized_translation
from retainpdf_pipeline.translate.llm.shared.provider_runtime import extract_single_item_translation_text
from retainpdf_pipeline.translate.llm.shared.provider_runtime import normalize_base_url
from retainpdf_pipeline.translate.llm.validation.english_residue import normalize_inline_whitespace
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import strip_placeholders


# Cache writes need no process-wide lock: each writer uses a unique temporary
# file and os.replace is atomic, so concurrent writers cannot corrupt an entry.
# The file and shard directory are fsynced because this cache is also the
# finest-grained recovery layer between page checkpoint flushes.
UNESCAPED_INLINE_DOLLAR_RE = re.compile(r"(?<!\\)\$")
UNIT_CACHE_KEY_VERSION = "translation-unit-cache-v2"


def _prompt_context_signature(item: dict) -> dict[str, str]:
    context = build_item_context(item)
    include_continuation = str(item.get("translation_context_mode", "needed") or "needed").strip().lower() != "off"
    return {
        "before": context.context_before_for_prompt(),
        "after": context.context_after_for_prompt(),
        # Formula-segment requests use the continuation component independently
        # of the merged window. Keep that distinction in the cache identity.
        "continuation_before": normalize_inline_whitespace(strip_placeholders(str(item.get("continuation_prev_text", "") or ""))) if include_continuation else "",
        "continuation_after": normalize_inline_whitespace(strip_placeholders(str(item.get("continuation_next_text", "") or ""))) if include_continuation else "",
    }


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
    engine_identity = translation_engine_identity(mode=mode)
    payload = {
        # Deliberately invalidate pre-context keys, including context-free ones.
        "cache_key_version": UNIT_CACHE_KEY_VERSION,
        "model": model.strip(),
        "base_url": normalize_base_url(base_url),
        "domain_guidance": (domain_guidance or "").strip(),
        "mode": mode.strip() or "fast",
        "target_lang": (target_lang or "zh-CN").strip() or "zh-CN",
        "target_language_name": (target_language_name or "简体中文").strip() or "简体中文",
        **engine_identity,
        "strategy_signature": _strategy_signature(item),
        "translation_style_hint": str(item.get("translation_style_hint", "") or "").strip(),
        "translation_structure_kind": str(item.get("translation_structure_kind", "") or "").strip(),
        "source_text": _unit_source_text(item),
        "prompt_context": _prompt_context_signature(item),
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


def _atomic_write_cache_payload(path: Path, payload: dict[str, str]) -> None:
    _ensure_shard_dir(path)
    fd, temp_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
        text=True,
    )
    temp_path = Path(temp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, path)
        try:
            dir_fd = os.open(path.parent, os.O_RDONLY)
        except OSError:
            return
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)
    except Exception:
        try:
            temp_path.unlink()
        except FileNotFoundError:
            pass
        raise


def _unit_cache_ttl_seconds() -> float:
    raw = str(os.environ.get(UNIT_CACHE_TTL_DAYS_ENV, "") or "").strip()
    try:
        days = float(raw) if raw else float(DEFAULT_UNIT_CACHE_TTL_DAYS)
    except ValueError:
        days = float(DEFAULT_UNIT_CACHE_TTL_DAYS)
    return days * 86400.0


def _prune_expired_cache_entries_once() -> None:
    # 缓存 key 含提示词指纹和协议版本,提示词一改旧代条目全部成为
    # 永不命中的孤儿,此前无任何回收机制、无限增长。按 mtime TTL
    # (默认 90 天,RETAIN_TRANSLATION_UNIT_CACHE_TTL_DAYS=0 关闭)
    # 每进程最多清扫一次,失败静默——这是缓存卫生,不是正确性。
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
        _atomic_write_cache_payload(path, healed_payload)
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
    payload = {
        "cache_key": cache_key,
        "decision": decision,
        "translated_text": translated_text,
    }
    _atomic_write_cache_payload(path, payload)


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
