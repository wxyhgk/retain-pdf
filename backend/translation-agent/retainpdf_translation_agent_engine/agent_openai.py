"""翻译 agent 接 OpenAI 协议（``openai`` 对话补全 / ``openai_responses``）：把 agent 发的 Anthropic Messages 请求体
换成翻译共用的 ``request_chat_content`` 一次请求，再把回答包回 Anthropic 的样子交给 agent。

agent 包（``retainpdf-translation-agent``）只认 Anthropic 的请求、回答格式，也只许用标准库；各家 OpenAI 兼容服务的
差异（temperature 不收、思考字段、json_schema 不支持退到 json_object、流式、Rust 执行器、重试）都在共用请求层里，
这里只做格式换算，不再写一遍：

- 系统提示（Anthropic 的 system 块）→ 一条 system 消息；用户消息原样；
- 强制用工具交回的请求（通读 ``submit_reading``、审校 ``submit_review``）→ ``response_format`` 按工具的 schema 要 JSON，
  系统提示末尾附上 schema（退到 json_object 的服务商只能靠提示）；回答解析成 JSON 后包成 ``tool_use``；
  ``response_format`` 里的 schema 换成 OpenAI strict 认的写法（可选字段改成必填、可为 null，``model_wire.strict_json_schema``），
  并标 ``strict``：OpenAI Responses 按 strict 校验 schema，原样发通读的 schema 会被拒（#163，2026-11-23）；交回的 null 去掉，
  agent 看到的和以前「没写这个字段」一样；
- 纯文本请求（初译、重翻、改稿）→ 不带 ``response_format``，回答包成 ``text``；
- Anthropic 专有的字段（``cache_control``、``thinking``、``output_config``、``max_tokens``、``strict``）不往下传；思考档位
  按任务的 thinking 设置走共用请求层的换算，和 legacy 一样；
- 用量：共用请求层自己记用量台账（请求标签 ``agent-translate`` / ``agent-read`` / ``agent-review``），这里只把这次请求的
  token 换成 Anthropic 的字段名交回，agent 自己的计数、编辑部事件照常；
- 错误：Key 被拒（401/403）→ ``AuthFailed``，402 和业务码说余额、额度用完的 429 等 → ``QuotaExhausted``（第一次就停，
  不当限流退避），一直限流、5xx、网络断 → ``RateLimited``，
  都是 agent 的 ``StopRun``：保存进度、阶段失败，修好重试从断点接着翻。别的错误原样抛。

回答不完整（2026-11-23）：共用请求层看 ``finish_reason`` / Responses ``status``，被长度截断、被内容过滤、服务商中途停了时
抛 ``ModelOutputIncomplete``（带已经写出的半截）。这里把半截照样包回去、``stop_reason`` 写 ``max_tokens``，agent 和 Anthropic
下一样把最后一块当没交、重翻（以前拿不到 finish_reason，半截译文只能靠校验兜）。
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any
from typing import Callable

import requests

from retainpdf_translation.artifacts.aggregator import TranslationRunDiagnostics
from retainpdf_translation.artifacts.aggregator import thread_translation_run_diagnostics_scope
from retainpdf_translation.llm.shared import model_wire
from retainpdf_translation.llm.shared import upstream_resilience
from retainpdf_translation.llm.shared.executor_context import unit_scope
from retainpdf_translation.llm.shared.output_limits import ModelOutputIncomplete
from retainpdf_translation.llm.shared.provider_runtime import request_chat_content
from retainpdf_translation_agent import AuthFailed
from retainpdf_translation_agent import QuotaExhausted
from retainpdf_translation_agent import RateLimited

REQUEST_TIMEOUT_SECS = 300
# 和 legacy 翻译请求一样（translation_client 的翻译请求都是 0.0）；不收 temperature 的模型由共用请求层挨一次 400 后记住、不再带
TEMPERATURE = 0.0
TOOL_LABELS = {"submit_reading": "agent-read", "submit_review": "agent-review"}
PLAIN_LABEL = "agent-translate"
_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*(.*?)\s*```\s*$", re.DOTALL)

ChatFn = Callable[..., str]


def _system_text(system: Any) -> str:
    if isinstance(system, str):
        return system
    return "\n\n".join(str(part.get("text") or "") for part in system or [] if isinstance(part, dict))


def _tool_instruction(tool: dict) -> str:
    schema = json.dumps(tool.get("input_schema") or {}, ensure_ascii=False)
    return (
        f"交回方式：不要写别的文字，只输出一个 JSON 对象（不要包在代码块里），它就是 `{tool['name']}` 的参数，"
        f"符合下面的 JSON Schema：\n{schema}"
    )


def openai_request(body: dict) -> tuple[list[dict[str, str]], dict | None, str, str | None]:
    """Anthropic 请求体 → (messages, response_format, 请求标签, 要交回的工具名)。

    只认强制交回的那一个工具。初译的多轮只读工具（`tool_choice` 是 auto / none，2026-11-19）共用请求层还交不回
    tool_calls，换不过来：直接报错，不悄悄当成强制交卷（调用方在 OpenAI 协议下不该开工具）。"""
    tools = body.get("tools") or []
    choice = body.get("tool_choice") or {}
    if tools and (len(tools) != 1 or choice.get("type") != "tool"):
        raise ValueError("agent tool loop (search_book / lookup_term) is not supported over the OpenAI protocol")
    tool = tools[0] if tools else None
    system = _system_text(body.get("system"))
    if tool is not None:
        system = f"{system}\n\n{_tool_instruction(tool)}" if system else _tool_instruction(tool)
    messages: list[dict[str, str]] = [{"role": "system", "content": system}] if system else []
    for message in body.get("messages") or []:
        content = message.get("content")
        if not isinstance(content, str):
            content = "".join(str(part.get("text") or "") for part in content or [] if isinstance(part, dict))
        messages.append({"role": str(message.get("role") or "user"), "content": content})
    if tool is None:
        return messages, None, PLAIN_LABEL, None
    response_format = {
        "type": "json_schema",
        # strict 要求每个属性都列进 required：agent 的工具 schema 有可选字段（通读的 domain、chapters、note），换成必填、
        # 可为 null 的写法再发。以前不标 strict、原样发，OpenAI Responses 照样按 strict 校验，通读整个被拒（#163）
        "json_schema": {
            "name": str(tool["name"]),
            "schema": model_wire.strict_json_schema(tool.get("input_schema") or {}),
            "strict": True,
        },
    }
    return messages, response_format, TOOL_LABELS.get(str(tool["name"]), PLAIN_LABEL), str(tool["name"])


def _decode_json(text: str) -> dict | None:
    text = (text or "").strip()
    match = _FENCE_RE.match(text)
    if match:
        text = match.group(1)
    try:
        data = json.loads(text)
    except ValueError:
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end <= start:
            return None
        try:
            data = json.loads(text[start : end + 1])
        except ValueError:
            return None
    return data if isinstance(data, dict) else None


def _drop_nulls(value: Any) -> Any:
    """strict 下可选字段交回的 null → 去掉这个键（agent 的工具 schema 里没有可为 null 的字段，null 只会是「没写」）。"""
    if isinstance(value, dict):
        return {key: _drop_nulls(item) for key, item in value.items() if item is not None}
    if isinstance(value, list):
        return [_drop_nulls(item) for item in value]
    return value


def anthropic_response(content: str, *, tool_name: str | None, usage: dict[str, int], stop_reason: str = "end_turn") -> dict:
    """OpenAI 回答的文本 → agent 认的 Anthropic 回答。工具请求的 JSON 解析不了就不交 tool_use（agent 按"没交回"处理）。
    ``stop_reason``：回答不完整时是 ``max_tokens``（agent 把最后一块当没交）。"""
    if tool_name is None:
        parts = [{"type": "text", "text": content}]
    else:
        data = _decode_json(content)
        data = _drop_nulls(data) if data is not None else None
        parts = [{"type": "tool_use", "name": tool_name, "input": data}] if data is not None else [{"type": "text", "text": content}]
    return {"content": parts, "stop_reason": stop_reason, "usage": usage}


def anthropic_usage_fields(token_usage: dict[str, Any]) -> dict[str, int]:
    """共用请求层归一后的 token（prompt/completion/缓存命中）→ Anthropic 的字段名（agent 的 Usage 按这个加）。"""
    prompt = int(token_usage.get("prompt_tokens") or 0)
    cached = int(token_usage.get("prompt_cache_hit_tokens") or 0)
    return {
        "input_tokens": max(0, prompt - cached),
        "cache_read_input_tokens": cached,
        "output_tokens": int(token_usage.get("completion_tokens") or 0),
    }


def _stop_error(error: BaseException) -> BaseException | None:
    status = upstream_resilience.http_status_of(error)
    # 先看业务码：429 里的余额、额度用完不是限流（upstream_error_codes），智谱 1311/1315 当 Key 被拒
    if upstream_resilience.is_quota_error(error):
        return QuotaExhausted(f"model API HTTP {status}: {upstream_resilience.describe_upstream_error(error)}")
    if upstream_resilience.is_auth_error(error):
        return AuthFailed(f"model API HTTP {status}: {upstream_resilience.describe_upstream_error(error)}")
    if status in {429, 500, 502, 503, 504, 529} or isinstance(error, (requests.ConnectionError, requests.Timeout)):
        return RateLimited(f"model API still failing: {upstream_resilience.describe_upstream_error(error)}")
    return None


def make_openai_transport(
    *,
    api_key: str,
    model: str,
    base_url: str,
    protocol: str,
    thinking: str | None = None,
    chat: ChatFn | None = None,
) -> Callable[[dict], dict]:
    """agent 的 transport（收 Anthropic 请求体、交回 Anthropic 回答）；请求经共用的 ``request_chat_content``。
    ``chat`` 只给测试注入。Key 只在闭包里。"""
    if not api_key:
        raise AuthFailed("model API key is empty")
    send = chat or request_chat_content

    def transport(body: dict) -> dict:
        messages, response_format, label, tool_name = openai_request(body)
        # 每次请求一份诊断：拿到这一次的 token（agent 的请求可能并发，共用一份分不开）
        diagnostics = TranslationRunDiagnostics(
            provider_family="agent",
            model=model,
            base_url=base_url,
            configured_workers=1,
            configured_batch_size=0,
            configured_classify_batch_size=0,
        )
        digest = hashlib.sha256(json.dumps(body, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
        stop_reason = "end_turn"
        try:
            with thread_translation_run_diagnostics_scope(diagnostics), unit_scope("agent", [digest]):
                content = send(
                    messages,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    temperature=TEMPERATURE,
                    response_format=response_format,
                    timeout=REQUEST_TIMEOUT_SECS,
                    request_label=label,
                    protocol=protocol,
                    thinking=thinking,
                )
        except ModelOutputIncomplete as incomplete:
            # 截断、被内容过滤：半截照样交回，告诉 agent 回答没写完（和 Anthropic 的 max_tokens 一样处理）
            content = incomplete.partial_content
            stop_reason = "max_tokens"
            print(f"{label}: {incomplete}", flush=True)
        except Exception as error:  # noqa: BLE001 - 换成 agent 的 StopRun，别的原样抛
            stop = _stop_error(error)
            if stop is not None:
                raise stop from error
            raise
        token_usage = dict(diagnostics.build_summary().get("token_usage") or {})
        return anthropic_response(
            content, tool_name=tool_name, usage=anthropic_usage_fields(token_usage), stop_reason=stop_reason
        )

    return transport


__all__ = ["anthropic_response", "anthropic_usage_fields", "make_openai_transport", "openai_request"]
