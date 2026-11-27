"""档位表（``model_wire.thinking_menu``，2026-11-26）：每类模型报哪些档、每档发什么字段、设置里的思考深度换成哪一档。

阅读页提问的自带 agent 用它报 ACP 的 ``thought_level``；换算要和按设置发的字段（翻译同一套）对得上。"""
import re
from pathlib import Path

import pytest

from retainpdf_translation.llm.shared import model_wire

DASHSCOPE = "https://dashscope.aliyuncs.com/compatible-mode/v1"
DEEPSEEK = "https://api.deepseek.com/v1"
OPENAI = "https://api.openai.com/v1"
BIGMODEL = "https://open.bigmodel.cn/api/paas/v4"


def _menu(protocol, model, base_url=""):
    menu = model_wire.thinking_menu(protocol=protocol, model=model, base_url=base_url)
    assert menu is not None
    return menu


def _effort(level):
    return {"thinking": {"type": "adaptive"}, "output_config": {"effort": level}}


@pytest.mark.parametrize(("model", "values", "auto"), [
    # 新模型：不发也思考，有 xhigh；auto 对 haiku-5-5 是实测的 low，其余是不发 effort 时的默认
    ("claude-haiku-5-5", ["low", "medium", "high", "xhigh", "max"], "low"),
    ("claude-opus-5-5", ["low", "medium", "high", "xhigh", "max"], "medium"),
    ("claude-sonnet-5-5", ["low", "medium", "high", "xhigh", "max"], "high"),
    ("claude-fable-5-2", ["low", "medium", "high", "xhigh", "max"], "high"),
    # 不发就不思考的：多一档 off（什么都不加），auto 就是它
    ("claude-opus-4-8", ["off", "low", "medium", "high", "xhigh", "max"], "off"),
    ("claude-sonnet-4-6", ["off", "low", "medium", "high", "max"], "off"),
    # 认不出的（中转的别家模型）照 Anthropic 的通用写法
    ("kimi-k3", ["off", "low", "medium", "high", "max"], "off"),
])
def test_claude_levels_and_auto(model, values, auto):
    menu = _menu("anthropic", model)
    assert menu.values() == values
    assert menu.level_for("auto") == auto
    # 设置的 off 和以前一样是 effort low，其余同名
    assert [menu.level_for(setting) for setting in ("off", "low", "medium", "high", "max")] == ["low", "low", "medium", "high", "max"]


def test_claude_level_fields_are_the_translation_ones():
    menu = _menu("anthropic", "claude-haiku-5-5")
    for level in ("low", "medium", "high", "max"):
        assert menu.candidates(level) == model_wire.anthropic_thinking_candidates(level, model="claude-haiku-5-5")
    assert menu.candidates("xhigh") == [_effort("xhigh"), _effort("high"), {}]
    assert _menu("anthropic", "claude-sonnet-4-6").candidates("off") == [{}]
    with pytest.raises(KeyError):
        menu.candidates("off")


def test_qwen_on_dashscope_has_budget_levels_and_deepseek_is_a_switch():
    """DashScope 认思考预算（2026-11-27 起分档，以前只有开关）：每档发 thinking_budget，不认退到只开思考；和翻译按设置发的一样。"""
    qwen = _menu("openai", "qwen3.8-flash", DASHSCOPE)
    assert qwen.values() == ["off", "low", "medium", "high", "max"]
    assert not qwen.guessed
    assert qwen.candidates("off") == [{"enable_thinking": False}, {}]
    assert qwen.candidates("low") == [{"enable_thinking": True, "thinking_budget": 2048}, {"enable_thinking": True}, {}]
    assert qwen.candidates("max")[0] == {"enable_thinking": True, "thinking_budget": 32768}
    # auto：qwen3.8-flash 实测关掉；别的 Qwen 不加字段，按服务商默认开（预算不限，算 max）
    assert [qwen.level_for(setting) for setting in ("auto", "off", "low", "medium", "high", "max")] == ["off", "off", "low", "medium", "high", "max"]
    assert _menu("openai", "qwen-plus", DASHSCOPE).level_for("auto") == "max"
    deepseek = _menu("openai", "deepseek-chat", DEEPSEEK)
    assert deepseek.values() == ["off", "on"]
    assert deepseek.candidates("on") == [{"thinking": {"type": "enabled"}}, {}]
    assert deepseek.level_for("auto") == "off" and _menu("openai", "deepseek-reasoner", DEEPSEEK).level_for("auto") == "on"
    assert not deepseek.guessed and not _menu("anthropic", "claude-haiku-5-5").guessed and not _menu("openai", "gpt-5", OPENAI).guessed


@pytest.mark.parametrize("model", ["Qwen3.8-27B-Uncensored", "qwen/qwen3-32b", "Qwen3-30B-A3B"])
def test_qwen3_on_other_hosts_is_a_switch(model):
    """自己部署、中转的 Qwen3 按名字认（2026-11-27，用户自定义的 Qwen3.8-27B-Uncensored 以前没有档位）：两种写法一起发，回 400 再一个一个试。"""
    menu = _menu("openai", model, "http://127.0.0.1:8000/v1")
    assert menu.values() == ["off", "on"]
    assert menu.guessed, "self-hosted servers may ignore the switch"
    assert menu.candidates("off") == [
        {"enable_thinking": False, "chat_template_kwargs": {"enable_thinking": False}},
        {"chat_template_kwargs": {"enable_thinking": False}},
        {"enable_thinking": False},
        {},
    ]
    assert menu.candidates("on")[0] == {"enable_thinking": True, "chat_template_kwargs": {"enable_thinking": True}}
    assert menu.level_for("auto") == "on" and menu.level_for("off") == "off" and menu.level_for("max") == "on"


@pytest.mark.parametrize("model", ["Qwen3-235B-A22B-Instruct-2507", "qwen3-30b-a3b-thinking-2507", "qwen3-coder-plus", "qwen2.5-72b-instruct"])
def test_qwen_without_switch_falls_back_to_the_generic_one(model):
    menu = _menu("openai", model, "http://127.0.0.1:8000/v1")
    assert menu.candidates("on")[0] == {"enable_thinking": True, "chat_template_kwargs": {"enable_thinking": True, "thinking": True}}


def test_gpt_levels_by_model():
    gpt5 = _menu("openai", "gpt-5", OPENAI)
    assert gpt5.values() == ["minimal", "low", "medium", "high"]
    assert gpt5.candidates("minimal") == [{"reasoning_effort": "minimal"}, {}]
    # 设置的 off 先试 none（GPT-5 没有），落到 minimal；max 先试 xhigh，落到 high；auto 不传，默认 medium
    assert [gpt5.level_for(setting) for setting in model_wire.THINKING_LEVELS] == ["medium", "minimal", "low", "medium", "high", "high"]
    newer = _menu("openai", "gpt-5.5-mini", OPENAI)
    assert newer.values() == ["none", "low", "medium", "high", "xhigh"]
    assert newer.level_for("off") == "none" and newer.level_for("max") == "xhigh" and newer.level_for("auto") == "none"
    responses = _menu("openai_responses", "gpt-5-mini", OPENAI)
    assert responses.values() == ["minimal", "low", "medium", "high"]
    assert responses.candidates("high") == [{"reasoning": {"effort": "high"}}, {}]
    o3 = _menu("openai_responses", "o3", OPENAI)
    assert o3.values() == ["low", "medium", "high"] and o3.level_for("auto") == "medium"
    # 经中转（OpenRouter 的写法）也按模型名认
    assert _menu("openai", "openai/gpt-5", "https://openrouter.ai/api/v1").values() == ["minimal", "low", "medium", "high"]


def test_glm_and_unknown_models():
    glm = _menu("openai", "glm-5.3-flash", BIGMODEL)
    assert glm.values() == ["off", "low", "medium", "high", "max"]
    assert glm.candidates("off") == [{"thinking": {"type": "disabled"}}, {"reasoning_effort": "low"}, {}]
    assert glm.level_for("auto") == "low"
    assert model_wire.thinking_menu(protocol="openai", model="gpt-4o", base_url=OPENAI) is None
    assert model_wire.thinking_menu(protocol="openai_responses", model="gpt-4o", base_url=OPENAI) is None


@pytest.mark.parametrize("model", ["Qwen3.8-27B-Uncensored", "some-model"])
def test_unknown_models_on_responses_get_a_generic_switch(model):
    """Responses 协议上认不出的也给通用开关（2026-11-27：用户自定义的 Qwen3.8-27B-Uncensored 走 Responses，Chat 那份覆盖不到）。
    关的时候 effort 写成 reasoning.effort，最后再单独试它（DashScope 的 /responses 实测 effort=none 能关）。"""
    menu = _menu("openai_responses", model, "http://127.0.0.1:1561/v1")
    assert menu.guessed
    assert menu.values() == ["off", "on"]
    template_off = {"chat_template_kwargs": {"enable_thinking": False, "thinking": False}}
    assert menu.candidates("off") == [
        {"enable_thinking": False, **template_off, "reasoning": {"effort": "none"}},
        {"enable_thinking": False, **template_off},
        template_off,
        {"enable_thinking": False},
        {"reasoning": {"effort": "none"}},
        {},
    ]
    template_on = {"chat_template_kwargs": {"enable_thinking": True, "thinking": True}}
    assert menu.candidates("on") == [{"enable_thinking": True, **template_on}, template_on, {"enable_thinking": True}, {}]
    assert menu.level_for("auto") == "on"


def test_unknown_models_get_a_generic_switch():
    """认不出的模型（OpenAI Chat、不是 api.openai.com）给通用开关（2026-11-27）：几种常见写法一起发，回 400 再少发，最后不加。"""
    menu = _menu("openai", "some-model", "https://llm.example.com/v1")
    assert menu.guessed
    assert menu.values() == ["off", "on"]
    template_off = {"chat_template_kwargs": {"enable_thinking": False, "thinking": False}}
    assert menu.candidates("off") == [
        {"enable_thinking": False, **template_off, "reasoning_effort": "none"},
        {"enable_thinking": False, **template_off},
        template_off,
        {"enable_thinking": False},
        {},
    ]
    template_on = {"chat_template_kwargs": {"enable_thinking": True, "thinking": True}}
    assert menu.candidates("on") == [{"enable_thinking": True, **template_on}, template_on, {"enable_thinking": True}, {}]
    assert menu.level_for("auto") == "on" and menu.level_for("off") == "off" and menu.level_for("high") == "on"


MENUS = [
    ("anthropic", "claude-haiku-5-5", ""), ("anthropic", "claude-opus-5-5", ""), ("anthropic", "claude-opus-4-8", ""),
    ("anthropic", "claude-sonnet-4-6", ""), ("openai", "glm-5.3-flash", BIGMODEL), ("openai", "glm-5", BIGMODEL),
    ("openai", "gpt-5", OPENAI), ("openai", "gpt-5.5-mini", OPENAI), ("openai", "o4-mini", OPENAI),
    ("openai_responses", "gpt-5-mini", OPENAI), ("openai_responses", "gpt-5.5", OPENAI),
    ("openai", "qwen3.8-flash", DASHSCOPE), ("openai", "qwen-plus", DASHSCOPE),
]


@pytest.mark.parametrize(("protocol", "model", "base_url"), MENUS)
def test_the_reported_level_is_what_the_setting_actually_sends(protocol, model, base_url):
    """设置换成的那一档：设置发的候选里第一个对得上档位的（服务商不认前面的会退到它）；全对不上就是服务商默认档。"""
    menu = _menu(protocol, model, base_url)
    for setting in model_wire.THINKING_LEVELS:
        sent = model_wire.setting_thinking_candidates(protocol=protocol, model=model, base_url=base_url, thinking=setting)
        first = menu.candidates(menu.level_for(setting))[0]
        if any(level.candidates[0] in sent for level in menu.levels):
            # 发的候选里第一个能对上档位的就是它
            assert first == next(fields for fields in sent if any(level.candidates[0] == fields for level in menu.levels)), setting
        else:
            # 候选全对不上，最后什么都不加：报的是服务商默认档（不是由这个设置发出去的字段）
            assert sent[-1] == {}, setting
        assert all(level.candidates[-1] == {} for level in menu.levels)


def test_pi_models_json_uses_the_same_claude_lists():
    """retainpdf-pi 的 models.json（acp/pi.rs）按同样的名单给 Claude 开 xhigh、去掉 off。"""
    repo = Path(__file__).resolve().parents[5]
    source = (repo / "backend/packages/retainpdf-providers/src/acp/pi.rs").read_text(encoding="utf-8")

    def rust_list(name):
        match = re.search(rf"const {name}: \[&str; \d+\] =\s*\[(.*?)\];", source, re.S)
        assert match, name
        return tuple(re.findall(r'"([^"]+)"', match.group(1)))

    assert rust_list("CLAUDE_XHIGH_MODELS") == model_wire.ANTHROPIC_XHIGH_MODELS
    assert rust_list("CLAUDE_THINKS_BY_DEFAULT_MODELS") == model_wire.ANTHROPIC_THINKS_BY_DEFAULT_MODELS
