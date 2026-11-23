"""表格 agent 的模型调用：走翻译共用的 ``request_chat_content``（同一套重试、协议、Rust 执行器开关）。

- 每次请求开一个稳定的单元范围（``table_translate`` + 消息的哈希），Rust 执行器模式下也能发；
- 请求标签 ``table-translate``，用量台账记成 ``table_translation`` 阶段；
- 同一次运行里这组 Key 被上游 401/402/403 拒过，下一张表直接停（不再一张张去撞）。
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

from retainpdf_translation.artifacts.aggregator import TranslationRunDiagnostics
from retainpdf_translation.artifacts.aggregator import thread_translation_run_diagnostics_scope
from retainpdf_translation.llm.shared.executor_context import unit_scope
from retainpdf_translation.llm.shared.provider_runtime import request_chat_content
from retainpdf_translation.llm.shared.upstream_resilience import raise_if_credential_rejected
from retainpdf_translation_classic.services.refine.llm import ChatResult

REQUEST_LABEL = "table-translate"
REQUEST_TIMEOUT_SECS = 180
REQUEST_MAX_ATTEMPTS = 2


def table_chat_fn(
    *,
    model: str,
    base_url: str,
    api_key: str,
    protocol: str = "",
    thinking: str = "",
    diagnostics: TranslationRunDiagnostics | None = None,
):
    """真实模型调用。api_key 只在闭包里。``diagnostics`` 给同一次运行共用的那份（Key 失效的闩在上面）。"""
    run_diagnostics = diagnostics or TranslationRunDiagnostics(
        provider_family="table",
        model=model,
        base_url=base_url,
        configured_workers=1,
        configured_batch_size=0,
        configured_classify_batch_size=0,
    )

    def _call(messages: list[dict[str, str]], *, purpose: str, response_format: dict | None = None) -> ChatResult:
        raise_if_credential_rejected(run_diagnostics, base_url=base_url, api_key=api_key, model=model)
        digest = hashlib.sha256(json.dumps([purpose, messages], ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
        before = _usage(run_diagnostics)
        with thread_translation_run_diagnostics_scope(run_diagnostics), unit_scope(purpose, [digest]):
            content = request_chat_content(
                messages,
                api_key=api_key,
                model=model,
                base_url=base_url,
                temperature=0.0,
                response_format=response_format,
                timeout=REQUEST_TIMEOUT_SECS,
                request_label=REQUEST_LABEL,
                max_attempts=REQUEST_MAX_ATTEMPTS,
                protocol=protocol or None,
                thinking=thinking or None,
            )
        after = _usage(run_diagnostics)
        usage = {key: after.get(key, 0) - before.get(key, 0) for key in after if isinstance(after.get(key), int)}
        return ChatResult(content=content, usage=usage if usage.get("total_tokens") else None)

    return _call


def _usage(diagnostics: TranslationRunDiagnostics) -> dict[str, Any]:
    return dict(diagnostics.build_summary().get("token_usage") or {})


__all__ = ["REQUEST_LABEL", "table_chat_fn"]
