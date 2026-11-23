"""发给模型的结构化输出 schema 都要过 OpenAI strict 的规矩（#163，2026-11-23）。

OpenAI 的 strict（Responses 协议下 json_schema 默认就按它校验）要求：每层对象 ``additionalProperties: false``，
``properties`` 里的每个键都列进 ``required``（可选字段写成必填、可为 null），数组要写 ``items``。不合规的 schema 整个请求 400，
以前通读的 ``submit_reading``（terms.items 的 chapters、note 和顶层 domain 是可选的）就这样被拒。

这里把 agent 经 OpenAI 协议发出去的每个工具 schema、翻译包和普通翻译引擎里标了 strict 的 schema 都走一遍。
"""

from __future__ import annotations

from typing import Any

import pytest

from retainpdf_translation.llm.shared import model_wire
from retainpdf_translation.llm.shared import structured_models
from retainpdf_translation_agent.reader import READER_TOOL
from retainpdf_translation_agent.review import REVIEW_TOOL
from retainpdf_translation_agent.rewrite import REWRITE_TOOL
from retainpdf_translation_agent.agent import strict_tool
from retainpdf_translation_agent.tools import TOOL_DEFINITIONS
from retainpdf_translation_agent_engine import agent_openai
from retainpdf_translation_classic.services.agents.repair import REPAIR_RESPONSE_SCHEMA
from retainpdf_translation_classic.services.preparation.style_guide import STYLE_GUIDE_RESPONSE_SCHEMA
from retainpdf_translation_classic.services.preparation.term_prescan import TERM_PRESCAN_RESPONSE_SCHEMA


def strict_problems(node: Any, path: str = "$") -> list[str]:
    """按 OpenAI strict 的规矩查一份 schema，交回不合规的地方（空列表就是合规）。"""
    if not isinstance(node, dict):
        return [f"{path}: schema is not an object"]
    problems: list[str] = []
    if "anyOf" in node:
        for index, child in enumerate(node["anyOf"]):
            problems += strict_problems(child, f"{path}.anyOf[{index}]")
        return problems
    kinds = node.get("type")
    kinds = [kinds] if isinstance(kinds, str) else list(kinds or [])
    if not kinds:
        return [f"{path}: no type"]
    if "object" in kinds:
        properties = node.get("properties")
        if not isinstance(properties, dict):
            problems.append(f"{path}: object without properties")
            properties = {}
        if node.get("additionalProperties") is not False:
            problems.append(f"{path}: additionalProperties must be false")
        missing = [key for key in properties if key not in (node.get("required") or [])]
        if missing:
            problems.append(f"{path}.required: missing {missing}")
        extra = [key for key in node.get("required") or [] if key not in properties]
        if extra:
            problems.append(f"{path}.required: unknown {extra}")
        for key, child in properties.items():
            problems += strict_problems(child, f"{path}.{key}")
    if "array" in kinds:
        if "items" not in node:
            problems.append(f"{path}: array without items")
        else:
            problems += strict_problems(node["items"], f"{path}.items")
    if isinstance(node.get("enum"), list) and "null" in kinds and None not in node["enum"]:
        problems.append(f"{path}: nullable enum must list null")
    return problems


AGENT_FORCED_TOOLS = [READER_TOOL, REVIEW_TOOL, REWRITE_TOOL]


def _agent_response_format(tool: dict) -> dict:
    """agent 实际发出去的样子：agent 先套 strict_tool，再经 agent_openai 换成 response_format。"""
    body = {
        "system": [{"type": "text", "text": "x"}],
        "messages": [{"role": "user", "content": "{}"}],
        "tools": [strict_tool(tool)],
        "tool_choice": {"type": "tool", "name": tool["name"]},
    }
    return agent_openai.openai_request(body)[1]


@pytest.mark.parametrize("tool", AGENT_FORCED_TOOLS, ids=lambda tool: tool["name"])
def test_every_agent_tool_sent_over_openai_passes_the_strict_rules(tool: dict) -> None:
    response_format = _agent_response_format(tool)
    assert response_format["type"] == "json_schema"
    assert response_format["json_schema"]["strict"] is True
    assert strict_problems(response_format["json_schema"]["schema"]) == []


@pytest.mark.parametrize("tool", [*AGENT_FORCED_TOOLS, *TOOL_DEFINITIONS], ids=lambda tool: tool["name"])
def test_every_agent_tool_converts_to_a_strict_schema(tool: dict) -> None:
    assert strict_problems(model_wire.strict_json_schema(strict_tool(tool)["input_schema"])) == []


STRICT_RESPONSE_FORMATS = {
    name: value
    for name, value in vars(structured_models).items()
    if name.endswith("_RESPONSE_SCHEMA") and isinstance(value, dict)
} | {
    "TERM_PRESCAN_RESPONSE_SCHEMA": TERM_PRESCAN_RESPONSE_SCHEMA,
    "STYLE_GUIDE_RESPONSE_SCHEMA": STYLE_GUIDE_RESPONSE_SCHEMA,
    "REPAIR_RESPONSE_SCHEMA": REPAIR_RESPONSE_SCHEMA,
}


@pytest.mark.parametrize("name", sorted(STRICT_RESPONSE_FORMATS))
def test_every_translation_response_schema_passes_the_strict_rules(name: str) -> None:
    schema = STRICT_RESPONSE_FORMATS[name]["json_schema"]["schema"]
    assert strict_problems(schema) == []
    # 已经合规的 schema 换一遍一字不变
    assert model_wire.strict_json_schema(schema) == schema


def test_the_reading_schema_keeps_optional_fields_optional_in_meaning() -> None:
    schema = _agent_response_format(READER_TOOL)["json_schema"]["schema"]
    terms = schema["properties"]["terms"]["items"]
    assert terms["required"] == ["source", "target", "category", "chapters", "note"]
    assert terms["properties"]["chapters"]["type"] == ["array", "null"]
    assert terms["properties"]["note"]["type"] == ["string", "null"]
    assert terms["properties"]["source"]["type"] == "string", "required fields stay non-null"
    assert terms["properties"]["category"] == {"type": "string", "enum": ["term", "keep", "name"]}
    assert schema["properties"]["domain"]["type"] == ["string", "null"]
    assert "domain" in schema["required"]
    # 原来的工具定义不动（Anthropic 协议照旧发它）
    assert "chapters" not in READER_TOOL["input_schema"]["properties"]["terms"]["items"]["required"]


def test_strict_conversion_handles_nullable_enums_and_untyped_fields() -> None:
    converted = model_wire.strict_json_schema(
        {
            "type": "object",
            "properties": {
                "kind": {"type": "string", "enum": ["a", "b"]},
                "any": {"description": "no type"},
                "nested": {"type": "object", "properties": {"x": {"type": "integer"}}},
            },
            "required": [],
        }
    )
    assert converted["properties"]["kind"] == {"type": ["string", "null"], "enum": ["a", "b", None]}
    assert converted["properties"]["any"] == {"anyOf": [{"description": "no type"}, {"type": "null"}]}
    nested = converted["properties"]["nested"]
    assert nested["type"] == ["object", "null"]
    assert nested["required"] == ["x"] and nested["additionalProperties"] is False
    assert nested["properties"]["x"] == {"type": ["integer", "null"]}
    assert converted["required"] == ["kind", "any", "nested"]
