import base64
import hashlib
import json
import os
import stat
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from retainpdf_ai.fx_command_broker import (
    BrokerScope,
    FxCommandBroker,
    _safe_operation_event,
    parse_broker_command,
)
from retainpdf_ai.tools import Tool, ToolRegistry


class FakeCapabilityIssuer:
    def __init__(self):
        self.calls: list[dict] = []

    def issue_agent_capability(self, **kwargs) -> dict:
        self.calls.append(kwargs)
        return {"capability": "secret-host-only-capability"}


def _scope(*, confirmed: bool = False, green_light: bool = False) -> BrokerScope:
    return BrokerScope(
        conversation_id="conv-a",
        document_id="doc-a",
        request_message_id="msg-a",
        intent_summary="Rotate the requested pages",
        confirmed=confirmed,
        green_light=green_light,
    )


def _fake_cli(path: Path) -> Path:
    source = f"""#!{sys.executable}
import json
import os
import sys
from pathlib import Path

args = sys.argv[1:]
payload = None
if "--request" in args:
    index = args.index("--request")
    payload = json.loads(Path(args[index + 1]).read_text(encoding="utf-8"))
print(json.dumps({{
    "capability_present": bool(os.environ.get("RETAINPDF_AGENT_CAPABILITY")),
    "capability_value": os.environ.get("RETAINPDF_AGENT_CAPABILITY"),
    "api_key_present": bool(os.environ.get("RETAINPDF_AGENT_API_KEY")),
    "argv": args,
    "payload": payload,
}}, separators=(",", ":")))
"""
    path.write_text(source, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)
    return path


def _permission(command: str) -> dict:
    return {
        "toolCall": {
            "toolCallId": "tool-a",
            "kind": "execute",
            "rawInput": {"command": command},
        },
        "options": [
            {"optionId": "allow_once", "kind": "allow_once"},
            {"optionId": "reject_once", "kind": "reject_once"},
        ],
    }


def _encoded_program(program: dict) -> str:
    canonical = json.dumps(
        program, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode()
    return base64.urlsafe_b64encode(canonical).decode().rstrip("=")


def test_parser_is_an_exact_shell_free_grammar():
    scope = _scope()
    inspect = parse_broker_command("retainpdf-agent document inspect", scope)
    assert inspect.action == "document.inspect"
    assert inspect.cli_argv[-1] == "doc-a"

    created = parse_broker_command(
        f"retainpdf-agent operation create --program-sha256 {'a' * 64}",
        scope,
    )
    assert created.request_payload["conversation_id"] == "conv-a"
    assert created.request_payload["request_message_id"] == "msg-a"
    assert created.request_payload["document_id"] == "doc-a"

    program = {
        "schema": "retainpdf_page_program_v1",
        "steps": [{"op": "rotate_pages", "pages": [1, 3], "degrees": 90}],
    }
    encoded = _encoded_program(program)
    executable = parse_broker_command(
        f"retainpdf-agent operation create --program-base64url {encoded}",
        scope,
    )
    canonical = json.dumps(
        program, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode()
    assert executable.request_payload["program"] == program
    assert (
        executable.request_payload["program_sha256"]
        == hashlib.sha256(canonical).hexdigest()
    )
    json_command = (
        f"retainpdf-agent operation create --program-json '{canonical.decode()}'"
    )
    from_json = parse_broker_command(json_command, scope)
    assert from_json.request_payload["program"] == program
    assert (
        from_json.request_payload["program_sha256"]
        == executable.request_payload["program_sha256"]
    )

    for command in [
        "retainpdf-agent document inspect; uname",
        "retainpdf-agent document inspect $(uname)",
        "retainpdf-agent document inspect > leak.txt",
        "/tmp/retainpdf-agent document inspect",
        "retainpdf-agent operation get --operation-id ../escape",
        "retainpdf-agent operation get --operation-id op-a --extra value",
        "retainpdf-agent operation create --program-base64url eyJzY2hlbWEiOiJ4Iiwic3RlcHMiOltdfQ",
    ]:
        with pytest.raises(ValueError):
            parse_broker_command(command, scope)


def test_cli_operation_response_projects_only_safe_sse_identity():
    command = parse_broker_command(
        f"retainpdf-agent operation create --program-sha256 {'a' * 64}",
        _scope(),
    )
    stdout = json.dumps(
        {
            "schema": "retainpdf_agent_cli_response_v1",
            "ok": True,
            "response": {
                "code": 0,
                "data": {
                    "operation_id": "op-safe-1",
                    "conversation_id": "conv-a",
                    "request_message_id": "msg-a",
                    "status": "draft",
                    "current_attempt": 1,
                    "events": [{"seq": 2}, {"seq": 4}],
                    "manifest": {"artifact_key": "must-not-leak"},
                    "state": {"stderr": "must-not-leak"},
                },
            },
        }
    )
    assert _safe_operation_event(command, stdout, _scope()) == {
        "type": "agent_operation",
        "event_id": "op-safe-1:1:4:draft",
        "operation_id": "op-safe-1",
        "conversation_id": "conv-a",
        "request_message_id": "msg-a",
        "status": "draft",
        "current_attempt": 1,
        "latest_event_seq": 4,
    }
    malformed = json.loads(stdout)
    malformed["response"]["data"]["current_attempt"] = "not-a-number"
    assert _safe_operation_event(command, json.dumps(malformed), _scope()) is None


def test_run_and_commit_require_request_level_confirmation():
    command = "retainpdf-agent operation run --operation-id op-safe"
    with pytest.raises(ValueError, match="confirmation"):
        parse_broker_command(command, _scope(confirmed=False))
    allowed = parse_broker_command(command, _scope(confirmed=True))
    assert allowed.request_payload["confirmed"] is True
    assert allowed.action == "operation.run"

    green_light = parse_broker_command(
        command, _scope(confirmed=False, green_light=True)
    )
    assert green_light.request_payload["confirmed"] is True
    assert "outside the listed grammar" in FxCommandBroker(
        state_root=Path("/tmp/retainpdf-test-unused"),
        cli_command="retainpdf-agent",
        rust_api_url="http://127.0.0.1:41000",
        rust=FakeCapabilityIssuer(),
        scope=_scope(green_light=True),
    ).instructions


def test_run_retry_keeps_one_tool_and_requires_explicit_ambiguous_risk():
    failed = parse_broker_command(
        "retainpdf-agent operation run --operation-id op-safe --retry failed",
        _scope(confirmed=True),
    )
    assert failed.action == "operation.run"
    assert failed.request_payload["retry"] is True
    assert failed.request_payload["accept_duplicate_risk"] is False

    ambiguous = parse_broker_command(
        "retainpdf-agent operation run --operation-id op-safe --retry ambiguous "
        "--accept-duplicate-risk yes",
        _scope(confirmed=True),
    )
    assert ambiguous.action == "operation.run"
    assert ambiguous.request_payload["retry"] is True
    assert ambiguous.request_payload["accept_duplicate_risk"] is True

    for command in [
        "retainpdf-agent operation run --operation-id op-safe --retry ambiguous",
        (
            "retainpdf-agent operation run --operation-id op-safe --retry failed "
            "--accept-duplicate-risk yes"
        ),
        (
            "retainpdf-agent operation run --operation-id op-safe --retry ambiguous "
            "--accept-duplicate-risk no"
        ),
    ]:
        with pytest.raises(ValueError):
            parse_broker_command(command, _scope(confirmed=True))


def test_permission_requires_an_allow_once_option(tmp_path):
    broker = FxCommandBroker(
        state_root=tmp_path / "state",
        cli_command="retainpdf-agent",
        rust_api_url="http://127.0.0.1:41000",
        rust=FakeCapabilityIssuer(),
        scope=_scope(),
    )
    permission = _permission("retainpdf-agent document inspect")
    permission["options"] = [{"optionId": "reject_once", "kind": "reject_once"}]

    assert broker.approve_permission(permission) is False


def test_fixed_host_tool_emits_backend_owned_running_and_terminal_events(tmp_path):
    events: list[dict] = []
    registry = ToolRegistry(
        [
            Tool(
                name="calculate_expression",
                description="test",
                parameters={"type": "object"},
                handler=lambda _arguments: {
                    "calculation_id": "calc-a",
                    "durable": True,
                },
            )
        ]
    )
    encoded = base64.urlsafe_b64encode(b'{"expression":"2+2"}').decode().rstrip("=")
    command = (
        "retainpdf-agent tool call --name calculate_expression "
        f"--arguments-base64url {encoded}"
    )
    with FxCommandBroker(
        state_root=tmp_path / "state",
        cli_command="retainpdf-agent",
        rust_api_url="http://127.0.0.1:41000",
        rust=FakeCapabilityIssuer(),
        scope=_scope(),
        tool_registry=registry,
        on_tool_event=events.append,
    ) as broker:
        assert broker.approve_permission(_permission(command)) is True
        completed = subprocess.run(
            [
                str(broker.bin_dir / "retainpdf-agent"),
                "tool",
                "call",
                "--name",
                "calculate_expression",
                "--arguments-base64url",
                encoded,
            ],
            capture_output=True,
            text=True,
            check=False,
            timeout=5,
        )

    assert completed.returncode == 0, completed.stderr
    assert [event["status"] for event in events] == ["running", "completed"]
    assert {event["kind"] for event in events} == {"calculation"}
    assert {event["tool_call_id"] for event in events} == {"tool-a"}
    assert all("2+2" not in json.dumps(event) for event in events)


def test_wrapper_never_receives_rust_credentials_and_broker_injects_scope(tmp_path):
    rust = FakeCapabilityIssuer()
    cli = _fake_cli(tmp_path / "real-retainpdf-agent")
    broker = FxCommandBroker(
        state_root=tmp_path / "state",
        cli_command=str(cli),
        rust_api_url="http://127.0.0.1:41000",
        rust=rust,
        scope=_scope(),
    )
    with broker:
        command = f"retainpdf-agent operation create --program-sha256 {'b' * 64}"
        assert broker.approve_permission(_permission(command)) is True
        wrapper = broker.bin_dir / "retainpdf-agent"
        wrapper_source = wrapper.read_text(encoding="utf-8")
        assert "secret-host-only-capability" not in wrapper_source
        env = {
            "PATH": str(broker.bin_dir),
            "HOME": str(tmp_path / "fx-home"),
        }
        completed = subprocess.run(
            [str(wrapper), "operation", "create", "--program-sha256", "b" * 64],
            env=env,
            capture_output=True,
            text=True,
            check=False,
            timeout=5,
        )

        assert completed.returncode == 0, completed.stderr
        result = json.loads(completed.stdout)
        assert result["capability_present"] is True
        assert result["capability_value"] == "[REDACTED]"
        assert result["api_key_present"] is False
        assert result["payload"]["conversation_id"] == "conv-a"
        assert result["payload"]["document_id"] == "doc-a"
        assert result["payload"]["request_message_id"] == "msg-a"
        assert os.environ.get("RETAINPDF_AGENT_CAPABILITY") is None
        assert rust.calls == [
            {
                "conversation_id": "conv-a",
                "document_id": "doc-a",
                "actions": ["operation.create"],
                "ttl_seconds": 60,
            }
        ]


def test_wrapper_command_is_single_use(tmp_path):
    rust = FakeCapabilityIssuer()
    cli = _fake_cli(tmp_path / "real-retainpdf-agent")
    with FxCommandBroker(
        state_root=tmp_path / "state",
        cli_command=str(cli),
        rust_api_url="http://127.0.0.1:41000",
        rust=rust,
        scope=_scope(),
    ) as broker:
        assert broker.approve_permission(
            _permission("retainpdf-agent document inspect")
        )
        wrapper = broker.bin_dir / "retainpdf-agent"
        first = subprocess.run(
            [str(wrapper), "document", "inspect"],
            capture_output=True,
            text=True,
            check=False,
            timeout=5,
        )
        second = subprocess.run(
            [str(wrapper), "document", "inspect"],
            capture_output=True,
            text=True,
            check=False,
            timeout=5,
        )
        assert first.returncode == 0
        assert second.returncode == 1
        assert "not approved" in second.stderr
        assert len(rust.calls) == 1
