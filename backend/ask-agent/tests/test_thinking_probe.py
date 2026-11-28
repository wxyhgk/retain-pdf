"""问服务商的接口拿思考档位（2026-11-27）：三家的返回怎么换成档位、缓存、和我们维护的表 / 代码规则的先后。HTTP 是假的。"""
from __future__ import annotations

import json
import threading
from pathlib import Path

import pytest

from retainpdf_ask_agent_engine import stream as engine
from retainpdf_ask_agent_engine import thinking_probe as probe
from test_stream import FakeResponse
from test_stream import MESSAGES
from test_stream import posts  # noqa: F401 - fixture
from test_stream import sse

# Anthropic 文档里 GET /v1/models/{id} 的 capabilities（只留和思考有关的）
OPUS_CAPABILITIES = {
    "effort": {"high": {"supported": True}, "low": {"supported": True}, "max": {"supported": True},
               "medium": {"supported": True}, "supported": True, "xhigh": {"supported": True}},
    "thinking": {"supported": True, "types": {"adaptive": {"supported": True}, "between_tools": {"supported": True},
                                              "disabled": {"supported": True}, "enabled": {"supported": True}}},
}


def _values(spec):
    return [level["value"] for level in spec["levels"]]


def test_anthropic_capabilities_become_levels():
    spec = probe.anthropic_spec(OPUS_CAPABILITIES)
    assert _values(spec) == ["off", "low", "medium", "high", "xhigh", "max"]
    assert spec["levels"][0]["fields"] == [{"thinking": {"type": "disabled"}}]
    assert spec["levels"][3]["fields"][0] == {"thinking": {"type": "adaptive"}, "output_config": {"effort": "high"}}
    # 没有 xhigh、关不掉思考的
    no_off = json.loads(json.dumps(OPUS_CAPABILITIES))
    no_off["effort"]["xhigh"] = None
    no_off["thinking"]["types"]["disabled"]["supported"] = False
    assert _values(probe.anthropic_spec(no_off)) == ["low", "medium", "high", "max"]
    # 旧模型：只有 budget_tokens，不发就不思考
    old = {"effort": {"supported": False}, "thinking": {"supported": True, "types": {"enabled": {"supported": True}}}}
    spec = probe.anthropic_spec(old)
    assert _values(spec) == ["off", "low", "medium", "high", "max"] and spec["levels"][0]["fields"] == []
    assert spec["levels"][1]["fields"] == [{"thinking": {"type": "enabled", "budget_tokens": 2048}}]
    # 不思考的模型；中转不转 capabilities
    assert probe.anthropic_spec({"thinking": {"supported": False}}) == {"levels": []}
    assert probe.anthropic_spec(None) is None


def test_openrouter_reasoning_becomes_levels():
    models = [
        {"id": "google/gemini-3.5-flash", "reasoning": {"supported_efforts": ["high", "medium", "low", "minimal"],
                                                       "default_effort": "medium", "default_enabled": True, "mandatory": True}},
        {"id": "qwen/qwen3.8-plus", "reasoning": {"default_enabled": False}},
        {"id": "some/any-effort", "reasoning": {"supported_efforts": None}},
        {"id": "openai/gpt-4o"},
    ]
    gemini = probe.openrouter_spec(models, "google/gemini-3.5-flash")
    # 接口给的从强到弱，换成从弱到强；关不掉的没有 off
    assert _values(gemini) == ["minimal", "low", "medium", "high"] and gemini["auto"] == "medium"
    assert gemini["levels"][1]["fields"] == [{"reasoning": {"effort": "low"}}]
    qwen = probe.openrouter_spec(models, "qwen/qwen3.8-plus")
    assert _values(qwen) == ["off", "on"] and qwen["auto"] == "off"
    assert _values(probe.openrouter_spec(models, "some/any-effort")) == ["off", "low", "medium", "high"]
    assert probe.openrouter_spec(models, "openai/gpt-4o") == {"levels": []}
    assert probe.openrouter_spec(models, "not/listed") is None


def test_ollama_thinking_becomes_levels():
    named = probe.ollama_spec({"thinking": {"values": ["low", "medium", "high"], "default": "medium"}}, responses=False)
    assert _values(named) == ["low", "medium", "high"] and named["auto"] == "medium"
    assert named["levels"][0]["fields"] == [{"reasoning_effort": "low"}]
    switch = probe.ollama_spec({"thinking": {"values": [False, True], "default": True}}, responses=True)
    assert _values(switch) == ["off", "on"] and switch["auto"] == "on"
    assert switch["levels"][0]["fields"] == [{"reasoning": {"effort": "none"}}]
    assert probe.ollama_spec({"thinking": {"values": [False], "default": False}}, responses=False)["levels"] == [
        {"value": "off", "fields": [{"reasoning_effort": "none"}]}]
    assert probe.ollama_spec({"capabilities": ["completion"]}, responses=False) is None


def test_only_providers_that_can_answer_are_asked(monkeypatch):
    asked: list[tuple[str, str]] = []

    def fake_get(url, **kwargs):
        asked.append(("GET", url))
        return FakeResponse([], status=200, payload={"capabilities": OPUS_CAPABILITIES, "data": []})

    def fake_post(url, **kwargs):
        asked.append(("POST", url))
        return FakeResponse([], status=200, payload={"thinking": {"values": [False, True], "default": True}})

    monkeypatch.setattr(probe.requests, "get", fake_get)
    monkeypatch.setattr(probe.requests, "post", fake_post)
    spec, source = probe.ask_provider(protocol="anthropic", base_url="https://api.anthropic.com/v1", model="claude-opus-5-5", api_key="k")
    assert source == "api:anthropic" and asked[-1] == ("GET", "https://api.anthropic.com/v1/models/claude-opus-5-5")
    probe.ask_provider(protocol="openai", base_url="https://openrouter.ai/api/v1", model="x/y", api_key="k")
    assert asked[-1] == ("GET", "https://openrouter.ai/api/v1/models")
    spec, source = probe.ask_provider(protocol="openai", base_url="http://127.0.0.1:11434/v1", model="qwen3.8", api_key="k")
    assert source == "api:ollama" and asked[-1] == ("POST", "http://127.0.0.1:11434/api/show") and _values(spec) == ["off", "on"]
    count = len(asked)
    # 接口里没有这项的不问：OpenAI 官方、百炼、DeepSeek、智谱、自己部署的 vLLM
    for base in ("https://api.openai.com/v1", "https://dashscope.aliyuncs.com/compatible-mode/v1", "https://api.deepseek.com/v1",
                 "https://open.bigmodel.cn/api/paas/v4", "http://10.0.0.8:8000/v1", ""):
        assert probe.ask_provider(protocol="openai", base_url=base, model="m", api_key="k") == (None, "")
    assert len(asked) == count


def test_failures_fall_back_and_answers_are_cached(monkeypatch, tmp_path: Path):
    calls: list[str] = []

    def fake_ask(**kwargs):
        calls.append(kwargs["model"])
        return ({"levels": [{"value": "low", "fields": [{"e": "low"}]}, {"value": "high", "fields": [{"e": "high"}]}]}, "api:test")

    monkeypatch.setattr(probe, "ask_provider", fake_ask)
    cache = probe.cache_path(str(tmp_path / "ask" / "thinking-levels.json"))
    assert cache.endswith("ask/thinking-capabilities.json")
    menu, says_none = probe.provider_menu(protocol="anthropic", base_url="", model="m", api_key="k", cache_file=cache, now=1000)
    assert menu.values() == ["low", "high"] and menu.source == "api:test" and not says_none
    probe.provider_menu(protocol="anthropic", base_url="", model="m", api_key="k", cache_file=cache, now=1000 + 3600)
    assert calls == ["m"], "answers are cached for a day"
    probe.provider_menu(protocol="anthropic", base_url="", model="m", api_key="k", cache_file=cache, now=1000 + 2 * 86400)
    assert calls == ["m", "m"]
    # 问不到的缓存一小时
    monkeypatch.setattr(probe, "ask_provider", lambda **kwargs: (calls.append("miss"), (None, ""))[1])
    assert probe.provider_menu(protocol="openai", base_url="http://h:11434/v1", model="z", api_key="k", cache_file=cache, now=0) == (None, False)
    probe.provider_menu(protocol="openai", base_url="http://h:11434/v1", model="z", api_key="k", cache_file=cache, now=1800)
    assert calls.count("miss") == 1
    # 网络出错当没问到
    def boom(url, **kwargs):
        raise probe.requests.ConnectionError("down")
    monkeypatch.undo()
    monkeypatch.setattr(probe.requests, "get", boom)
    assert probe.ask_provider(protocol="anthropic", base_url="", model="m", api_key="k") == (None, "")


def test_asked_levels_win_then_our_table_then_the_code(monkeypatch):
    replies: dict[str, tuple] = {}
    monkeypatch.setattr(probe, "provider_menu", lambda **kwargs: replies.get(kwargs["model"], (None, False)))
    opus_spec = probe.anthropic_spec(OPUS_CAPABILITIES)
    replies["claude-haiku-5-5"] = (probe.model_wire.menu_from_spec(opus_spec, source="api:anthropic"), False)
    haiku = engine.resolve_menu(model="claude-haiku-5-5", base_url="", protocol="anthropic", thinking="auto", api_key="k")
    # 接口报的档位；设置「自动」按代码里实测过的那档（haiku-5-5 是 low）
    assert haiku.source == "api:anthropic" and haiku.values()[0] == "off" and haiku.level_for("auto") == "low"
    replies["no-thinking"] = (None, True)
    assert engine.resolve_menu(model="no-thinking", base_url="", protocol="anthropic", api_key="k") is None
    # 问不到：我们维护的表（Qwen3.8），再是代码里的规则
    assert engine.resolve_menu(model="Qwen3.8-27B", base_url="http://10.0.0.8:8000/v1", protocol="openai", api_key="k").source == "table"
    assert engine.resolve_menu(model="claude-opus-5-5", base_url="", protocol="anthropic", api_key="k").source == "code"
    # 没 key 不问
    assert engine.resolve_menu(model="claude-haiku-5-5", base_url="", protocol="anthropic").source == "code"


def test_table_and_asked_levels_are_sent_from_the_first_question(posts):  # noqa: F811
    """档位是问到的或我们表里的：没改过档位的第一问就按报的当前档发（报的和发的一致）。"""
    calls, replies = posts
    menu = engine.resolve_menu(model="Qwen3.8-27B", base_url="http://10.0.0.8:8000/v1", protocol="openai", thinking="off")
    options = engine.thinking_options(model="Qwen3.8-27B", base_url="http://10.0.0.8:8000/v1", protocol="openai", thinking="off", menu=menu)
    assert options["current"] == "off" and options["source"] == "table"
    fn = engine.make_stream_fn(model="Qwen3.8-27B", base_url="http://10.0.0.8:8000/v1", api_key="k", protocol="openai",
                               thinking="off", menu=menu)
    replies.append(FakeResponse(sse((None, {"choices": [{"delta": {"content": "好"}, "finish_reason": "stop"}]}), (None, "[DONE]"))))
    list(fn(MESSAGES, threading.Event()))
    assert calls[-1]["body"]["chat_template_kwargs"] == {"enable_thinking": False}
