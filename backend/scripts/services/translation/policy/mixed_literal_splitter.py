from __future__ import annotations

import hashlib
import json
import os
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from foundation.config import paths
from foundation.shared.prompt_loader import load_prompt
from services.document_schema.semantics import structure_role
from services.translation.llm.deepseek_client import request_chat_content
from services.translation.policy.soft_hints import build_soft_rule_hints
from services.translation.policy.soft_hints import extract_command_prefix
from services.translation.policy.soft_hints import extract_line_texts
from services.translation.policy.soft_hints import looks_like_code_literal_text_value
from services.translation.policy.soft_hints import natural_word_count


VALID_ACTIONS = {"keep_all", "translate_all", "translate_tail"}
_CACHE_LOCK = threading.Lock()
_STRATEGY_VERSION = "mixed_literal_split_v1"


def _line_texts(item: dict) -> list[str]:
    return extract_line_texts(item)


def _build_messages(item: dict, rule_guidance: str = "") -> list[dict[str, str]]:
    system_prompt = load_prompt("mixed_literal_split_system.txt")
    if rule_guidance.strip():
        system_prompt = f"{system_prompt}\n\nAdditional rule guidance:\n{rule_guidance.strip()}"
    payload = {
        "task": load_prompt("mixed_literal_split_task.txt"),
        "item_id": item.get("item_id", ""),
        "block_type": item.get("block_type", ""),
        "structure_role": structure_role(item.get("metadata", {}) or {}) or "body",
        "source_text": item.get("source_text", ""),
        "line_texts": _line_texts(item),
        "soft_hints": build_soft_rule_hints(item),
    }
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]


def _parse_response(content: str) -> tuple[str, str]:
    action = ""
    prefix = ""
    for raw_line in content.splitlines():
        line = raw_line.strip()
        lower = line.lower()
        if lower.startswith("action:"):
            action = lower.split(":", 1)[1].strip()
        elif lower.startswith("prefix:"):
            prefix = line.split(":", 1)[1].strip()
    if action not in VALID_ACTIONS:
        raise ValueError(f"invalid mixed split action: {action!r}")
    if action == "translate_tail" and not prefix:
        raise ValueError("translate_tail requires a non-empty prefix")
    return action, prefix


def _fallback_decision(item: dict) -> tuple[str, str]:
    text = " ".join((item.get("source_text") or "").split())
    prefix = extract_command_prefix(text)
    if prefix:
        return "translate_tail", prefix
    natural_words = len([token for token in text.split() if any(ch.isalpha() for ch in token) and len(token) >= 3])
    if natural_words >= 8:
        return "translate_all", ""
    return "keep_all", ""


def _validated_decision(item: dict, action: str, prefix: str) -> tuple[str, str]:
    text = " ".join((item.get("source_text") or "").split())
    if action != "translate_tail":
        return action, ""
    if not text.startswith(prefix):
        return _fallback_decision(item)
    tail = text[len(prefix) :].strip()
    if not tail:
        return "keep_all", ""
    return action, prefix


def _decide_single_item(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    rule_guidance: str,
) -> tuple[str, str]:
    content = request_chat_content(
        _build_messages(item, rule_guidance=rule_guidance),
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.0,
        response_format=None,
        timeout=120,
        request_label=request_label,
    )
    action, prefix = _parse_response(content)
    return _validated_decision(item, action, prefix)


def _cache_key(item: dict, *, model: str, base_url: str, rule_guidance: str) -> str:
    payload = {
        "strategy": _STRATEGY_VERSION,
        "model": str(model or "").strip(),
        "base_url": str(base_url or "").strip().rstrip("/"),
        "rule_guidance": str(rule_guidance or "").strip(),
        "source_text": str(item.get("source_text", "") or ""),
        "line_texts": _line_texts(item),
        "block_type": str(item.get("block_type", "") or ""),
        "structure_role": structure_role(item.get("metadata", {}) or {}) or "body",
    }
    body = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def _cache_path(cache_key: str) -> Path:
    return paths.TRANSLATION_UNIT_CACHE_DIR / "mixed-literal" / cache_key[:2] / f"{cache_key}.json"


def _load_cached_decision(item: dict, *, model: str, base_url: str, rule_guidance: str) -> tuple[str, str] | None:
    cache_key = _cache_key(item, model=model, base_url=base_url, rule_guidance=rule_guidance)
    path = _cache_path(cache_key)
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    action = str(payload.get("action", "") or "").strip()
    prefix = str(payload.get("prefix", "") or "").strip()
    if action not in VALID_ACTIONS:
        return None
    return _validated_decision(item, action, prefix)


def _store_cached_decision(
    item: dict,
    *,
    model: str,
    base_url: str,
    rule_guidance: str,
    action: str,
    prefix: str,
) -> None:
    cache_key = _cache_key(item, model=model, base_url=base_url, rule_guidance=rule_guidance)
    path = _cache_path(cache_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "cache_key": cache_key,
        "action": action,
        "prefix": prefix,
    }
    temp_path = path.with_name(f"{path.name}.tmp-{os.getpid()}-{threading.get_ident()}")
    with _CACHE_LOCK:
        temp_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        temp_path.replace(path)


def _local_decision(item: dict) -> tuple[str, str] | None:
    text = " ".join((item.get("source_text") or "").split())
    if not text:
        return "keep_all", ""
    hints = set(build_soft_rule_hints(item))
    prefix = extract_command_prefix(text)
    if looks_like_code_literal_text_value(text):
        return "keep_all", ""
    if prefix and natural_word_count(text[len(prefix):].strip()) >= 6:
        return _validated_decision(item, "translate_tail", prefix)
    if "mixed_literal_and_prose_block" not in hints and natural_word_count(text) >= 8:
        return "translate_all", ""
    return None


def split_mixed_literal_items(
    items: list[dict],
    *,
    api_key: str,
    model: str,
    base_url: str,
    workers: int = 1,
    rule_guidance: str = "",
) -> dict[str, tuple[str, str]]:
    if not items:
        return {}

    results: dict[str, tuple[str, str]] = {}

    def _run(item: dict) -> tuple[str, tuple[str, str]]:
        item_id = str(item.get("item_id", "") or "")
        cached = _load_cached_decision(item, model=model, base_url=base_url, rule_guidance=rule_guidance)
        if cached is not None:
            return item_id, cached
        local = _local_decision(item)
        if local is not None:
            _store_cached_decision(
                item,
                model=model,
                base_url=base_url,
                rule_guidance=rule_guidance,
                action=local[0],
                prefix=local[1],
            )
            return item_id, local
        try:
            decision = _decide_single_item(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=f"mixed-split {item_id}",
                rule_guidance=rule_guidance,
            )
        except Exception:
            decision = _fallback_decision(item)
        _store_cached_decision(
            item,
            model=model,
            base_url=base_url,
            rule_guidance=rule_guidance,
            action=decision[0],
            prefix=decision[1],
        )
        return item_id, decision

    if workers <= 1 or len(items) == 1:
        for item in items:
            item_id, decision = _run(item)
            results[item_id] = decision
        return results

    with ThreadPoolExecutor(max_workers=max(1, min(workers, 4))) as executor:
        futures = {executor.submit(_run, item): item.get("item_id", "") for item in items}
        for future in as_completed(futures):
            item_id, decision = future.result()
            results[item_id] = decision
    return results


__all__ = ["split_mixed_literal_items"]
