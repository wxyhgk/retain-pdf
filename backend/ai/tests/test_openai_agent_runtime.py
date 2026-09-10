import json
import stat
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from retainpdf_ai.config import Settings
from retainpdf_ai.openai_agent_runtime import (
    OPENAI_AGENT_RUNTIME_ID,
    OpenAICompatibleAgentRuntime,
)
from retainpdf_ai.runtime import build_agent_runtime
from retainpdf_ai.tools import Tool, ToolRegistry


class FakeRust:
    def __init__(self):
        self.capability_calls: list[dict] = []
        self.operations: list[dict] = []

    def issue_agent_capability(self, **kwargs) -> dict:
        self.capability_calls.append(kwargs)
        return {"capability": "host-only-capability"}

    def list_agent_operations(self, conversation_id: str, *, limit: int = 20) -> list[dict]:
        del conversation_id
        return self.operations[:limit]


class UnusedRetrievalAgent:
    pass


def _write_operation_cli(path: Path) -> Path:
    script = f"""#!{sys.executable}
import json
import sys
from pathlib import Path

args = sys.argv[1:]
action = args[1] if len(args) > 1 else "inspect"
request = {{}}
if "--request" in args:
    index = args.index("--request")
    request = json.loads(Path(args[index + 1]).read_text(encoding="utf-8"))
operation_id = request.get("operation_id") or "op-openai-1"
status = {{"create": "draft", "run": "result_ready", "commit": "committed"}}.get(action, "draft")
print(json.dumps({{
    "schema": "retainpdf_agent_cli_response_v1",
    "ok": True,
    "response": {{
        "code": 0,
        "data": {{
            "operation_id": operation_id,
            "conversation_id": request.get("conversation_id", "conv-a"),
            "request_message_id": request.get("request_message_id", "msg-a"),
            "status": status,
            "current_attempt": 1,
            "events": [{{"seq": 3}}],
        }},
    }},
}}, separators=(",", ":")))
"""
    path.write_text(script, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)
    return path


def _settings(tmp_path: Path, cli: Path) -> Settings:
    return Settings(
        agent_runtime="openai",
        llm_base_url="https://models.example/v1",
        llm_model="model-a",
        llm_api_key="model-key",
        max_tool_rounds=4,
        fx_agent_cli_command=str(cli),
        data_root=tmp_path / "data",
    )


def _call(call_id: str, name: str, arguments: dict) -> dict:
    return {
        "id": call_id,
        "type": "function",
        "function": {
            "name": name,
            "arguments": json.dumps(arguments, separators=(",", ":")),
        },
    }


def test_openai_runtime_creates_operation_through_shared_broker(tmp_path):
    rust = FakeRust()
    cli = _write_operation_cli(tmp_path / "retainpdf-agent")
    runtime = OpenAICompatibleAgentRuntime(_settings(tmp_path, cli), rust)  # type: ignore[arg-type]
    replies = iter(
        [
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    _call(
                        "tool-create",
                        "retainpdf_operation_create",
                        {
                            "steps": [
                                {
                                    "op": "rotate_pages",
                                    "pages": [1],
                                    "degrees": 90,
                                }
                            ]
                        },
                    )
                ],
            },
            {"role": "assistant", "content": "候选操作已创建，请确认运行。"},
        ]
    )
    events: list[dict] = []

    result = runtime.ask(
        "把第一页旋转 90 度",
        conversation_id="conv-a",
        document_id="doc-a",
        request_message_id="msg-a",
        on_event=events.append,
        chat_fn=lambda _messages, _tools: next(replies),
    )

    assert result.answer == "候选操作已创建，请确认运行。"
    assert result.operation_refs == [
        {
            "operation_id": "op-openai-1",
            "status": "draft",
            "current_attempt": 1,
            "latest_event_seq": 3,
        }
    ]
    assert [item["type"] for item in events] == [
        "agent_tool",
        "agent_operation",
        "agent_tool",
    ]
    assert rust.capability_calls == [
        {
            "conversation_id": "conv-a",
            "document_id": "doc-a",
            "actions": ["operation.create"],
            "ttl_seconds": 60,
        }
    ]


def test_openai_runtime_rejects_run_without_independent_confirmation(tmp_path):
    rust = FakeRust()
    cli = _write_operation_cli(tmp_path / "retainpdf-agent")
    runtime = OpenAICompatibleAgentRuntime(_settings(tmp_path, cli), rust)  # type: ignore[arg-type]
    observed_tool_results: list[dict] = []

    def chat(messages, _tools):
        assert "点击对应 operation 卡片" in messages[0]["content"]
        assert "固定确认语句" in messages[0]["content"]
        tool_results = [
            message for message in messages if message.get("role") == "tool"
        ]
        if not tool_results:
            return {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    _call(
                        "tool-run",
                        "retainpdf_operation_run",
                        {"operation_id": "op-openai-1"},
                    )
                ],
            }
        observed_tool_results.append(json.loads(tool_results[-1]["content"]))
        return {"role": "assistant", "content": "需要用户明确确认后才能运行。"}

    result = runtime.ask(
        "运行它",
        conversation_id="conv-a",
        document_id="doc-a",
        request_message_id="msg-a",
        confirmed=False,
        chat_fn=chat,
    )

    assert "明确确认" in result.answer
    assert observed_tool_results[0]["ok"] is False
    assert "confirmation" in observed_tool_results[0]["error"]
    assert rust.capability_calls == []


def test_openai_runtime_green_light_can_run_and_commit_in_one_turn(tmp_path):
    rust = FakeRust()
    cli = _write_operation_cli(tmp_path / "retainpdf-agent")
    settings = _settings(tmp_path, cli)
    settings = Settings(**{**settings.__dict__, "agent_confirmation_mode": "green_light"})
    runtime = OpenAICompatibleAgentRuntime(settings, rust)  # type: ignore[arg-type]
    replies = iter(
        [
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    _call(
                        "tool-run",
                        "retainpdf_operation_run",
                        {"operation_id": "op-openai-1"},
                    )
                ],
            },
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    _call(
                        "tool-commit",
                        "retainpdf_operation_commit",
                        {"operation_id": "op-openai-1"},
                    )
                ],
            },
            {"role": "assistant", "content": "已直接执行并提交。"},
        ]
    )

    result = runtime.ask(
        "直接执行这个操作",
        conversation_id="conv-a",
        document_id="doc-a",
        request_message_id="msg-a",
        confirmed=False,
        chat_fn=lambda _messages, _tools: next(replies),
    )

    assert result.answer == "已直接执行并提交。"
    assert [call["actions"] for call in rust.capability_calls] == [
        ["operation.run"],
        ["operation.commit"],
    ]
    assert [item["status"] for item in result.tool_trace] == ["completed", "completed"]


def test_openai_runtime_requires_preview_turn_between_run_and_commit(tmp_path):
    rust = FakeRust()
    cli = _write_operation_cli(tmp_path / "retainpdf-agent")
    runtime = OpenAICompatibleAgentRuntime(_settings(tmp_path, cli), rust)  # type: ignore[arg-type]
    replies = iter(
        [
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    _call(
                        "tool-run",
                        "retainpdf_operation_run",
                        {"operation_id": "op-openai-1"},
                    )
                ],
            },
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    _call(
                        "tool-commit",
                        "retainpdf_operation_commit",
                        {"operation_id": "op-openai-1"},
                    )
                ],
            },
            {"role": "assistant", "content": "请先预览候选版本，再单独确认提交。"},
        ]
    )

    result = runtime.ask(
        "确认运行",
        conversation_id="conv-a",
        document_id="doc-a",
        request_message_id="msg-a",
        confirmed=True,
        chat_fn=lambda _messages, _tools: next(replies),
    )

    assert "预览候选版本" in result.answer
    assert [call["actions"] for call in rust.capability_calls] == [["operation.run"]]
    assert [item["status"] for item in result.tool_trace] == ["completed", "failed"]


def test_openai_runtime_combines_reading_and_operation_tools(tmp_path):
    rust = FakeRust()
    rust.operations = [
        {
            "operation_id": "op-existing",
            "document_id": "doc-a",
            "status": "draft",
            "current_attempt": 1,
            "latest_event_seq": 4,
            "affected_pages": [2],
            "allowed_actions": ["run"],
        }
    ]
    registry = ToolRegistry(
        [
            Tool(
                name="search_markdown",
                description="search current markdown",
                parameters={
                    "type": "object",
                    "properties": {"query": {"type": "string"}},
                    "required": ["query"],
                },
                handler=lambda arguments: {
                    "hits": [
                        {
                            "document_id": arguments["document_id"],
                            "job_id": arguments["job_id"],
                            "block_id": "md-0001",
                            "chunk_id": "md-0001",
                            "source_snippet": "可靠证据",
                        }
                    ]
                },
            )
        ]
    )
    cli = _write_operation_cli(tmp_path / "retainpdf-agent")
    runtime = OpenAICompatibleAgentRuntime(
        _settings(tmp_path, cli),
        rust,  # type: ignore[arg-type]
        reading_registry=registry,
    )
    calls = 0

    def chat(messages, tools):
        nonlocal calls
        calls += 1
        names = {tool["function"]["name"] for tool in tools}
        assert "search_markdown" in names
        assert "retainpdf_operation_create" in names
        assert "op-existing" in messages[0]["content"]
        if calls == 1:
            return {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    _call("tool-search", "search_markdown", {"query": "证据"}),
                    _call(
                        "tool-create",
                        "retainpdf_operation_create",
                        {
                            "steps": [
                                {
                                    "op": "rotate_pages",
                                    "pages": [1],
                                    "degrees": 180,
                                }
                            ]
                        },
                    ),
                ],
            }
        return {"role": "assistant", "content": "结论来自 md-0001，操作已创建。"}

    result = runtime.ask(
        "先阅读，再按需要操作",
        conversation_id="conv-a",
        document_id="doc-a",
        job_id="job-a",
        request_message_id="msg-a",
        chat_fn=chat,
    )

    assert result.answer == "结论来自 [1]，操作已创建。"
    assert [citation.block_id for citation in result.citations] == ["md-0001"]
    assert result.tool_trace == [
        {"round": 1, "tool": "search_markdown", "status": "completed"},
        {"round": 1, "tool": "retainpdf_operation_create", "status": "completed"},
    ]
    assert result.operation_refs[0]["operation_id"] == "op-openai-1"
    assert rust.capability_calls[0]["actions"] == ["operation.create"]


def test_openai_runtime_exposes_calculation_in_the_same_model_loop(tmp_path):
    rust = FakeRust()
    names = [
        "search_fulltext",
        "calculate_expression",
        "calculate_statistics",
        "analyze_table",
        "generate_chart",
    ]
    registry = ToolRegistry(
        [
            Tool(
                name=name,
                description=name,
                parameters={"type": "object"},
                handler=(
                    lambda _arguments: {
                        "schema": "retainpdf.calculation-result.v1",
                        "value": 13.8,
                        "calculation_id": "calc-openai-1",
                        "durable": True,
                    }
                ),
            )
            for name in names
        ]
    )
    cli = _write_operation_cli(tmp_path / "retainpdf-agent")
    runtime = OpenAICompatibleAgentRuntime(
        _settings(tmp_path, cli),
        rust,  # type: ignore[arg-type]
        reading_registry=registry,
    )
    replies = iter(
        [
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    _call(
                        "tool-calculate",
                        "calculate_expression",
                        {"expression": "(12.5 + 13.7 + 15.2) / 3"},
                    )
                ],
            },
            {"role": "assistant", "content": "平均值为 13.8。"},
        ]
    )
    events: list[dict] = []

    result = runtime.ask(
        "计算平均值",
        conversation_id="conv-a",
        document_id="doc-a",
        job_id="job-a",
        request_message_id="msg-a",
        on_event=events.append,
        chat_fn=lambda _messages, tools: (
            next(replies)
            if {item["function"]["name"] for item in tools} >= set(names)
            else (_ for _ in ()).throw(AssertionError("unified tools are missing"))
        ),
    )

    assert runtime.capabilities.calculation is True
    assert runtime.capabilities.document_operations is True
    assert result.calculation_refs == [
        {"calculation_id": "calc-openai-1", "status": "completed"}
    ]
    assert [event["kind"] for event in events] == ["calculation", "calculation"]
    assert [event["status"] for event in events] == ["running", "completed"]


def test_openai_runtime_keeps_structured_path_after_empty_match(tmp_path):
    markdown_calls: list[dict] = []
    registry = ToolRegistry(
        [
            Tool(
                name="search_fulltext",
                description="search structured blocks",
                parameters={
                    "type": "object",
                    "properties": {"query": {"type": "string"}},
                },
                handler=lambda _arguments: {
                    "document_id": "doc-a",
                    "structured_data_available": True,
                    "hits": [],
                },
            ),
            Tool(
                name="search_markdown",
                description="legacy markdown fallback",
                parameters={
                    "type": "object",
                    "properties": {"query": {"type": "string"}},
                },
                handler=lambda arguments: markdown_calls.append(dict(arguments))
                or {"hits": []},
            ),
        ]
    )
    cli = _write_operation_cli(tmp_path / "retainpdf-agent")
    runtime = OpenAICompatibleAgentRuntime(
        _settings(tmp_path, cli),
        FakeRust(),  # type: ignore[arg-type]
        reading_registry=registry,
    )
    replies = iter(
        [
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [_call("tool-search", "search_fulltext", {"query": "x"})],
            },
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [_call("tool-markdown", "search_markdown", {"query": "x"})],
            },
            {"role": "assistant", "content": "结构化数据存在，请换关键词检索。"},
        ]
    )

    result = runtime.ask(
        "查询当前文档",
        conversation_id="conv-a",
        document_id="doc-a",
        job_id="job-a",
        chat_fn=lambda _messages, _tools: next(replies),
    )

    assert markdown_calls == []
    assert result.answer == "结构化数据存在，请换关键词检索。"
    assert result.tool_trace == [
        {"round": 1, "tool": "search_fulltext", "status": "completed"},
        {"round": 2, "tool": "search_markdown", "status": "skipped"},
    ]


def test_runtime_factory_selects_openai_agent_without_gateway_key(tmp_path):
    cli = _write_operation_cli(tmp_path / "retainpdf-agent")
    settings = _settings(tmp_path, cli)
    runtime = build_agent_runtime(
        settings,
        FakeRust(),  # type: ignore[arg-type]
        UnusedRetrievalAgent(),  # type: ignore[arg-type]
    )
    assert runtime.runtime_id == OPENAI_AGENT_RUNTIME_ID
