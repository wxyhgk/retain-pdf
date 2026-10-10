"""助手的模型用量台账：每次模型返回追加一行到 ``<data_root>/usage/assistant.v1.jsonl``。

行的格式和流水线的任务台账一致（见 ``retainpdf_pipeline/translate/llm/shared/usage_ledger.py``），
Rust 侧 ``services/usage`` 一起汇总：带 ``document_id`` 的行也算进那本书的用量。

记账失败不能让回答失败：写不进去只打一行日志。
"""
from __future__ import annotations

import json
import logging
import os
import time
from collections.abc import Mapping
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ASSISTANT_LEDGER_RELATIVE_PATH = Path("usage") / "assistant.v1.jsonl"

logger = logging.getLogger(__name__)


def _count(source: Any, key: str) -> int | None:
    if not isinstance(source, Mapping):
        return None
    value = source.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return int(value)


def build_record(
    usage: Mapping[str, Any] | None,
    *,
    stage: str,
    model: str,
    base_url: str,
    document_id: str = "",
) -> dict[str, Any]:
    usage = usage if isinstance(usage, Mapping) else {}
    cache_hit = _count(usage, "prompt_cache_hit_tokens")
    if cache_hit is None:
        cache_hit = _count(usage.get("prompt_tokens_details"), "cached_tokens")
    try:
        host = str(urlparse(str(base_url or "").strip()).hostname or "").lower()
    except ValueError:
        host = ""
    return {
        "v": 1,
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "assistant",
        "document_id": document_id.strip(),
        "stage": stage,
        "model": str(model or "").strip(),
        "host": host,
        "protocol": "openai",
        "input": _count(usage, "prompt_tokens") or 0,
        "output": _count(usage, "completion_tokens") or 0,
        "cache_hit": cache_hit,
        "cache_write": None,
        "reasoning": _count(usage.get("completion_tokens_details"), "reasoning_tokens"),
        "usage_reported": _count(usage, "prompt_tokens") is not None
        or _count(usage, "completion_tokens") is not None,
    }


def record_assistant_usage(
    data_root: Path | str | None,
    usage: Mapping[str, Any] | None,
    *,
    stage: str,
    model: str,
    base_url: str,
    document_id: str = "",
) -> None:
    if not data_root:
        return
    path = Path(data_root) / ASSISTANT_LEDGER_RELATIVE_PATH
    record = build_record(usage, stage=stage, model=model, base_url=base_url, document_id=document_id)
    line = (json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o644)
        try:
            os.write(fd, line)
        finally:
            os.close(fd)
    except OSError as exc:
        logger.warning("assistant usage ledger append failed: %s", type(exc).__name__)
