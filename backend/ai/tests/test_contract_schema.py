"""生产者契约测试:ai_service 的实现必须与 backend-root/contracts/ai-ask.v1.schema.json 一致。

契约文件是三方(frontend/rust 透传/python)的单一真值——本测试锁住 python 生产侧,
frontend/tests/ai-ask-contract.test.mjs 锁消费侧。改契约先改 schema,再让两端测试变绿。
不引第三方 jsonschema 依赖:这里只做字段集合/枚举对照,足以捕获漂移。
"""

import json
import sys
from dataclasses import fields
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from retainpdf_ai.agent import Citation
from retainpdf_ai.app import AskInput

CONTRACT_PATH = (
    Path(__file__).resolve().parents[2] / "contracts" / "ai-ask.v1.schema.json"
)


def _load_contract():
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def test_citation_fields_match_contract():
    schema = _load_contract()["definitions"]["Citation"]
    declared = set(schema["properties"].keys())
    actual = {f.name for f in fields(Citation)}
    assert actual == declared, f"Citation 字段漂移: 实现 {actual} vs 契约 {declared}"
    # required 全部存在于 dataclass
    assert set(schema["required"]) <= actual


def test_ask_input_fields_match_contract():
    schema = _load_contract()["definitions"]["AskInput"]
    declared = set(schema["properties"].keys())
    actual = set(AskInput.model_fields.keys())
    assert actual == declared, f"AskInput 字段漂移: 实现 {actual} vs 契约 {declared}"
    # question 的约束与契约一致
    props = schema["properties"]["question"]
    assert props["minLength"] == 1 and props["maxLength"] == 4000


def test_sse_event_types_match_contract():
    """AI 服务实际发出的 SSE type 必须 ⊆ 契约枚举(枚举可超前,实现不可越界)。"""
    schema = _load_contract()["definitions"]["SseEventType"]["enum"]
    implementation_sources = [
        (
            Path(__file__).resolve().parents[1]
            / "retainpdf_ai"
            / "ask_orchestration.py"
        ).read_text(encoding="utf-8"),
        (
            Path(__file__).resolve().parents[1]
            / "retainpdf_ai"
            / "memory"
            / "compress.py"
        ).read_text(encoding="utf-8"),
    ]
    import re

    emitted: set[str] = set()
    for source in implementation_sources:
        emitted |= set(re.findall(r'"type":\s*"([a-z_]+)"', source))
    unknown = emitted - set(schema)
    assert not unknown, f"实现发出了契约外的 SSE 事件类型: {unknown}"
    # done/error 两个关键事件必须存在于实现
    assert {"done", "error"} <= emitted


def test_done_payload_required_fields_are_produced():
    """_result_payload 的产物必须覆盖契约 required 字段。"""
    schema = _load_contract()["definitions"]["DonePayload"]
    required = set(schema["required"])
    from retainpdf_ai.agent import AskResult

    result = AskResult(answer="a", citations=[], tool_trace=[], rounds=1)
    # 直接静态对照问答编排器的 payload 构造。
    orchestration_source = (
        Path(__file__).resolve().parents[1] / "retainpdf_ai" / "ask_orchestration.py"
    ).read_text(encoding="utf-8")
    for field in required:
        assert f'"{field}"' in orchestration_source, (
            f"_result_payload 未产出契约 required 字段 {field}"
        )
    del result
