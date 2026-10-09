"""模型接口的线上格式：用哪种协议发请求、思考开多深。

两种协议：

- ``openai``：``POST {base_url}/chat/completions`` + ``Authorization: Bearer``。DeepSeek、Qwen、
  智谱、OpenAI 以及各种中转都走这个。
- ``anthropic``：``POST {base_url}/messages`` + ``x-api-key``（Anthropic Messages API）。system 单独
  放顶层、必须给 max_tokens、返回的是内容块列表。

思考深度 ``auto / off / low / medium / high / max``：

- ``auto`` 保持以前的行为——只对实测过的「模型 + 服务商」加字段（翻译用不着思考，能关就关），
  其余什么都不加，由服务商默认。
- 其余档位按协议、服务商换成对应字段。各家对字段的支持参差不齐，所以每档给一串候选，
  第一个被服务商以 400 拒绝时退到下一个，最后一个总是「什么都不加」，不会因为思考字段
  让整个请求失败。

连接配置（协议 + 思考深度）由阶段入口按「地址 + 模型」登记一次（``register_connection``），
发请求时查表；调用方也可以显式传，显式的优先。
"""
from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse


PROTOCOL_OPENAI = "openai"
PROTOCOL_ANTHROPIC = "anthropic"
# 下面两个元组的取值和 Rust 的 TRANSLATION_API_PROTOCOLS / TRANSLATION_THINKING_LEVELS 由测试对齐，
# 保持字面量写法。
PROTOCOLS = ("openai", "anthropic")

THINKING_LEVELS = ("auto", "off", "low", "medium", "high", "max")

ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1"
# Anthropic 必须给 max_tokens。翻译输出远小于这个数；开思考时再加上思考预算。
ANTHROPIC_DEFAULT_MAX_TOKENS = 16384

# 「按 token 数给预算」的服务商（DashScope 的 thinking_budget、Anthropic 旧式 budget_tokens）。
THINKING_BUDGET_TOKENS = {"low": 2048, "medium": 8192, "high": 16384, "max": 32768}


def normalize_protocol(value: Any) -> str:
    text = str(value or "").strip().lower()
    return text if text in PROTOCOLS else PROTOCOL_OPENAI


def normalize_thinking(value: Any) -> str:
    text = str(value or "").strip().lower()
    return text if text in THINKING_LEVELS else "auto"


@dataclass(frozen=True)
class ConnectionProfile:
    protocol: str = PROTOCOL_OPENAI
    thinking: str = "auto"


_PROFILES_LOCK = threading.Lock()
_PROFILES: dict[tuple[str, str], ConnectionProfile] = {}


def _profile_key(base_url: str, model: str) -> tuple[str, str]:
    return (str(base_url or "").strip().rstrip("/").lower(), str(model or "").strip().lower())


def register_connection(*, base_url: str, model: str, protocol: Any = "", thinking: Any = "") -> ConnectionProfile:
    """登记一个连接的协议和思考深度。同一「地址 + 模型」后登记的覆盖先登记的。"""
    profile = ConnectionProfile(protocol=normalize_protocol(protocol), thinking=normalize_thinking(thinking))
    with _PROFILES_LOCK:
        _PROFILES[_profile_key(base_url, model)] = profile
    return profile


def register_stage_connections(
    *,
    model: str,
    base_url: str,
    api_protocol: Any = "",
    thinking: Any = "",
    reviewer_model: str = "",
    reviewer_base_url: str = "",
    reviewer_api_protocol: Any = "",
    reviewer_thinking: Any = "",
) -> None:
    """阶段入口读完 spec 后调用：登记翻译模型；审校模型和翻译模型不是同一个连接时也登记。

    审校和翻译是同一个「地址 + 模型」时不登记审校——否则审校的思考深度会盖掉翻译的。
    精修发请求时显式带上审校的协议和思考深度（见 ``services/refine``）。
    """
    register_connection(base_url=base_url, model=model, protocol=api_protocol, thinking=thinking)
    reviewer_model = reviewer_model or model
    reviewer_base_url = reviewer_base_url or base_url
    if _profile_key(reviewer_base_url, reviewer_model) != _profile_key(base_url, model):
        register_connection(
            base_url=reviewer_base_url,
            model=reviewer_model,
            protocol=reviewer_api_protocol or api_protocol,
            thinking=reviewer_thinking or thinking,
        )


def clear_registered_connections() -> None:
    with _PROFILES_LOCK:
        _PROFILES.clear()


def resolve_profile(*, base_url: str, model: str, protocol: Any = None, thinking: Any = None) -> ConnectionProfile:
    with _PROFILES_LOCK:
        registered = _PROFILES.get(_profile_key(base_url, model), ConnectionProfile())
    return ConnectionProfile(
        protocol=normalize_protocol(protocol) if protocol else registered.protocol,
        thinking=normalize_thinking(thinking) if thinking else registered.thinking,
    )


def hostname(base_url: str) -> str:
    try:
        return str(urlparse(str(base_url or "").strip()).hostname or "").lower()
    except ValueError:
        return ""


# ---------------------------------------------------------------------------
# OpenAI 协议的思考字段
# ---------------------------------------------------------------------------


def _auto_openai_thinking(*, model: str, host: str) -> dict[str, Any]:
    """以前写死的思考策略，现在是「自动」档。翻译不需要思考这一轮额外生成。

    - DashScope 的 qwen3.8-flash 默认思考：`enable_thinking: false` 关掉。
    - 智谱的 glm-5.3-flash 始终思考、**不能关**（传 `thinking: {type: disabled}` 返回 400
      「该模型始终思考，不支持关闭思考；请使用 low、high 或 max」），只能调强度。默认是
      max：4 段论文段落实测每段 6～9 秒、思考 270～513 token；`reasoning_effort: low`
      下每段 1.6～3.5 秒、思考 token 全为 0，译文同样正确。思考还会吃掉 max_tokens ——
      给小了直接返回空译文。
    """
    name = model.strip().lower()
    if name == "qwen3.8-flash" and host == "dashscope.aliyuncs.com":
        return {"enable_thinking": False}
    if name == "glm-5.3-flash" and host == "open.bigmodel.cn":
        return {"reasoning_effort": "low"}
    return {}


def openai_thinking_candidates(*, model: str, base_url: str, thinking: str) -> list[dict[str, Any]]:
    """按偏好排列的思考字段候选；最后一个总是 ``{}``（不加字段）。"""
    host = hostname(base_url)
    level = normalize_thinking(thinking)
    if level == "auto":
        auto = _auto_openai_thinking(model=model, host=host)
        return [auto, {}] if auto else [{}]
    candidates: list[dict[str, Any]]
    if host == "dashscope.aliyuncs.com":
        if level == "off":
            candidates = [{"enable_thinking": False}]
        else:
            candidates = [{"enable_thinking": True, "thinking_budget": THINKING_BUDGET_TOKENS[level]}]
    elif host == "open.bigmodel.cn":
        if level == "off":
            # 部分 GLM 关不掉思考，退到最低档。
            candidates = [{"thinking": {"type": "disabled"}}, {"reasoning_effort": "low"}]
        else:
            candidates = [{"reasoning_effort": level}]
    elif host == "api.openai.com":
        effort = {"off": "none", "max": "xhigh"}.get(level, level)
        candidates = [{"reasoning_effort": effort}]
        if level == "off":
            candidates.append({"reasoning_effort": "minimal"})
        if level == "max":
            candidates.append({"reasoning_effort": "high"})
    else:
        effort = {"off": "none", "max": "high"}.get(level, level)
        candidates = [{"reasoning_effort": effort}]
    return [*candidates, {}]


# ---------------------------------------------------------------------------
# Anthropic 协议
# ---------------------------------------------------------------------------


def anthropic_normalize_base_url(base_url: str) -> str:
    normalized = (base_url or DEFAULT_ANTHROPIC_BASE_URL).strip().rstrip("/")
    if normalized.endswith("/messages"):
        normalized = normalized[: -len("/messages")]
    return normalized


def anthropic_messages_url(base_url: str) -> str:
    return f"{anthropic_normalize_base_url(base_url)}/messages"


def anthropic_headers(api_key: str) -> dict[str, str]:
    headers = {"Content-Type": "application/json", "anthropic-version": ANTHROPIC_VERSION}
    if api_key.strip():
        headers["x-api-key"] = api_key.strip()
    return headers


def anthropic_thinking_candidates(thinking: str) -> list[dict[str, Any]]:
    """新模型用自适应思考 + effort；旧模型只认 budget_tokens；都不认就不开。"""
    level = normalize_thinking(thinking)
    if level in {"auto", "off"}:
        return [{}]
    return [
        {"thinking": {"type": "adaptive"}, "output_config": {"effort": level}},
        {"thinking": {"type": "enabled", "budget_tokens": THINKING_BUDGET_TOKENS[level]}},
        {},
    ]


def _json_instruction(response_format: dict[str, Any] | None) -> str:
    if not isinstance(response_format, dict):
        return ""
    kind = str(response_format.get("type", "") or "").strip().lower()
    if kind == "json_object":
        return "只输出一个 JSON 对象，不要输出 JSON 以外的任何内容。"
    if kind == "json_schema":
        schema = (response_format.get("json_schema") or {}).get("schema")
        if isinstance(schema, dict):
            return (
                "只输出一个 JSON 对象，不要输出 JSON 以外的任何内容。这个对象必须符合下面的 JSON Schema：\n"
                + json.dumps(schema, ensure_ascii=False)
            )
        return "只输出一个 JSON 对象，不要输出 JSON 以外的任何内容。"
    return ""


def anthropic_body(
    *,
    model: str,
    messages: list[dict[str, Any]],
    temperature: float,
    response_format: dict[str, Any] | None,
    thinking_fields: dict[str, Any],
) -> dict[str, Any]:
    """OpenAI 形状的消息 → Messages API 请求体。

    - system 消息合并到顶层 ``system``；结构化输出改成 system 里的一句要求（返回的 JSON 由
      调用方照常解析，和 OpenAI 协议下 json_object 模式一样）。
    - 相邻同角色消息合并（Messages API 要求 user / assistant 交替、且以 user 开头）。
    - 开思考时不传 temperature（Anthropic 要求思考时用默认温度）。
    """
    system_parts: list[str] = []
    turns: list[dict[str, str]] = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        role = str(message.get("role", "") or "")
        content = str(message.get("content", "") or "")
        if role == "system":
            if content.strip():
                system_parts.append(content)
            continue
        role = "assistant" if role == "assistant" else "user"
        if turns and turns[-1]["role"] == role:
            turns[-1]["content"] = f"{turns[-1]['content']}\n\n{content}"
        else:
            turns.append({"role": role, "content": content})
    if not turns or turns[0]["role"] != "user":
        turns.insert(0, {"role": "user", "content": "请按系统说明处理。"})
    instruction = _json_instruction(response_format)
    if instruction:
        system_parts.append(instruction)
    max_tokens = ANTHROPIC_DEFAULT_MAX_TOKENS
    budget = (thinking_fields.get("thinking") or {}).get("budget_tokens")
    if isinstance(budget, int):
        max_tokens += budget
    body: dict[str, Any] = {"model": model, "max_tokens": max_tokens, "messages": turns}
    if system_parts:
        body["system"] = "\n\n".join(system_parts)
    if thinking_fields:
        body.update(thinking_fields)
    else:
        body["temperature"] = max(0.0, min(1.0, float(temperature)))
    return body


def anthropic_content(data: dict[str, Any]) -> str:
    blocks = data.get("content")
    if not isinstance(blocks, list):
        raise ValueError("Anthropic response has no content blocks.")
    text = "".join(
        str(block.get("text", "") or "")
        for block in blocks
        if isinstance(block, dict) and block.get("type") == "text"
    )
    if not text.strip():
        raise ValueError(f"Anthropic response contained no text (stop_reason={data.get('stop_reason')}).")
    return text


def anthropic_usage(data: dict[str, Any]) -> dict[str, Any] | None:
    """Messages API 的 usage → OpenAI 形状（用量统计只认这一种）。"""
    usage = data.get("usage")
    if not isinstance(usage, dict):
        return None

    def count(key: str) -> int:
        value = usage.get(key)
        return int(value) if isinstance(value, (int, float)) else 0

    cache_read = count("cache_read_input_tokens")
    prompt = count("input_tokens") + count("cache_creation_input_tokens") + cache_read
    completion = count("output_tokens")
    return {
        "prompt_tokens": prompt,
        "completion_tokens": completion,
        "total_tokens": prompt + completion,
        "prompt_cache_hit_tokens": cache_read,
        "prompt_cache_miss_tokens": prompt - cache_read,
    }


def looks_like_thinking_rejection(response_text: str) -> bool:
    text = (response_text or "").lower()
    return any(marker in text for marker in ("thinking", "reasoning", "effort", "output_config", "budget"))


__all__ = [
    "ANTHROPIC_DEFAULT_MAX_TOKENS",
    "ConnectionProfile",
    "PROTOCOLS",
    "PROTOCOL_ANTHROPIC",
    "PROTOCOL_OPENAI",
    "THINKING_LEVELS",
    "anthropic_body",
    "anthropic_content",
    "anthropic_headers",
    "anthropic_messages_url",
    "anthropic_thinking_candidates",
    "anthropic_usage",
    "clear_registered_connections",
    "looks_like_thinking_rejection",
    "normalize_protocol",
    "normalize_thinking",
    "openai_thinking_candidates",
    "register_connection",
    "register_stage_connections",
    "resolve_profile",
]
