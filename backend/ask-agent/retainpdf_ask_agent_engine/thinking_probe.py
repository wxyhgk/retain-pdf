"""问服务商的接口拿思考档位（2026-11-27，用户：「我记得是可以通过 api 得到思考强度的啊」）。

能报的三家（核过文档）：

- Anthropic：``GET /v1/models/{模型}`` 的 ``capabilities``——``effort.{low,medium,high,xhigh,max}.supported``、
  ``thinking.types.{adaptive,enabled,disabled}.supported``。
- OpenRouter：``GET /api/v1/models`` 每个模型的 ``reasoning``——``supported_efforts``（从强到弱；null 是都行、没有这个键是不能选档）、
  ``default_effort``、``default_enabled``、``mandatory``（关不掉）。没有 ``reasoning`` 是不推理的模型。
- Ollama：``POST /api/show`` 的 ``thinking``——``values``（布尔是开关，字符串是档位名）、``default``；``values: [false]`` 是不思考。

别的（OpenAI 官方、DashScope、DeepSeek、智谱、vLLM、SGLang）接口里没有这项，不问，往下查我们维护的表和代码里的规则。
Ollama 只在像它的地址上问（端口 11434 或主机名带 ollama，见 ``looks_like_ollama``）。
结果是 ``model_wire.menu_from_spec`` 的写法；``{"levels": []}`` 是接口明说这个模型不思考（不报档位）。

问的时候带的就是这个连接本来就要用的地址和 key（发问题也是发给它）。超时 4 秒；结果按连接缓存在桥给的
``RETAIN_ASK_THINKING_FILE`` 同目录的 ``thinking-capabilities.json``：问到的一天、没问到的一小时，免得每次开窗口都等。
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse, urlunparse

import requests

from retainpdf_base.io import save_json_atomic
from retainpdf_translation.llm.shared import model_wire

TIMEOUT_SECONDS = 4
CACHE_FILE_NAME = "thinking-capabilities.json"
FOUND_TTL_SECONDS = 24 * 3600
MISSED_TTL_SECONDS = 3600
MAX_CACHE_ENTRIES = 200
OPENROUTER_HOST = "openrouter.ai"
OLLAMA_PORT = 11434
# 这些地址的接口没有思考档位这一项（不白问一次）
NO_CAPABILITY_HOSTS = ("api.openai.com", "dashscope.aliyuncs.com", "api.deepseek.com", "open.bigmodel.cn")
# Anthropic 档位从弱到强
ANTHROPIC_EFFORTS = ("low", "medium", "high", "xhigh", "max")


# ---- 各家 ----


def anthropic_spec(capabilities: Any) -> dict[str, Any] | None:
    """``GET /v1/models/{模型}`` 的 ``capabilities`` → 档位。没有 ``capabilities``（中转不转这一项）是 None。"""
    if not isinstance(capabilities, dict):
        return None
    thinking = capabilities.get("thinking") if isinstance(capabilities.get("thinking"), dict) else {}
    types = thinking.get("types") if isinstance(thinking.get("types"), dict) else {}

    def supported(holder: Any, key: str) -> bool:
        item = holder.get(key) if isinstance(holder, dict) else None
        return isinstance(item, dict) and bool(item.get("supported"))

    if thinking and not thinking.get("supported"):
        return {"levels": []}
    adaptive = supported(types, "adaptive")
    effort = capabilities.get("effort") if isinstance(capabilities.get("effort"), dict) else {}
    levels: list[dict[str, Any]] = []
    if supported(types, "disabled"):
        levels.append({"value": "off", "fields": [{"thinking": {"type": "disabled"}}]})
    elif not adaptive:
        # 不认自适应思考的旧模型：不发思考字段就不思考
        levels.append({"value": "off", "fields": []})
    if effort.get("supported"):
        for value in ANTHROPIC_EFFORTS:
            if supported(effort, value):
                fields = [{"thinking": {"type": "adaptive"}, "output_config": {"effort": value}}] if adaptive else []
                fields.append({"output_config": {"effort": value}})
                levels.append({"value": value, "fields": fields})
    elif supported(types, "enabled"):
        for value in ("low", "medium", "high", "max"):
            budget = model_wire.THINKING_BUDGET_TOKENS[value]
            levels.append({"value": value, "fields": [{"thinking": {"type": "enabled", "budget_tokens": budget}}]})
    return {"levels": levels}


def openrouter_spec(models: Any, model: str) -> dict[str, Any] | None:
    """``GET /api/v1/models`` 的 ``data`` 里这个模型的 ``reasoning`` → 档位。列表里没有这个模型是 None。"""
    entry = next((item for item in models if isinstance(item, dict) and item.get("id") == model), None) if isinstance(models, list) else None
    if entry is None:
        return None
    reasoning = entry.get("reasoning")
    if not isinstance(reasoning, dict):
        return {"levels": []}
    levels: list[dict[str, Any]] = []
    if not reasoning.get("mandatory"):
        levels.append({"value": "off", "fields": [{"reasoning": {"effort": "none"}}, {"reasoning": {"enabled": False}}]})
    if "supported_efforts" not in reasoning:
        levels.append({"value": "on", "fields": [{"reasoning": {"enabled": True}}]})
    else:
        efforts = reasoning.get("supported_efforts")
        if isinstance(efforts, list):
            # 接口给的是从强到弱
            values = [str(value) for value in reversed(efforts) if str(value) in model_wire._LEVEL_ORDER]
        else:
            values = ["low", "medium", "high"]
        levels += [{"value": value, "fields": [{"reasoning": {"effort": value}}]} for value in values]
    values = [level["value"] for level in levels]
    default = str(reasoning.get("default_effort") or "")
    if reasoning.get("default_enabled") is False or default == "none":
        auto = "off"
    elif default in values:
        auto = default
    else:
        auto = "on" if "on" in values else ("medium" if "medium" in values else values[-1])
    return {"levels": levels, "auto": auto}


def ollama_spec(show: Any, *, responses: bool) -> dict[str, Any] | None:
    """``POST /api/show`` 的 ``thinking`` → 档位（OpenAI 兼容接口上用 ``reasoning_effort`` / ``reasoning.effort`` 发）。
    没有 ``thinking``（模型没写）是 None。"""
    thinking = show.get("thinking") if isinstance(show, dict) else None
    if not isinstance(thinking, dict) or not isinstance(thinking.get("values"), list):
        return None
    values = thinking["values"]

    def fields(effort: str) -> list[dict[str, Any]]:
        return [{"reasoning": {"effort": effort}}] if responses else [{"reasoning_effort": effort}]

    levels: list[dict[str, Any]] = []
    if False in values:
        levels.append({"value": "off", "fields": fields("none")})
    named = [str(value) for value in values if isinstance(value, str) and value.strip()]
    if named:
        levels += [{"value": value, "fields": fields(value)} for value in named]
    elif True in values:
        # 只有开关的模型：Ollama 把认得的 effort 当成开
        levels.append({"value": "on", "fields": fields("high")})
    default = thinking.get("default")
    if default is True:
        auto = "on" if not named else named[-1]
    elif default is False:
        auto = "off"
    else:
        auto = str(default or "")
    return {"levels": levels, "auto": auto}


# ---- 问 ----


def _anthropic(base_url: str, model: str, api_key: str) -> dict[str, Any] | None:
    messages_url = model_wire.anthropic_messages_url(base_url or model_wire.DEFAULT_ANTHROPIC_BASE_URL)
    url = f"{messages_url[: -len('/messages')]}/models/{quote(model, safe='')}"
    response = requests.get(url, headers=model_wire.anthropic_headers(api_key), timeout=TIMEOUT_SECONDS)
    if response.status_code != 200:
        return None
    return anthropic_spec(response.json().get("capabilities"))


def _openrouter(base_url: str, model: str, api_key: str) -> dict[str, Any] | None:
    parsed = urlparse(base_url)
    url = urlunparse((parsed.scheme or "https", parsed.netloc, "/api/v1/models", "", "", ""))
    response = requests.get(url, headers={"Authorization": f"Bearer {api_key}"} if api_key else {}, timeout=TIMEOUT_SECONDS)
    if response.status_code != 200:
        return None
    return openrouter_spec(response.json().get("data"), model)


def _ollama(base_url: str, model: str, api_key: str, *, responses: bool) -> dict[str, Any] | None:
    parsed = urlparse(base_url)
    path = parsed.path.rstrip("/")
    root_path = path[: -len("/v1")] if path.endswith("/v1") else path
    url = urlunparse((parsed.scheme, parsed.netloc, f"{root_path}/api/show", "", "", ""))
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    response = requests.post(url, json={"model": model}, headers=headers, timeout=TIMEOUT_SECONDS)
    if response.status_code != 200:
        return None
    return ollama_spec(response.json(), responses=responses)


def looks_like_ollama(base_url: str) -> bool:
    """像 Ollama 的地址才问 ``/api/show``：端口是 Ollama 默认的 11434，或者主机名里带 ollama。别的自己部署的服务（vLLM、SGLang）
    没有这个接口，不去白问（人家日志里会多一条 404）。"""
    try:
        parsed = urlparse(base_url)
        return parsed.port == OLLAMA_PORT or "ollama" in (parsed.hostname or "")
    except ValueError:
        return False


def ask_provider(*, protocol: str, base_url: str, model: str, api_key: str) -> tuple[dict[str, Any] | None, str]:
    """问一次（不看缓存）。返回（档位或 None，来源）；问不了、出错、接口没这项都是 None。"""
    protocol = model_wire.normalize_protocol(protocol)
    host = model_wire.hostname(base_url)
    try:
        if protocol == model_wire.PROTOCOL_ANTHROPIC:
            return _anthropic(base_url, model, api_key), "api:anthropic"
        if not base_url or host in NO_CAPABILITY_HOSTS:
            return None, ""
        if host == OPENROUTER_HOST:
            return _openrouter(base_url, model, api_key), "api:openrouter"
        if looks_like_ollama(base_url):
            return _ollama(base_url, model, api_key, responses=protocol == model_wire.PROTOCOL_OPENAI_RESPONSES), "api:ollama"
        return None, ""
    except (requests.RequestException, ValueError, AttributeError):
        return None, ""


# ---- 缓存 ----


def cache_path(choice_file: str) -> str:
    """缓存文件：和记档位的文件同目录。没给记档位的文件就不缓存。"""
    return str(Path(choice_file).with_name(CACHE_FILE_NAME)) if choice_file else ""


def _read_cache(path: str) -> dict[str, Any]:
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    entries = data.get("entries") if isinstance(data, dict) else None
    return entries if isinstance(entries, dict) else {}


def _write_cache(path: str, entries: dict[str, Any]) -> None:
    target = Path(path)
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        save_json_atomic(target, {"version": 1, "entries": dict(list(entries.items())[-MAX_CACHE_ENTRIES:])}, compact=True, durable=False)
    except OSError:
        pass


def provider_menu(*, protocol: str, base_url: str, model: str, api_key: str, cache_file: str = "",
                  now: float | None = None) -> tuple[model_wire.ThinkingMenu | None, bool]:
    """问到的档位表（带缓存）。返回（档位表或 None，接口是不是明说不思考）。"""
    key = "|".join([model_wire.normalize_protocol(protocol), base_url.strip().rstrip("/"), model.strip()])
    now = time.time() if now is None else now
    entries = _read_cache(cache_file) if cache_file else {}
    cached = entries.get(key)
    if isinstance(cached, dict) and now - float(cached.get("at") or 0) < float(cached.get("ttl") or 0):
        spec, source = cached.get("spec"), str(cached.get("source") or "")
    else:
        spec, source = ask_provider(protocol=protocol, base_url=base_url, model=model, api_key=api_key)
        if cache_file:
            entries.pop(key, None)
            entries[key] = {"at": now, "ttl": FOUND_TTL_SECONDS if spec is not None else MISSED_TTL_SECONDS,
                            "spec": spec, "source": source}
            _write_cache(cache_file, entries)
    if spec is None:
        return None, False
    if not spec.get("levels"):
        return None, True
    return model_wire.menu_from_spec(spec, source=source), False


__all__ = ["anthropic_spec", "ask_provider", "cache_path", "ollama_spec", "openrouter_spec", "provider_menu"]
