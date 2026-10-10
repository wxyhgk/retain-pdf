"""模型用量台账：每次模型返回就往任务目录追加一行，翻译、精修、编辑部、失败诊断都记在这里。

为什么另起一本账，不复用 ``translation_diagnostics.json`` / 精修报告里的 ``token_usage``：

- 那两份是「这一次运行」的快照，续跑、重试、多次精修会各写各的、互相覆盖；台账只追加，
  一本书前后花了多少一行不丢。
- 那两份分别丢掉了缓存（精修）和思考（全部）；这里把服务商报的都留下。
- 每行带阶段和模型，汇总时才能按阶段、按模型分。

文件路径由执行进程经环境变量给（``RETAIN_USAGE_LEDGER``，见 Rust ``worker_process.rs``）；
没给（命令行直接跑、单元测试）就不记。写入是一次 ``O_APPEND`` 的整行 write，多线程、
多进程同时追加也不会交错。

缓存字段区分「没报」和「报了 0」：``cache_hit`` 为 ``None`` 表示服务商这次没给缓存数据，
汇总时不能当成 0 去算命中率。
"""
from __future__ import annotations

import json
import os
import time
from typing import Any, Mapping
from urllib.parse import urlparse

LEDGER_ENV = "RETAIN_USAGE_LEDGER"
JOB_ID_ENV = "RETAIN_USAGE_JOB_ID"
SCHEMA_VERSION = 1

# 请求标签前缀 → 用量阶段。标签是各调用点自己起的（见 request_label=...），这里只认前缀。
_STAGE_PREFIXES: tuple[tuple[str, str], ...] = (
    ("book: ", "translation"),
    ("repair ", "translation"),
    ("final-untranslated-recovery", "translation"),
    ("mixed-split", "translation"),
    ("garbled-reconstruct", "translation"),
    ("classification page", "classification"),
    ("continuation-review", "continuation_review"),
    ("domain-infer", "domain_context"),
    ("term-prescan", "term_prescan"),
    ("term-review", "term_review"),
    ("style-guide", "style_guide"),
    ("typst-llm-repair", "typst_repair"),
    ("typst-repair", "typst_repair"),
    ("failure-ai-diagnosis", "failure_diagnosis"),
)


def usage_stage(request_label: str) -> str:
    """请求标签 → 用量阶段。精修 / 编辑部的标签是 ``refine-<角色>``，原样带上角色。"""
    label = (request_label or "").strip().lower()
    if label.startswith("refine-"):
        role = label[len("refine-"):].split()[0] if label[len("refine-"):].strip() else ""
        return f"refine_{role}" if role else "refine"
    for prefix, stage in _STAGE_PREFIXES:
        if label.startswith(prefix):
            return stage
    return "other" if label else "unspecified"


def _count(source: Any, key: str) -> int | None:
    if not isinstance(source, Mapping):
        return None
    value = source.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return int(value)


def usage_fields(usage: Mapping[str, Any] | None) -> dict[str, Any]:
    """OpenAI Chat 形状的 usage（各协议已在 model_wire 里换成这个形状）→ 台账字段。

    缓存命中认两种写法：DeepSeek 顶层的 ``prompt_cache_hit_tokens``，OpenAI / DashScope 的
    ``prompt_tokens_details.cached_tokens``。缓存写入只有 Anthropic 报（``prompt_cache_write_tokens``）。
    """
    if not isinstance(usage, Mapping):
        return {"input": 0, "output": 0, "cache_hit": None, "cache_write": None, "reasoning": None,
                "usage_reported": False}
    cache_hit = _count(usage, "prompt_cache_hit_tokens")
    if cache_hit is None:
        cache_hit = _count(usage.get("prompt_tokens_details"), "cached_tokens")
    return {
        "input": _count(usage, "prompt_tokens") or 0,
        "output": _count(usage, "completion_tokens") or 0,
        "cache_hit": cache_hit,
        "cache_write": _count(usage, "prompt_cache_write_tokens"),
        "reasoning": _count(usage.get("completion_tokens_details"), "reasoning_tokens"),
        "usage_reported": _count(usage, "prompt_tokens") is not None
        or _count(usage, "completion_tokens") is not None,
    }


def _host(base_url: str) -> str:
    try:
        return str(urlparse(str(base_url or "").strip()).hostname or "").lower()
    except ValueError:
        return ""


def build_record(
    *,
    usage: Mapping[str, Any] | None,
    model: str,
    base_url: str,
    protocol: str,
    request_label: str,
    job_id: str = "",
) -> dict[str, Any]:
    return {
        "v": SCHEMA_VERSION,
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "pipeline",
        "job_id": job_id,
        "stage": usage_stage(request_label),
        "model": str(model or "").strip(),
        "host": _host(base_url),
        "protocol": protocol,
        **usage_fields(usage),
    }


def append_record(path: str, record: Mapping[str, Any]) -> None:
    """整行一次写入（O_APPEND）。记账失败不能让翻译失败：吞掉 OSError，打一行日志。"""
    line = (json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    try:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o644)
        try:
            os.write(fd, line)
        finally:
            os.close(fd)
    except OSError as exc:
        print(f"usage-ledger: append failed: {type(exc).__name__}: {exc}", flush=True)


def record_model_usage(
    usage: Mapping[str, Any] | None,
    *,
    model: str,
    base_url: str,
    protocol: str,
    request_label: str,
) -> None:
    """模型返回后调用一次（不论 usage 有没有）。没配台账路径时什么都不做。"""
    path = os.environ.get(LEDGER_ENV, "").strip()
    if not path:
        return
    append_record(
        path,
        build_record(
            usage=usage,
            model=model,
            base_url=base_url,
            protocol=protocol,
            request_label=request_label,
            job_id=os.environ.get(JOB_ID_ENV, "").strip(),
        ),
    )


__all__ = [
    "JOB_ID_ENV",
    "LEDGER_ENV",
    "append_record",
    "build_record",
    "record_model_usage",
    "usage_fields",
    "usage_stage",
]
