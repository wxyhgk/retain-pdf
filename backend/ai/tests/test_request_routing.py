import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from retainpdf_ai.agent import tool_specs_for_scope
from retainpdf_ai.api_contracts import AskInput
from retainpdf_ai.ask_orchestration import AskOrchestrator, PreparedAsk
from retainpdf_ai.config import Settings
from retainpdf_ai.conversation_state import ConversationState
from retainpdf_ai.request_routing import RouteDecision, resolve_assistant_mode
from retainpdf_ai.runtime import RuntimeCapabilities
from retainpdf_ai.tools import Tool, ToolRegistry


def _tool(name: str) -> Tool:
    return Tool(
        name=name,
        description=name,
        parameters={"type": "object"},
        handler=lambda _arguments: {},
    )


def test_auto_routing_is_conservative_and_honors_explicit_modes():
    assert resolve_assistant_mode("auto", "总结第三页").resolved_mode == "reading"
    assert resolve_assistant_mode("auto", "计算表格平均值").resolved_mode == "reading"
    assert resolve_assistant_mode("auto", "删除理论章节讲了什么？").resolved_mode == "reading"
    assert resolve_assistant_mode("auto", "旋转对称性是什么意思？").resolved_mode == "reading"
    assert resolve_assistant_mode("auto", "把第三页旋转 90 度").resolved_mode == "operations"
    assert resolve_assistant_mode("auto", "删除第 4 页").resolved_mode == "operations"
    assert resolve_assistant_mode("auto", "删除最后一页").resolved_mode == "operations"
    assert resolve_assistant_mode("reading", "旋转第一页").resolved_mode == "reading"
    assert resolve_assistant_mode("operations", "总结全文").resolved_mode == "operations"


def test_preselected_content_source_hides_the_other_retrieval_family():
    registry = ToolRegistry(
        [
            _tool("search_fulltext"),
            _tool("read_blocks"),
            _tool("search_markdown"),
            _tool("read_markdown_chunk"),
            _tool("calculate_expression"),
        ]
    )

    structured = {
        spec["function"]["name"]
        for spec in tool_specs_for_scope(
            registry, "doc-a", "job-a", content_source="structured"
        )
    }
    markdown = {
        spec["function"]["name"]
        for spec in tool_specs_for_scope(
            registry, "doc-a", "job-a", content_source="markdown"
        )
    }

    assert {"search_fulltext", "read_blocks"} <= structured
    assert not {"search_markdown", "read_markdown_chunk"} & structured
    assert {"search_markdown", "read_markdown_chunk"} <= markdown
    assert not {"search_fulltext", "read_blocks"} & markdown
    assert "calculate_expression" in structured & markdown


def test_closing_sse_generator_cancels_the_running_runtime():
    stopped = threading.Event()

    class CooperativeRuntime:
        runtime_id = "cooperative-runtime"
        capabilities = RuntimeCapabilities(
            document_reading=True,
            document_operations=False,
            streaming=True,
            durable_sessions=False,
            model_transport="runtime_managed",
        )

        def ask(self, _question, *, request_control=None, **_kwargs):
            try:
                while True:
                    request_control.raise_if_stopped()
                    time.sleep(0.005)
            finally:
                stopped.set()

    settings = Settings(ai_request_deadline_s=5, ai_heartbeat_interval_s=0.02)
    runtime = CooperativeRuntime()
    orchestrator = AskOrchestrator(
        settings=settings,
        runtime=runtime,  # type: ignore[arg-type]
        reading_runtime=runtime,  # type: ignore[arg-type]
        conversation_state=ConversationState(settings, None),
        chat_fn_builder=lambda _settings: None,
        confirmation_projector=lambda _result, _mode: [],
    )
    payload = AskInput(question="总结", stream=True)
    prepared = PreparedAsk(
        runtime=runtime,  # type: ignore[arg-type]
        runtime_id=runtime.runtime_id,
        settings=settings,
        route=RouteDecision("auto", "reading", "safe_reading_default"),
        content_source="unscoped",
        max_tool_rounds=3,
    )
    stream = orchestrator.sse_events(payload, prepared)

    assert '"stage": "routing"' in next(stream)
    next(stream)
    stream.close()

    assert stopped.wait(timeout=1), "runtime did not observe client disconnect"
