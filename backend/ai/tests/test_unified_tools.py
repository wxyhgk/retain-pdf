import base64
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from retainpdf_ai.agent_broker_commands import parse_broker_command
from retainpdf_ai.agent_broker_contracts import BrokerScope
from retainpdf_ai.config import Settings
from retainpdf_ai.tools import ToolRegistry
from retainpdf_ai.unified_tools import (
    agent_tool_event,
    calculation_tools,
    with_tool_context,
)


class FakeRust:
    def __init__(self) -> None:
        self.created: list[dict] = []
        self.completed: list[dict] = []
        self.failed: list[dict] = []

    def create_agent_calculation(self, **payload):
        self.created.append(payload)
        return {"calculation_id": payload["calculation_id"], "status": "running"}

    def complete_agent_calculation(self, calculation_id, *, result, artifacts):
        self.completed.append(
            {
                "calculation_id": calculation_id,
                "result": result,
                "artifacts": artifacts,
            }
        )
        return {
            "calculation_id": calculation_id,
            "status": "completed",
            "result": result,
            "artifacts": [
                {
                    "artifact_id": item["artifact_id"],
                    "kind": item["kind"],
                    "mime_type": item["mime_type"],
                    "url": f"/api/v1/ai/calculations/{calculation_id}/artifacts/{item['artifact_id']}",
                }
                for item in artifacts
            ],
        }

    def fail_agent_calculation(self, calculation_id, *, code, message):
        self.failed.append(
            {"calculation_id": calculation_id, "code": code, "message": message}
        )
        return {"calculation_id": calculation_id, "status": "failed"}


class FailingRust(FakeRust):
    def __init__(self, failure_at: str) -> None:
        super().__init__()
        self.failure_at = failure_at

    def create_agent_calculation(self, **payload):
        if self.failure_at == "create":
            raise RuntimeError("secret transport failure")
        return super().create_agent_calculation(**payload)

    def complete_agent_calculation(self, calculation_id, *, result, artifacts):
        if self.failure_at == "complete":
            raise RuntimeError("secret transport failure")
        return super().complete_agent_calculation(
            calculation_id, result=result, artifacts=artifacts
        )


def _context(arguments: dict, *, tool_call_id: str = "tool-1") -> dict:
    return with_tool_context(
        arguments,
        conversation_id="conv-a",
        request_message_id="msg-a",
        document_id="doc-a",
        job_id="job-a",
        tool_call_id=tool_call_id,
    )


def test_expression_is_durable_without_persisting_raw_input(tmp_path):
    rust = FakeRust()
    registry = ToolRegistry(calculation_tools(Settings(data_root=tmp_path), rust))

    result = registry.invoke(
        "calculate_expression",
        _context({"expression": "(12.5 + 13.7 + 15.2) / 3", "precision": 4}),
    )

    assert result["value"] == 13.8
    assert result["durable"] is True
    assert len(rust.created) == 1
    persisted_create = json.dumps(rust.created[0], ensure_ascii=False)
    assert "12.5" not in persisted_create
    assert rust.created[0]["input_refs"] == {
        "document_id": "doc-a",
        "job_id": "job-a",
    }
    assert rust.completed[0]["result"]["value"] == 13.8


def test_calculation_identity_survives_model_tool_call_id_changes(tmp_path):
    rust = FakeRust()
    registry = ToolRegistry(calculation_tools(Settings(data_root=tmp_path), rust))

    first = registry.invoke(
        "calculate_expression",
        _context({"expression": "4 * 5"}, tool_call_id="tool-first"),
    )
    second = registry.invoke(
        "calculate_expression",
        _context({"expression": "4 * 5"}, tool_call_id="tool-replayed"),
    )

    assert first["calculation_id"] == second["calculation_id"]


def test_durable_store_failures_are_redacted_and_remain_retryable(tmp_path):
    for failure_at in ("create", "complete"):
        rust = FailingRust(failure_at)
        registry = ToolRegistry(calculation_tools(Settings(data_root=tmp_path), rust))

        result = registry.invoke(
            "calculate_expression",
            _context({"expression": "8 / 2"}),
        )

        assert result["code"] == "calculation_store_unavailable"
        assert "secret" not in json.dumps(result)
        assert rust.failed == []


def test_chart_reads_authoritative_block_and_emits_controlled_svg(tmp_path):
    job_root = tmp_path / "jobs" / "job-a" / "ocr" / "normalized"
    job_root.mkdir(parents=True)
    (job_root / "document.v1.json").write_text(
        json.dumps(
            {
                "pages": [
                    {
                        "page_index": 2,
                        "blocks": [
                            {
                                "block_id": "p003-b0001",
                                "text": (
                                    "<table><tr><th>Group</th><th>Value</th></tr>"
                                    "<tr><td>A</td><td>2.5</td></tr>"
                                    "<tr><td>B</td><td>4.0</td></tr></table>"
                                ),
                                "content": {"kind": "table"},
                            }
                        ],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    rust = FakeRust()
    registry = ToolRegistry(calculation_tools(Settings(data_root=tmp_path), rust))

    result = registry.invoke(
        "generate_chart",
        _context(
            {
                "document_id": "doc-a",
                "job_id": "job-a",
                "page_idx": 2,
                "block_ids": ["p003-b0001"],
                "label_column": "Group",
                "value_column": "Value",
                "chart_type": "bar",
            }
        ),
    )

    assert result["chart"]["point_count"] == 2
    assert result["artifacts"][0]["url"].startswith("/api/v1/ai/calculations/")
    artifact = rust.completed[0]["artifacts"][0]
    svg = base64.b64decode(artifact["content_base64"]).decode("utf-8")
    assert svg.startswith("<svg")
    assert "<script" not in svg.lower()
    assert "content_base64" not in json.dumps(result)


def test_agent_tool_event_does_not_echo_arguments_or_result_values():
    event = agent_tool_event(
        "calculate_expression",
        "tool-1",
        "completed",
        {"calculation_id": "calc-a", "value": 123, "secret": "do-not-echo"},
    )

    assert event == {
        "type": "agent_tool",
        "tool_call_id": "tool-1",
        "kind": "calculation",
        "title": "Calculate expression",
        "status": "completed",
        "summary": "Calculation calc-a completed",
        "calculation_id": "calc-a",
    }


def test_fx_tool_command_is_an_exact_base64url_json_grammar():
    encoded = base64.urlsafe_b64encode(
        json.dumps({"expression": "2 + 2"}, separators=(",", ":")).encode()
    ).decode().rstrip("=")
    scope = BrokerScope("conv-a", "doc-a", "msg-a", "calculate")
    command = parse_broker_command(
        "retainpdf-agent tool call --name calculate_expression "
        f"--arguments-base64url {encoded}",
        scope,
    )

    assert command.action == "tool.call"
    assert command.request_payload == {
        "name": "calculate_expression",
        "arguments": {"expression": "2 + 2"},
    }
    for invalid in [
        (
            "retainpdf-agent tool call --name run_python_analysis "
            f"--arguments-base64url {encoded}"
        ),
        (
            "retainpdf-agent tool call --name calculate_expression "
            f"--arguments-base64url {encoded} --extra shell"
        ),
    ]:
        try:
            parse_broker_command(invalid, scope)
        except ValueError:
            pass
        else:
            raise AssertionError(f"unsafe command was accepted: {invalid}")
