"""模型接口的线上格式：用哪种协议发请求、思考开多深。

三种协议：

- ``openai``：``POST {base_url}/chat/completions`` + ``Authorization: Bearer``。DeepSeek、Qwen、
  智谱、OpenAI 以及各种中转都走这个，是默认值。
- ``openai_responses``：``POST {base_url}/responses`` + ``Authorization: Bearer``（OpenAI Responses
  API）。system 放 ``instructions``、其余消息放 ``input``，思考深度是 ``reasoning.effort``，结构化输出
  在 ``text.format``，返回的是 ``output`` 条目列表。第三方支持参差不齐，服务商明确支持才切过去。
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

消息可以带图片（2026-11-22）：``content`` 是字符串，或者 OpenAI Chat 写法的片段列表
``[{"type": "text", "text": …}, {"type": "image_url", "image_url": {"url": "data:image/png;base64,…"}}]``
（用 ``text_part`` / ``image_part`` 拼）。OpenAI Chat 原样发；Responses 换成 ``input_text`` / ``input_image``，
Anthropic 换成 ``text`` / ``image``（base64 或网址）。system 消息只取文字。
"""
from __future__ import annotations

import base64
import json
import os
import re
import threading
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse


PROTOCOL_OPENAI = "openai"
PROTOCOL_OPENAI_RESPONSES = "openai_responses"
PROTOCOL_ANTHROPIC = "anthropic"
# 下面两个元组的取值和 Rust 的 TRANSLATION_API_PROTOCOLS / TRANSLATION_THINKING_LEVELS 由测试对齐，
# 保持字面量写法。
PROTOCOLS = ("openai", "openai_responses", "anthropic")

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
# 服务商明确拒过 temperature 的 (base_url, model)：记下来，后面的请求一开始就不带，
# 不然一本书几百个请求每个都要先挨一次 400 再重试。
_TEMPERATURE_REJECTED: set[tuple[str, str]] = set()


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
        _TEMPERATURE_REJECTED.clear()
        _THINKING_REJECTED.clear()


# 文档写明不收 temperature 的 Claude 模型（发了就 400）：一开始就不带。以前全靠第一次挨 400 后记下来，可一本书开头
# 几路请求是同时发的，每个任务都有 4—9 个请求先挨 400 再重发（2026-10-30 claude-haiku-5-5）。别的模型照旧挨一次再记住。
_NO_TEMPERATURE_MODEL_RE = re.compile(r"claude-(?:opus-5|opus-4-[78]|fable-5|haiku-5-5)")


def temperature_rejected(*, base_url: str, model: str) -> bool:
    if _NO_TEMPERATURE_MODEL_RE.search(str(model or "").lower()):
        return True
    with _PROFILES_LOCK:
        return _profile_key(base_url, model) in _TEMPERATURE_REJECTED


def remember_temperature_rejected(*, base_url: str, model: str) -> None:
    with _PROFILES_LOCK:
        _TEMPERATURE_REJECTED.add(_profile_key(base_url, model))


# 服务商拒过的思考字段组合（(base_url, model) → 那组字段的 JSON）：后面的请求不再先试它，免得每个请求先挨一次 400
_THINKING_REJECTED: set[tuple[tuple[str, str], str]] = set()


def _thinking_key(fields: dict[str, Any]) -> str:
    return json.dumps(fields, sort_keys=True, ensure_ascii=False)


def remember_thinking_rejected(*, base_url: str, model: str, fields: dict[str, Any]) -> None:
    if not fields:
        return
    with _PROFILES_LOCK:
        _THINKING_REJECTED.add((_profile_key(base_url, model), _thinking_key(fields)))


def without_rejected_thinking(candidates: list[dict[str, Any]], *, base_url: str, model: str) -> list[dict[str, Any]]:
    """去掉这个模型拒过的思考字段组合；最后一组（什么都不加）总留着。"""
    key = _profile_key(base_url, model)
    with _PROFILES_LOCK:
        kept = [c for c in candidates if not c or (key, _thinking_key(c)) not in _THINKING_REJECTED]
    return kept or [{}]


def registered_profile(*, base_url: str, model: str) -> ConnectionProfile | None:
    """阶段入口登记过的连接配置；没登记过是 None（``resolve_profile`` 会退到 OpenAI 协议，分不出来）。"""
    with _PROFILES_LOCK:
        return _PROFILES.get(_profile_key(base_url, model))


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
# OpenAI Responses 协议
# ---------------------------------------------------------------------------


def responses_url(base_url: str) -> str:
    """地址填到 ``/v1`` 为止；误填了完整的 ``/responses`` 或 ``/chat/completions`` 也认。"""
    normalized = str(base_url or "").strip().rstrip("/")
    for suffix in ("/responses", "/chat/completions"):
        if normalized.endswith(suffix):
            normalized = normalized[: -len(suffix)]
            break
    return f"{normalized}/responses"


def responses_thinking_candidates(*, model: str, base_url: str, thinking: str) -> list[dict[str, Any]]:
    """``reasoning.effort`` 候选。不同模型认的档位不同（``none`` / ``minimal`` / ``xhigh`` 都不是
    人人都有），所以 off 和 max 各多给一档退路；最后一个总是「不加字段」。

    ``auto`` 沿用 Chat 协议下实测过的规则（``_auto_openai_thinking``），换成 effort 的写法：
    DashScope 的 qwen3.8-flash 在 /responses 下同样默认思考，effort=none 实测能关掉（1 秒 vs 3 秒多）。
    """
    level = normalize_thinking(thinking)
    if level == "auto":
        auto = _auto_openai_thinking(model=model, host=hostname(base_url))
        if auto.get("enable_thinking") is False:
            return [{"reasoning": {"effort": "none"}}, {}]
        if auto.get("reasoning_effort"):
            return [{"reasoning": {"effort": auto["reasoning_effort"]}}, {}]
        return [{}]
    efforts = {
        "off": ["none", "minimal"],
        "max": ["xhigh", "high"],
    }.get(level, [level])
    return [*({"reasoning": {"effort": effort}} for effort in efforts), {}]


def _responses_text_format(response_format: dict[str, Any] | None) -> dict[str, Any] | None:
    """Chat Completions 的 ``response_format`` → Responses 的 ``text.format``（json_schema 拍平一层）。"""
    if not isinstance(response_format, dict):
        return None
    kind = str(response_format.get("type", "") or "").strip().lower()
    if kind == "json_object":
        return {"type": "json_object"}
    if kind == "json_schema":
        spec = response_format.get("json_schema") or {}
        schema = spec.get("schema")
        if not isinstance(schema, dict):
            return {"type": "json_object"}
        fmt: dict[str, Any] = {"type": "json_schema", "name": str(spec.get("name") or "response"), "schema": schema}
        if "strict" in spec:
            fmt["strict"] = bool(spec["strict"])
        return fmt
    return None


def strict_json_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """一份 JSON Schema → OpenAI strict 结构化输出认的写法（2026-11-23，#163）。

    strict 要求每层对象 ``additionalProperties: false``、``properties`` 里的每个键都列进 ``required``；可选字段只能写成
    「必填、但可以是 null」。这里把原来不在 ``required`` 里的字段改成可为 null（``type`` 加上 ``"null"``，有 ``enum`` 的
    也加上 ``None``），意思不变：交回 null 就是没写。原 schema 不动，交回一份新的。"""
    copied = json.loads(json.dumps(schema))

    def nullable(node: Any) -> Any:
        if not isinstance(node, dict):
            return node
        kind = node.get("type")
        if isinstance(kind, str):
            node["type"] = [kind, "null"] if kind != "null" else kind
        elif isinstance(kind, list):
            if "null" not in kind:
                node["type"] = [*kind, "null"]
        else:
            return {"anyOf": [node, {"type": "null"}]}
        if isinstance(node.get("enum"), list) and None not in node["enum"]:
            node["enum"] = [*node["enum"], None]
        return node

    def close(node: Any) -> None:
        # 按 schema 的结构走（properties / items / anyOf 等），不按键名乱扫：字段名正好叫 type、properties 也不会认错
        if not isinstance(node, dict):
            return
        properties = node.get("properties")
        if node.get("type") == "object" or isinstance(properties, dict):
            properties = properties if isinstance(properties, dict) else {}
            node["properties"] = properties
            node["additionalProperties"] = False
            required = set(node.get("required") or [])
            for key in list(properties):
                close(properties[key])
                if key not in required:
                    properties[key] = nullable(properties[key])
            node["required"] = list(properties)
        close(node.get("items"))
        for keyword in ("anyOf", "oneOf", "allOf", "prefixItems"):
            for child in node.get(keyword) or []:
                close(child)
        for keyword in ("$defs", "definitions"):
            for child in (node.get(keyword) or {}).values():
                close(child)

    close(copied)
    return copied


# Responses 协议下用 json_object 时，OpenAI 要求 ``input`` 里出现 json 这个词（``instructions`` 里的不算），否则 400
# 「Response input messages must contain the word 'json' in some form」（2026-11-23，#163）。只在 text.format 是
# json_object 时往 input 最前面加一条 developer 消息；json_schema 和不要 JSON 的请求一个字节都不变。
RESPONSES_JSON_OBJECT_NOTE = "只输出一个 JSON 对象（json），不要输出 JSON 以外的任何内容。"


def _responses_json_object_note(requested_format: dict[str, Any] | None) -> str:
    """退到 json_object 时给模型的那句要求：原来要的是 json_schema 就把 schema 附上（text.format 里已经没有它了）。"""
    if isinstance(requested_format, dict) and str(requested_format.get("type", "") or "").strip().lower() == "json_schema":
        schema = (requested_format.get("json_schema") or {}).get("schema")
        if isinstance(schema, dict):
            return f"{RESPONSES_JSON_OBJECT_NOTE}这个对象必须符合下面的 JSON Schema：\n{json.dumps(schema, ensure_ascii=False)}"
    return RESPONSES_JSON_OBJECT_NOTE


IMAGE_MEDIA_TYPES =("image/png", "image/jpeg", "image/webp", "image/gif")
_DATA_URL_RE = re.compile(r"^data:(?P<media>[\w./+-]+);base64,(?P<data>.*)$", re.S)


def text_part(text: str) -> dict[str, Any]:
    return {"type": "text", "text": str(text)}


def image_part(data: bytes, media_type: str = "image/png") -> dict[str, Any]:
    """一张图 → 消息片段（OpenAI Chat 写法，data URL）。"""
    media_type = str(media_type or "").lower()
    if media_type not in IMAGE_MEDIA_TYPES:
        raise ValueError(f"unsupported image type {media_type!r}; use one of {', '.join(IMAGE_MEDIA_TYPES)}")
    return {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{base64.b64encode(data).decode('ascii')}"}}


def _parts(content: Any) -> list[dict[str, Any]]:
    """消息内容 → 片段列表（字符串当一段文字）。认不出的片段丢掉。"""
    if isinstance(content, list):
        return [part for part in content if isinstance(part, dict)]
    text = "" if content is None else str(content)
    return [text_part(text)] if text else []


def _image_url(part: dict[str, Any]) -> str:
    image = part.get("image_url")
    return str((image or {}).get("url") if isinstance(image, dict) else image or "")


def content_text(content: Any) -> str:
    """消息内容里的文字（图片不算）：system 消息、字数统计用。"""
    if not isinstance(content, list):
        return "" if content is None else str(content)
    return "\n\n".join(str(part.get("text") or "") for part in _parts(content) if part.get("type") == "text")


EXECUTOR_MAX_IMAGES = 4


def executor_accepts_images(messages: list[dict[str, Any]]) -> bool:
    """Rust 模型执行器收的图：只在用户消息里、只收 data URL（png/jpeg/webp/gif）、一次最多 4 张。
    大小和 base64 由执行器再查（``model_executor/policy.rs``）。"""
    count = 0
    for message in messages:
        content = message.get("content") if isinstance(message, dict) else None
        if not isinstance(content, list):
            continue
        for part in content:
            if not isinstance(part, dict) or part.get("type") != "image_url":
                continue
            url = _image_url(part)
            if message.get("role") != "user" or not any(
                url.startswith(f"data:{media};base64,") for media in IMAGE_MEDIA_TYPES
            ):
                return False
            count += 1
    return count <= EXECUTOR_MAX_IMAGES


def has_images(messages: list[dict[str, Any]]) -> bool:
    return any(
        part.get("type") == "image_url"
        for message in messages
        if isinstance(message, dict) and isinstance(message.get("content"), list)
        for part in _parts(message["content"])
    )


def responses_message_content(content: Any) -> Any:
    """一条消息的内容 → Responses API 的写法：纯文字照旧是字符串，带图的换成 input_text / input_image。"""
    if not isinstance(content, list):
        return "" if content is None else str(content)
    out: list[dict[str, Any]] = []
    for part in _parts(content):
        if part.get("type") == "text":
            out.append({"type": "input_text", "text": str(part.get("text") or "")})
        elif part.get("type") == "image_url" and _image_url(part):
            out.append({"type": "input_image", "image_url": _image_url(part)})
    return out


def anthropic_message_content(content: Any) -> Any:
    """一条消息的内容 → Messages API 的写法：纯文字照旧是字符串，带图的换成 text / image 块。"""
    if not isinstance(content, list):
        return "" if content is None else str(content)
    out: list[dict[str, Any]] = []
    for part in _parts(content):
        if part.get("type") == "text":
            out.append({"type": "text", "text": str(part.get("text") or "")})
        elif part.get("type") == "image_url" and _image_url(part):
            url = _image_url(part)
            match = _DATA_URL_RE.match(url)
            if match:
                out.append({"type": "image", "source": {"type": "base64", "media_type": match["media"], "data": match["data"]}})
            else:
                out.append({"type": "image", "source": {"type": "url", "url": url}})
    return out


def _as_blocks(content: Any) -> list[dict[str, Any]]:
    return content if isinstance(content, list) else ([{"type": "text", "text": content}] if content else [])


def responses_body(
    *,
    model: str,
    messages: list[dict[str, Any]],
    temperature: float | None,
    response_format: dict[str, Any] | None,
    thinking_fields: dict[str, Any],
    requested_format: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """OpenAI 形状的消息 → Responses API 请求体。

    - system 消息合并进 ``instructions``，其余消息原样进 ``input``。
    - ``text.format`` 是 json_object（服务商不认 json_schema 退下来的，或调用方本来就要 json_object）时，``input`` 最前面
      加一条 developer 消息要 JSON（OpenAI 只在 input 里找 json 这个词）；``requested_format`` 是调用方原来要的格式，
      是 json_schema 就把 schema 写进这条消息。
    - ``store: false``：译文不在服务商那边留存。
    - 开了思考（effort 不是 none）时不传 temperature：推理模型只在不思考时才接受它。
      ``temperature=None`` 表示调用方因为服务商拒绝而去掉了它。
    - 不设 ``max_output_tokens``，和 Chat Completions 一样由服务商默认，免得思考吃掉额度后截断译文。
    """
    instructions: list[str] = []
    turns: list[dict[str, Any]] = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        role = str(message.get("role", "") or "")
        if role == "system":
            content = content_text(message.get("content"))
            if content.strip():
                instructions.append(content)
            continue
        turns.append({"role": "assistant" if role == "assistant" else "user", "content": responses_message_content(message.get("content"))})
    if not turns:
        turns.append({"role": "user", "content": "请按系统说明处理。"})
    text_format = _responses_text_format(response_format)
    if text_format is not None and text_format.get("type") == "json_object":
        note = _responses_json_object_note(requested_format or response_format)
        turns.insert(0, {"role": "developer", "content": note})
    body: dict[str, Any] = {"model": model, "input": turns, "store": False}
    if instructions:
        body["instructions"] = "\n\n".join(instructions)
    if text_format is not None:
        body["text"] = {"format": text_format}
    if thinking_fields:
        body.update(thinking_fields)
    effort = str((thinking_fields.get("reasoning") or {}).get("effort", "none") or "none")
    if temperature is not None and effort == "none":
        body["temperature"] = temperature
    return body


def responses_content(data: dict[str, Any]) -> str:
    """拼出 ``output`` 里所有 message 的 ``output_text``；拒答、未完成、出错都抛 ValueError（会重试）。"""
    error = data.get("error")
    if isinstance(error, dict) and error:
        raise ValueError(f"Responses API error: {error.get('code') or ''} {error.get('message') or ''}".strip())
    texts: list[str] = []
    refusals: list[str] = []
    for item in data.get("output") or []:
        if not isinstance(item, dict) or item.get("type") != "message":
            continue
        for part in item.get("content") or []:
            if not isinstance(part, dict):
                continue
            if part.get("type") == "output_text":
                texts.append(str(part.get("text", "") or ""))
            elif part.get("type") == "refusal":
                refusals.append(str(part.get("refusal", "") or ""))
    text = "".join(texts)
    if text.strip():
        return text
    if refusals:
        raise ValueError(f"Responses API refused: {' '.join(refusals)[:200]}")
    reason = (data.get("incomplete_details") or {}).get("reason") if isinstance(data.get("incomplete_details"), dict) else None
    raise ValueError(f"Responses API returned no text (status={data.get('status')}, reason={reason}).")


def responses_usage(data: dict[str, Any]) -> dict[str, Any] | None:
    """Responses 的 usage → OpenAI Chat 形状（用量统计只认这一种）。"""
    usage = data.get("usage")
    if not isinstance(usage, dict):
        return None

    def count(source: Any, key: str) -> int:
        value = source.get(key) if isinstance(source, dict) else None
        return int(value) if isinstance(value, (int, float)) else 0

    prompt = count(usage, "input_tokens")
    completion = count(usage, "output_tokens")
    cached = count(usage.get("input_tokens_details"), "cached_tokens")
    mapped: dict[str, Any] = {
        "prompt_tokens": prompt,
        "completion_tokens": completion,
        "total_tokens": count(usage, "total_tokens") or prompt + completion,
        "prompt_cache_hit_tokens": cached,
        "prompt_cache_miss_tokens": prompt - cached,
    }
    reasoning = count(usage.get("output_tokens_details"), "reasoning_tokens")
    if reasoning:
        mapped["completion_tokens_details"] = {"reasoning_tokens": reasoning}
    return mapped


# 服务商拒 temperature 时的说法，比如 OpenAI「'temperature' is not supported with this model」
# 「Only the default (1) value is supported」、Anthropic「`temperature` is deprecated for this model」。
_TEMPERATURE_REJECTION_WORDS = (
    "deprecat",
    "unsupported",
    "not supported",
    "does not support",
    "not allowed",
    "only the default",
    "cannot",
)


def looks_like_temperature_rejection(response_text: str) -> bool:
    """光出现 temperature 这个词不算（比如网关把支持的参数列一遍）：误判一次，这个模型在进程里就再也不带
    temperature 了。要同时有「不支持 / 已弃用」这类拒绝的说法。"""
    text = (response_text or "").lower()
    return "temperature" in text and any(word in text for word in _TEMPERATURE_REJECTION_WORDS)


# ---------------------------------------------------------------------------
# Anthropic 协议
# ---------------------------------------------------------------------------


def anthropic_normalize_base_url(base_url: str) -> str:
    """地址填到 ``/v1`` 为止；也认官方 SDK 的写法（不带 ``/v1``，如 ``https://api.anthropic.com``，
    兼容服务的 ``https://x.example.com/anthropic`` 同理），以及误填的完整 ``/v1/messages``。
    以前不带 ``/v1`` 时会请求到 ``…/messages``，Anthropic 回 404。"""
    normalized = ((base_url or "").strip() or DEFAULT_ANTHROPIC_BASE_URL).rstrip("/")
    if normalized.endswith("/messages"):
        normalized = normalized[: -len("/messages")]
    if not normalized.endswith("/v1"):
        normalized = f"{normalized}/v1"
    return normalized


def anthropic_messages_url(base_url: str) -> str:
    return f"{anthropic_normalize_base_url(base_url)}/messages"


def anthropic_headers(api_key: str) -> dict[str, str]:
    headers = {"Content-Type": "application/json", "anthropic-version": ANTHROPIC_VERSION}
    if api_key.strip():
        headers["x-api-key"] = api_key.strip()
    return headers


# 「自动」档实测过的 Anthropic 模型：claude-haiku-5-5 不发思考字段就按 medium 思考，low 质量一样、输出少三成（2026-10-31，
# 量子化学-14 输出 8.6 万 → 5.9 万 token）
_AUTO_LOW_EFFORT_ANTHROPIC_MODELS = ("claude-haiku-5-5",)


def anthropic_thinking_candidates(thinking: str, *, model: str = "") -> list[dict[str, Any]]:
    """新模型用自适应思考 + effort；旧模型只认 budget_tokens；都不认就不开。

    ``off`` 发 effort 最低档的自适应思考：以前什么都不发，可 Claude Haiku 5.5 这些新模型不发就按默认 effort（medium）思考——
    2026-10-31 Jensen 第 12 章 6.4 万输出 token 里约一半是思考，"关了思考"其实没关。试过 ``thinking: {type: disabled}``：
    量子化学-14 有 5 个短标题（"EXAMPLE"、"We have"）被原样交回不翻；low 档质量和 medium 一样（还少了一处句首漏译的
    "where"），输出少三成，模型遇到简单的块自己就不想。官方迁移指南也说用 effort 调、不要用 disabled。
    不认自适应思考的旧模型（本来就不默认思考）挨一次 400 后退到什么都不加，并记住（``remember_thinking_rejected``）。"""
    level = normalize_thinking(thinking)
    if level == "auto" and not any(name in str(model or "").lower() for name in _AUTO_LOW_EFFORT_ANTHROPIC_MODELS):
        return [{}]
    if level in {"auto", "off"}:
        return [{"thinking": {"type": "adaptive"}, "output_config": {"effort": "low"}}, {}]
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
    temperature: float | None,
    response_format: dict[str, Any] | None,
    thinking_fields: dict[str, Any],
) -> dict[str, Any]:
    """OpenAI 形状的消息 → Messages API 请求体。

    - system 消息合并到顶层 ``system``；结构化输出改成 system 里的一句要求（返回的 JSON 由
      调用方照常解析，和 OpenAI 协议下 json_object 模式一样）。
    - 相邻同角色消息合并（Messages API 要求 user / assistant 交替、且以 user 开头）。
    - 开思考时不传 temperature（Anthropic 要求思考时用默认温度）；``thinking: disabled`` 照常传。``temperature=None`` 表示调用方
      因为服务商拒绝而去掉了它（新模型如 claude-opus-5-5 已不再接受 temperature）。
    """
    system_parts: list[str] = []
    turns: list[dict[str, Any]] = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        role = str(message.get("role", "") or "")
        if role == "system":
            text = content_text(message.get("content"))
            if text.strip():
                system_parts.append(text)
            continue
        content = anthropic_message_content(message.get("content"))
        role = "assistant" if role == "assistant" else "user"
        if turns and turns[-1]["role"] == role:
            previous = turns[-1]["content"]
            if isinstance(previous, str) and isinstance(content, str):
                turns[-1]["content"] = f"{previous}\n\n{content}"
            else:
                # 带图的消息并成块列表
                turns[-1]["content"] = _as_blocks(previous) + _as_blocks(content)
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
        body["system"] = anthropic_system_blocks(system_parts)
    if thinking_fields:
        body.update(thinking_fields)
    thinking_on = bool(thinking_fields) and (thinking_fields.get("thinking") or {}).get("type") != "disabled"
    if temperature is not None and not thinking_on:
        # 关思考（``disabled``）时和不发思考字段一样可以带 temperature
        body["temperature"] = max(0.0, min(1.0, float(temperature)))
    return body


# 提示词缓存：第一段 system 够长就打缓存断点。翻译请求的第一段是全书不变的规则（规则、中文体例、输出格式、公式规则，
# 见 prompt_protocols.protocol_system_parts），第二段才是领域指导和按批检索的记忆。一本书一百多个请求共用第一段：
# 缓存读按一折计费、不计入每分钟输入 token 限额。Claude Haiku 5.5 等新模型最短 512 token 才缓存，短了不报错、只是不缓存；
# 按字数粗估（中文一字约一个 token），太短的不打标记，省得白付写入的 1.25 倍。RETAIN_TRANSLATION_PROMPT_CACHE=off 关掉。
PROMPT_CACHE_MIN_CHARS = 800  # 单块请求的规则段 1138 字（约 880 token），以前设 1200 字一个都没缓存上
PROMPT_CACHE_ENV = "RETAIN_TRANSLATION_PROMPT_CACHE"


def prompt_cache_enabled() -> bool:
    return str(os.environ.get(PROMPT_CACHE_ENV, "") or "").strip().lower() not in {"0", "off", "false", "no"}


def merge_system_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """相邻的几条 system 消息并成一条（用空行连），给 OpenAI 兼容协议：有的服务商只收一条 system。
    不变的规则在前，服务商按前缀的隐式缓存（如 DashScope）照样能命中。"""
    merged: list[dict[str, Any]] = []
    for message in messages:
        if (
            merged
            and isinstance(message, dict)
            and message.get("role") == "system"
            and merged[-1].get("role") == "system"
            and isinstance(message.get("content"), str)
            and isinstance(merged[-1].get("content"), str)
        ):
            merged[-1] = {**merged[-1], "content": f"{merged[-1]['content']}\n\n{message['content']}"}
        else:
            merged.append(message)
    return merged


def anthropic_system_blocks(system_parts: list[str]) -> list[dict[str, Any]] | str:
    """system 各段 → Messages API 的 text 块，第一段打 ``cache_control``。关了缓存、或第一段太短不值得缓存时，照旧拼成一个字符串。"""
    if not prompt_cache_enabled() or len(system_parts[0]) < PROMPT_CACHE_MIN_CHARS:
        return "\n\n".join(system_parts)
    blocks: list[dict[str, Any]] = [{"type": "text", "text": part} for part in system_parts]
    blocks[0]["cache_control"] = {"type": "ephemeral"}
    return blocks


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
    cache_write = count("cache_creation_input_tokens")
    prompt = count("input_tokens") + cache_write + cache_read
    completion = count("output_tokens")
    return {
        "prompt_tokens": prompt,
        "completion_tokens": completion,
        "total_tokens": prompt + completion,
        "prompt_cache_hit_tokens": cache_read,
        "prompt_cache_miss_tokens": prompt - cache_read,
        # 写缓存按更高的单价计费，台账单独记（见 usage_ledger）。
        "prompt_cache_write_tokens": cache_write,
    }


def looks_like_thinking_rejection(response_text: str) -> bool:
    text = (response_text or "").lower()
    # chat_template_kwargs：通用开关和自定义地址上的 Qwen3 会发它，严格的服务回「Extra inputs are not permitted」时报错里只有这个字段名
    return any(marker in text for marker in ("thinking", "reasoning", "effort", "output_config", "budget", "chat_template_kwargs"))


# ---------------------------------------------------------------------------
# 档位表：这个模型有哪些思考档位、每一档怎么换成请求字段（2026-11-26，阅读页提问的思考强度）
# ---------------------------------------------------------------------------
#
# 上面的 ``*_thinking_candidates`` 按设置里统一的 auto / off / low / medium / high / max 换字段（翻译用）；这里反过来按模型列它
# 实际有的档位（Claude 是 effort 的 low…max，Qwen、DeepSeek 只有开关，GPT 是 reasoning_effort 的 minimal…high），档位名用模型那边的原名。
# 每一档的字段尽量直接取上面那几个函数的结果，不另写一套；``by_setting`` 把设置里的档位换成这个模型的档位，规则：
#
# - 设置那一档的候选字段按顺序找，第一个和某一档的首选字段相同的就是它（OpenAI 的 off 先试 none、不认再试 minimal，
#   GPT-5 没有 none，就落到 minimal）；
# - Qwen、DeepSeek 只有开关：off 是关，其余都是开（``_switch_menu``）；
# - 设置是 auto 而这个模型没有实测规则（什么字段都不加）时，报服务商不带字段时的默认档（``default``），请求照旧什么都不加。
#
# 认不出的模型（不是 Claude、GPT，也不是 DashScope、DeepSeek、智谱的地址）没有档位表（``None``），调用方不报这一项。

# Claude 有 xhigh 这一档的模型（Opus 4.7 起；Opus 4.6、Sonnet 4.6 只有 low / medium / high / max）。来源：Claude API 文档的思考档位表，
# 2026-11-26 查。按子串认：claude-opus-5 也认 claude-opus-5-5。retainpdf-pi 的 models.json 里有同样的名单（acp/pi.rs），测试对齐。
ANTHROPIC_XHIGH_MODELS = (
    "claude-fable-5",
    "claude-mythos-5",
    "claude-opus-5",
    "claude-opus-4-7",
    "claude-opus-4-8",
    "claude-sonnet-5",
    "claude-haiku-5-5",
)
# 不发思考字段也按自适应思考的 Claude（同一份文档：「Omitting thinking → runs adaptive」）。别的 Claude（Opus 4.6—4.8、Sonnet 4.6、
# 更老的）不发就不思考，所以档位表多一档 off（什么都不加）。pi.rs 里有同样的名单。
ANTHROPIC_THINKS_BY_DEFAULT_MODELS = (
    "claude-fable-5",
    "claude-mythos-5",
    "claude-opus-5",
    "claude-sonnet-5",
    "claude-haiku-5-5",
)
# 不发 effort 时默认 medium 的 Claude（其余默认 high）。claude-haiku-5-5 这一条和上面「自动」档的实测一致。
ANTHROPIC_MEDIUM_DEFAULT_MODELS = ("claude-opus-5-5", "claude-haiku-5-5")

_GPT_SERIES_RE = re.compile(r"(?:^|/)(?P<name>o[134](?:-|$)|gpt-5(?P<minor>\.\d+)?)")


@dataclass(frozen=True)
class ThinkingLevel:
    """一档：``value`` 是模型那边的档位名（也当显示名，不翻译），``candidates`` 是按偏好排列的请求字段，最后一个总是 ``{}``。"""

    value: str
    candidates: tuple[dict[str, Any], ...]


@dataclass(frozen=True)
class ThinkingMenu:
    """一个模型的档位表。``levels`` 从弱到强；``by_setting`` 把设置里的 auto / off / low / medium / high / max 换成其中一档。"""

    levels: tuple[ThinkingLevel, ...]
    by_setting: tuple[tuple[str, str], ...]

    def values(self) -> list[str]:
        return [level.value for level in self.levels]

    def level_for(self, setting: Any) -> str:
        return dict(self.by_setting)[normalize_thinking(setting)]

    def candidates(self, value: str) -> list[dict[str, Any]]:
        """这一档的请求字段候选（拷贝）；没有这一档抛 KeyError。"""
        for level in self.levels:
            if level.value == value:
                return json.loads(json.dumps(list(level.candidates)))
        raise KeyError(value)


def _level(value: str, *fields: dict[str, Any]) -> ThinkingLevel:
    return ThinkingLevel(value=value, candidates=(*fields, {}))


def _menu(levels: list[ThinkingLevel], setting_candidates, *, default: str) -> ThinkingMenu:
    """按开头说的规则配 ``by_setting``。``setting_candidates(设置档位)`` 是翻译那边按设置换字段的函数。"""
    firsts = {_thinking_key(level.candidates[0]): level.value for level in levels}
    mapping: list[tuple[str, str]] = []
    for setting in THINKING_LEVELS:
        # 候选都对不上（最后落到什么都不加）就是服务商的默认档；什么都不加本身是一档的（不发就不思考的 Claude 的 off）直接对上
        chosen = next((firsts[_thinking_key(fields)] for fields in setting_candidates(setting) if _thinking_key(fields) in firsts), default)
        mapping.append((setting, chosen))
    return ThinkingMenu(levels=tuple(levels), by_setting=tuple(mapping))


def _anthropic_menu(model: str) -> ThinkingMenu:
    name = str(model or "").lower()
    levels: list[ThinkingLevel] = []
    if not any(item in name for item in ANTHROPIC_THINKS_BY_DEFAULT_MODELS):
        levels.append(_level("off"))
    for effort in ("low", "medium", "high"):
        levels.append(ThinkingLevel(effort, tuple(anthropic_thinking_candidates(effort, model=model))))
    if any(item in name for item in ANTHROPIC_XHIGH_MODELS):
        levels.append(_level(
            "xhigh",
            {"thinking": {"type": "adaptive"}, "output_config": {"effort": "xhigh"}},
            {"thinking": {"type": "adaptive"}, "output_config": {"effort": "high"}},
        ))
    levels.append(ThinkingLevel("max", tuple(anthropic_thinking_candidates("max", model=model))))
    default = "medium" if any(item in name for item in ANTHROPIC_MEDIUM_DEFAULT_MODELS) else "high"
    return _menu(levels, lambda setting: anthropic_thinking_candidates(setting, model=model), default=default)


def _gpt_efforts(model: str) -> tuple[list[str], str] | None:
    """OpenAI 推理模型的 reasoning_effort 档位和不传时的默认档：o1 / o3 / o4 是 low…high（默认 medium）；GPT-5 是 minimal…high
    （默认 medium）；GPT-5.1 起是 none…xhigh（默认 none）。认不出（gpt-4o 这类不推理的）是 None。"""
    match = _GPT_SERIES_RE.search(str(model or "").lower())
    if not match:
        return None
    if match["name"].startswith("o"):
        return ["low", "medium", "high"], "medium"
    if match["minor"]:
        return ["none", "low", "medium", "high", "xhigh"], "none"
    return ["minimal", "low", "medium", "high"], "medium"


def _switch_menu(off: tuple[dict[str, Any], ...], on: tuple[dict[str, Any], ...], *, auto: str) -> ThinkingMenu:
    """只有开关的模型（Qwen、DeepSeek）：off 是关，low…max 都是开；auto 按实测规则或服务商默认。``off`` / ``on`` 是按偏好排的字段候选。"""
    levels = [_level("off", *off), _level("on", *on)]
    mapping = (("auto", auto), ("off", "off"), *((setting, "on") for setting in ("low", "medium", "high", "max")))
    return ThinkingMenu(levels=tuple(levels), by_setting=mapping)


def _is_hybrid_qwen3(name: str) -> bool:
    """能开关思考的 Qwen3（名字带 qwen3，大小写不管，比如用户自定义的 Qwen3.8-27B-Uncensored）。2507 起分出来的 Instruct（不思考）、
    Thinking（关不掉）和 Coder 没有开关，不算。"""
    return "qwen3" in name and not re.search(r"instruct|thinking|coder", name)


def _qwen3_switch(on: bool) -> tuple[dict[str, Any], ...]:
    """Qwen3 开关思考的字段：vLLM、SGLang、llama.cpp 这些自己部署的认 ``chat_template_kwargs.enable_thinking``，DashScope 和照它写的中转认
    顶层 ``enable_thinking``。不认的字段这些服务一般忽略，所以先两个一起发；严格的服务回 400 再一个一个试，最后不加。"""
    return (
        {"enable_thinking": on, "chat_template_kwargs": {"enable_thinking": on}},
        {"chat_template_kwargs": {"enable_thinking": on}},
        {"enable_thinking": on},
    )


def _generic_switch(on: bool) -> tuple[dict[str, Any], ...]:
    """认不出的模型（OpenAI Chat 协议、不是 api.openai.com）给一个通用开关（2026-11-27 用户定「加入」）。不知道服务认哪种写法，
    挑几种常见的：顶层 ``enable_thinking``（DashScope 和照它写的中转）、``chat_template_kwargs`` 的 ``enable_thinking`` / ``thinking``
    （vLLM、SGLang、llama.cpp 上的 Qwen3、GLM、DeepSeek 混合思考模型）；关的时候再带 ``reasoning_effort: none``（Ollama 等）。
    先一起发，回 400 再少发几样，最后不加。服务一般忽略不认的字段，所以模型本身不思考、或服务不认这些写法时，这个开关不起作用。"""
    template = {"chat_template_kwargs": {"enable_thinking": on, "thinking": on}}
    candidates: list[dict[str, Any]] = []
    if not on:
        candidates.append({"enable_thinking": False, **template, "reasoning_effort": "none"})
    candidates += [{"enable_thinking": on, **template}, template, {"enable_thinking": on}]
    return tuple(candidates)


def thinking_menu(*, protocol: Any, model: str, base_url: str) -> ThinkingMenu | None:
    """这个连接（协议 + 地址 + 模型）的思考档位表；认不出是 None。``base_url`` 要传实际用的地址（OpenAI 协议没填时调用方的默认地址）。

    - Anthropic：low / medium / high / max，Opus 4.7 起的新模型多 xhigh；不发就不思考的模型多 off（什么都不加）。
      设置的 off 和以前一样换成 low（见 ``anthropic_thinking_candidates``）。
    - DashScope（Qwen）：off / on（``enable_thinking``）。auto 对 qwen3.8-flash 是 off（实测规则），其余按开（服务商默认）。
    - DeepSeek：off / on（``thinking.type``）。auto 不加字段：名字带 reasoner 的按开，其余按关（服务商默认）。
    - 智谱：off / low / medium / high / max（``reasoning_effort``；关思考是 ``thinking.type = disabled``，关不掉的退到 low）。
    - 别的地址上的 Qwen3（按模型名认，自己部署或中转的；2026-11-27）：off / on，见 ``_qwen3_switch``。auto 不加字段，按 Qwen3 默认开。
    - GPT（按模型名认，OpenAI Chat 和 Responses 都是）：见 ``_gpt_efforts``。
    - 别的（OpenAI Chat 协议、地址不是 api.openai.com 的认不出的模型；2026-11-27）：通用的 off / on，见 ``_generic_switch``。auto 不加字段，报 on。
      api.openai.com 上认不出的（gpt-4o 这类不推理的）和 Responses 协议上认不出的仍然是 None。
    """
    protocol = normalize_protocol(protocol)
    if protocol == PROTOCOL_ANTHROPIC:
        return _anthropic_menu(model)
    host = hostname(base_url)
    name = str(model or "").strip().lower()
    if protocol == PROTOCOL_OPENAI and host == "dashscope.aliyuncs.com":
        auto = "off" if _auto_openai_thinking(model=model, host=host).get("enable_thinking") is False else "on"
        return _switch_menu(({"enable_thinking": False},), ({"enable_thinking": True},), auto=auto)
    if protocol == PROTOCOL_OPENAI and host == "api.deepseek.com":
        return _switch_menu(({"thinking": {"type": "disabled"}},), ({"thinking": {"type": "enabled"}},),
                            auto="on" if "reasoner" in name else "off")
    if protocol == PROTOCOL_OPENAI and host == "open.bigmodel.cn":
        levels = [_level("off", {"thinking": {"type": "disabled"}}, {"reasoning_effort": "low"})]
        levels += [_level(effort, {"reasoning_effort": effort}) for effort in ("low", "medium", "high", "max")]
        # 不传时的默认：glm-5.3-flash 实测是 max（见 _auto_openai_thinking），别的 GLM 按同样算
        return _menu(levels, lambda setting: openai_thinking_candidates(model=model, base_url=base_url, thinking=setting), default="max")
    if protocol == PROTOCOL_OPENAI and _is_hybrid_qwen3(name):
        return _switch_menu(_qwen3_switch(False), _qwen3_switch(True), auto="on")
    gpt = _gpt_efforts(name)
    if gpt is None:
        if protocol == PROTOCOL_OPENAI and host != "api.openai.com":
            return _switch_menu(_generic_switch(False), _generic_switch(True), auto="on")
        return None
    efforts, default = gpt
    if protocol == PROTOCOL_OPENAI_RESPONSES:
        levels = [_level(effort, {"reasoning": {"effort": effort}}) for effort in efforts]
        return _menu(levels, lambda setting: responses_thinking_candidates(model=model, base_url=base_url, thinking=setting), default=default)
    levels = [_level(effort, {"reasoning_effort": effort}) for effort in efforts]
    return _menu(levels, lambda setting: openai_thinking_candidates(model=model, base_url=base_url, thinking=setting), default=default)


def setting_thinking_candidates(*, protocol: Any, model: str, base_url: str, thinking: Any) -> list[dict[str, Any]]:
    """按设置里的档位换字段（三种协议分派到上面各自的函数）；和翻译、问答开会话时实际发的一样。"""
    protocol = normalize_protocol(protocol)
    if protocol == PROTOCOL_ANTHROPIC:
        return anthropic_thinking_candidates(normalize_thinking(thinking), model=model)
    if protocol == PROTOCOL_OPENAI_RESPONSES:
        return responses_thinking_candidates(model=model, base_url=base_url, thinking=normalize_thinking(thinking))
    return openai_thinking_candidates(model=model, base_url=base_url, thinking=normalize_thinking(thinking))


__all__ = [
    "ANTHROPIC_DEFAULT_MAX_TOKENS",
    "ANTHROPIC_MEDIUM_DEFAULT_MODELS",
    "ANTHROPIC_THINKS_BY_DEFAULT_MODELS",
    "ANTHROPIC_XHIGH_MODELS",
    "ConnectionProfile",
    "IMAGE_MEDIA_TYPES",
    "PROTOCOLS",
    "PROTOCOL_ANTHROPIC",
    "PROTOCOL_OPENAI",
    "PROTOCOL_OPENAI_RESPONSES",
    "THINKING_LEVELS",
    "anthropic_body",
    "anthropic_content",
    "anthropic_headers",
    "anthropic_message_content",
    "anthropic_messages_url",
    "anthropic_thinking_candidates",
    "anthropic_usage",
    "clear_registered_connections",
    "content_text",
    "has_images",
    "executor_accepts_images",
    "image_part",
    "looks_like_temperature_rejection",
    "anthropic_system_blocks",
    "merge_system_messages",
    "prompt_cache_enabled",
    "remember_thinking_rejected",
    "without_rejected_thinking",
    "looks_like_thinking_rejection",
    "normalize_protocol",
    "normalize_thinking",
    "openai_thinking_candidates",
    "register_connection",
    "register_stage_connections",
    "resolve_profile",
    "RESPONSES_JSON_OBJECT_NOTE",
    "responses_body",
    "responses_content",
    "responses_message_content",
    "responses_thinking_candidates",
    "responses_url",
    "responses_usage",
    "strict_json_schema",
    "setting_thinking_candidates",
    "text_part",
    "thinking_menu",
    "ThinkingLevel",
    "ThinkingMenu",
]
