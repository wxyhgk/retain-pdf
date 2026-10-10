"""精修的模型调用：一层很薄的包装，只多做两件事——记 token、守预算。

- 真实调用走翻译同一个 ``request_chat_content``（同一套重试、思考策略、Rust 执行器开关）；
  usage 由 provider 报在私有的 TranslationRunDiagnostics 里，调用前后取差值。
- 拿不到 usage（Rust 执行器模式、或 provider 不报）时按字符数估算，并在报告里注明
  ``usage_source=estimated``，预算照样能守住。
- 测试和端到端演练注入 ``chat_fn``，签名 ``chat_fn(messages, *, purpose, response_format)``，
  返回 ``ChatResult`` 或 ``(content, usage)``。
"""
from __future__ import annotations

import hashlib
import json
import threading
from dataclasses import dataclass
from dataclasses import field
from typing import Any, Callable

from retainpdf_pipeline.translate.artifacts.aggregator import TranslationRunDiagnostics
from retainpdf_pipeline.translate.artifacts.aggregator import normalize_token_usage
from retainpdf_pipeline.translate.artifacts.aggregator import thread_translation_run_diagnostics_scope
from retainpdf_pipeline.translate.llm.shared.executor_context import unit_scope
from retainpdf_pipeline.translate.llm.shared.provider_runtime import request_chat_content


REFINE_REQUEST_TIMEOUT_SECS = 180
REFINE_REQUEST_MAX_ATTEMPTS = 2
# 估算口径：中英混排平均约 2 个字符 1 个 token，偏保守（宁可早停也不超支）。
ESTIMATED_CHARS_PER_TOKEN = 2.0
USAGE_KEYS = ("prompt_tokens", "completion_tokens", "total_tokens")


@dataclass(frozen=True)
class ChatResult:
    content: str
    usage: dict[str, Any] | None = None


ChatFn = Callable[..., Any]


class RefineBudgetExceeded(Exception):
    """token 预算不够发下一次请求。"""


def estimate_tokens(text: str) -> int:
    return int(len(str(text or "")) / ESTIMATED_CHARS_PER_TOKEN) + 1


def messages_text(messages: list[dict[str, str]]) -> str:
    return "\n".join(str(message.get("content", "") or "") for message in messages)


@dataclass
class TokenLedger:
    max_tokens: int = 0
    requests: int = 0
    requests_with_usage: int = 0
    estimated_requests: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    by_phase: dict[str, dict[str, int]] = field(default_factory=dict)
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False, compare=False)

    def would_exceed(self, messages: list[dict[str, str]]) -> bool:
        if self.max_tokens <= 0:
            return False
        return self.total_tokens + estimate_tokens(messages_text(messages)) > self.max_tokens

    @property
    def exhausted(self) -> bool:
        return self.max_tokens > 0 and self.total_tokens >= self.max_tokens

    def record(self, phase: str, messages: list[dict[str, str]], content: str, usage: dict[str, Any] | None) -> None:
        counts = normalize_token_usage(usage) if isinstance(usage, dict) else {}
        if counts.get("total_tokens") is None and counts:
            counts["total_tokens"] = counts.get("prompt_tokens", 0) + counts.get("completion_tokens", 0)
        if counts.get("total_tokens"):
            self.requests_with_usage += 1
        else:
            prompt = estimate_tokens(messages_text(messages))
            completion = estimate_tokens(content)
            counts = {"prompt_tokens": prompt, "completion_tokens": completion, "total_tokens": prompt + completion}
            self.estimated_requests += 1
        self.requests += 1
        bucket = self.by_phase.setdefault(phase, {"requests": 0, **{key: 0 for key in USAGE_KEYS}})
        bucket["requests"] += 1
        for key in USAGE_KEYS:
            value = int(counts.get(key, 0) or 0)
            setattr(self, key, getattr(self, key) + value)
            bucket[key] += value

    def as_dict(self) -> dict[str, Any]:
        if self.requests == 0:
            usage_source = "none"
        elif self.estimated_requests == 0:
            usage_source = "provider"
        elif self.requests_with_usage == 0:
            usage_source = "estimated"
        else:
            usage_source = "mixed"
        return {
            "requests": self.requests,
            "requests_with_usage": self.requests_with_usage,
            "estimated_requests": self.estimated_requests,
            "usage_source": usage_source,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
            "by_phase": {phase: dict(bucket) for phase, bucket in sorted(self.by_phase.items())},
        }


def _coerce_result(value: Any) -> ChatResult:
    if isinstance(value, ChatResult):
        return value
    if isinstance(value, tuple) and len(value) == 2:
        return ChatResult(content=str(value[0] or ""), usage=value[1] if isinstance(value[1], dict) else None)
    return ChatResult(content=str(value or ""), usage=None)


def provider_chat_fn(
    *, model: str, base_url: str, api_key: str, protocol: str = "", thinking: str = ""
) -> ChatFn:
    """真实模型调用。api_key 只在闭包里，不进报告、不打印。

    ``protocol`` / ``thinking`` 显式传给 ``request_chat_content``：审校和翻译可能是同一个模型、
    不同思考深度，不能靠按「地址 + 模型」登记的那张表。空串表示按登记表。
    """

    def _call(messages: list[dict[str, str]], *, purpose: str, response_format: dict | None = None) -> ChatResult:
        diagnostics = TranslationRunDiagnostics(
            provider_family="refine",
            model=model,
            base_url=base_url,
            configured_workers=1,
            configured_batch_size=0,
            configured_classify_batch_size=0,
        )
        digest = hashlib.sha256(
            json.dumps([purpose, messages], ensure_ascii=False, sort_keys=True).encode("utf-8")
        ).hexdigest()
        with thread_translation_run_diagnostics_scope(diagnostics), unit_scope(f"refine_{purpose}", [digest]):
            content = request_chat_content(
                messages,
                api_key=api_key,
                model=model,
                base_url=base_url,
                temperature=0.0,
                response_format=response_format,
                timeout=REFINE_REQUEST_TIMEOUT_SECS,
                request_label=f"refine-{purpose}",
                max_attempts=REFINE_REQUEST_MAX_ATTEMPTS,
                protocol=protocol or None,
                thinking=thinking or None,
            )
        usage = dict(diagnostics.build_summary().get("token_usage") or {})
        usage.pop("requests_with_usage", None)
        return ChatResult(content=content, usage=usage if usage.get("total_tokens") else None)

    return _call


class RefineChat:
    """按阶段（review / fix）发请求，统一记账、守预算。"""

    def __init__(self, chat_fn: ChatFn, ledger: TokenLedger) -> None:
        self._chat_fn = chat_fn
        self.ledger = ledger
        # 编辑部会从多个线程发请求：预算检查和记账要串行（同一本账共用一把锁），请求本身不锁。
        self._lock = ledger.lock

    def request(
        self,
        phase: str,
        messages: list[dict[str, str]],
        *,
        response_format: dict | None = None,
    ) -> str:
        with self._lock:
            if self.ledger.exhausted or self.ledger.would_exceed(messages):
                raise RefineBudgetExceeded(phase)
        result = _coerce_result(self._chat_fn(messages, purpose=phase, response_format=response_format))
        with self._lock:
            self.ledger.record(phase, messages, result.content, result.usage)
        return result.content


__all__ = [
    "ChatFn",
    "ChatResult",
    "RefineBudgetExceeded",
    "RefineChat",
    "TokenLedger",
    "estimate_tokens",
    "provider_chat_fn",
]
