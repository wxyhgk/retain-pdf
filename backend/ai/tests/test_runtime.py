import json
import os
import socket
import stat
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from retainpdf_ai.config import Settings
from retainpdf_ai.openai_agent_runtime import OpenAICompatibleAgentRuntime as OpenAIImpl
from retainpdf_ai.runtime import (
    FX_RUNTIME_ID,
    OPENAI_AGENT_RUNTIME_ID,
    FxAcpRuntime,
    OpenAICompatibleAgentRuntime,
    RuntimeCapabilities,
)


def test_runtime_facade_preserves_public_runtime_exports():
    assert OpenAICompatibleAgentRuntime is OpenAIImpl
    assert OPENAI_AGENT_RUNTIME_ID == "openai-compatible-agent-v1"
    assert RuntimeCapabilities.__module__.endswith("runtimes.contracts")


class FakeRustRuntimeSessions:
    def __init__(self):
        self.records: dict[str, dict] = {}
        self.capability_calls: list[dict] = []

    def get_agent_runtime_session(self, conversation_id: str) -> dict:
        return self.records.setdefault(
            conversation_id,
            {
                "conversation_id": conversation_id,
                "runtime_id": "",
                "session_cursor": "",
                "revision": 0,
                "updated_at": "",
            },
        ).copy()

    def put_agent_runtime_session(
        self,
        conversation_id: str,
        *,
        runtime_id: str,
        session_cursor: str,
        expected_revision: int,
    ) -> dict:
        current = self.get_agent_runtime_session(conversation_id)
        if current["revision"] != expected_revision:
            raise RuntimeError("revision conflict")
        current.update(
            {
                "runtime_id": runtime_id,
                "session_cursor": session_cursor,
                "revision": expected_revision + 1,
            }
        )
        self.records[conversation_id] = current
        return current.copy()

    def issue_agent_capability(self, **kwargs) -> dict:
        self.capability_calls.append(kwargs)
        return {"capability": "host-only-test-capability"}


def _write_fake_fx(
    path: Path,
    *,
    version: str = "0.0.5",
    expected_gateway_key: str = "",
) -> Path:
    script = f"""#!{sys.executable}
import json
import os
import sys

assert os.environ.get("AI_GATEWAY_API_KEY") == {expected_gateway_key!r} or not {bool(expected_gateway_key)!r}

def send(value):
    sys.stdout.write(json.dumps(value, separators=(\",\", \":\")) + \"\\n\")
    sys.stdout.flush()

for raw in sys.stdin:
    message = json.loads(raw)
    method = message.get(\"method\")
    request_id = message.get(\"id\")
    if method == \"initialize\":
        send({{"jsonrpc": \"2.0\", "id": request_id, "result": {{
            "protocolVersion": 1,
            "agentCapabilities": {{"loadSession": True}},
            "agentInfo": {{"name": "fx", "version": "{version}"}}
        }}}})
    elif method == \"session/new\":
        send({{"jsonrpc": "2.0", "id": request_id, "result": {{"sessionId": "fx-test-session"}}}})
    elif method == \"session/load\":
        if message.get("params", {{}}).get("sessionId") == "missing-session":
            send({{"jsonrpc": "2.0", "id": request_id, "error": {{"code": -32000, "message": "not found"}}}})
        else:
            send({{"jsonrpc": "2.0", "id": request_id, "result": {{"sessionId": message.get("params", {{}}).get("sessionId")}}}})
    elif method == \"session/set_config_option\":
        send({{"jsonrpc": "2.0", "id": request_id, "result": {{
            "configOptions": [{{"id": "mode", "currentValue": message.get("params", {{}}).get("value")}}]
        }}}})
    elif method == \"session/prompt\":
        send({{
            "jsonrpc": "2.0",
            "id": 900,
            "method": "session/request_permission",
            "params": {{
                "toolCall": {{"toolCallId": "blocked", "kind": "execute", "rawInput": {{"command": "uname"}}}},
                "options": [
                    {{"optionId": "allow_once"}},
                    {{"optionId": "reject_once"}}
                ]
            }}
        }})
        permission = json.loads(next(sys.stdin))
        option = permission.get("result", {{}}).get("outcome", {{}}).get("optionId")
        if option != "reject_once":
            sys.exit(9)
        send({{
            "jsonrpc": "2.0",
            "method": "session/update",
            "params": {{
                "sessionId": "fx-test-session",
                "update": {{
                    "sessionUpdate": "tool_call_update",
                    "toolCallId": "blocked",
                    "title": "blocked by host",
                    "kind": "execute",
                    "status": "failed"
                }}
            }}
        }})
        send({{
            "jsonrpc": "2.0",
            "method": "session/update",
            "params": {{
                "sessionId": "fx-test-session",
                "update": {{
                    "sessionUpdate": "agent_message_chunk",
                    "content": {{"type": "text", "text": "safe fx answer"}}
                }}
            }}
        }})
        send({{"jsonrpc": "2.0", "id": request_id, "result": {{"stopReason": "end_turn"}}}})
"""
    path.write_text(script, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)
    return path


def _write_oversized_fx(path: Path) -> Path:
    script = f'''#!{sys.executable}
import sys

for _raw in sys.stdin:
    sys.stdout.write("x" * (1024 * 1024 + 1))
    sys.stdout.flush()
'''
    path.write_text(script, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)
    return path


def _settings(tmp_path: Path, command: Path, **overrides) -> Settings:
    values = {
        "agent_runtime": "fx",
        "fx_command": str(command),
        "fx_expected_version": "0.0.5",
        "fx_gateway_api_key": "test-gateway-key",
        "fx_state_root": tmp_path / "fx-state",
        "fx_startup_timeout_s": 5.0,
        "fx_turn_timeout_s": 5.0,
    }
    values.update(overrides)
    return Settings(**values)


def _write_fx_credential_vault(tmp_path: Path, secret: str) -> str:
    credential_ref = "cred_fx_runtime"
    directory = tmp_path / "secrets"
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = directory / "credentials.json"
    path.write_text(
        json.dumps(
            {
                "schema": "retainpdf_credential_vault_v1",
                "revision": 1,
                "credentials": {
                    credential_ref: {
                        "kind": "fx_gateway_api_key",
                        "provider": "vercel",
                        "label": "FX Gateway",
                        "secret": secret,
                        "created_at": "2026-09-02T00:00:00Z",
                        "updated_at": "2026-09-02T00:00:00Z",
                    }
                },
            }
        ),
        encoding="utf-8",
    )
    if os.name == "posix":
        directory.chmod(0o700)
        path.chmod(0o600)
    return credential_ref


def _write_fake_cli(path: Path) -> Path:
    script = f"""#!{sys.executable}
import json
import os
import sys
print(json.dumps({{
    "ok": True,
    "capability_present": bool(os.environ.get("RETAINPDF_AGENT_CAPABILITY")),
    "api_key_present": bool(os.environ.get("RETAINPDF_AGENT_API_KEY")),
    "argv": sys.argv[1:],
}}, separators=(",", ":")))
"""
    path.write_text(script, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)
    return path


def _write_broker_using_fx(path: Path) -> Path:
    script = f"""#!{sys.executable}
import json
import subprocess
import sys

def send(value):
    sys.stdout.write(json.dumps(value, separators=(",", ":")) + "\\n")
    sys.stdout.flush()

for raw in sys.stdin:
    message = json.loads(raw)
    method = message.get("method")
    request_id = message.get("id")
    if method == "initialize":
        send({{"jsonrpc": "2.0", "id": request_id, "result": {{
            "protocolVersion": 1,
            "agentCapabilities": {{"loadSession": True}},
            "agentInfo": {{"name": "fx", "version": "0.0.5"}}
        }}}})
    elif method == "session/new":
        send({{"jsonrpc": "2.0", "id": request_id, "result": {{"sessionId": "fx-broker-session"}}}})
    elif method == "session/load":
        send({{"jsonrpc": "2.0", "id": request_id, "result": {{"sessionId": "fx-broker-session"}}}})
    elif method == "session/set_config_option":
        send({{"jsonrpc": "2.0", "id": request_id, "result": {{
            "configOptions": [{{"id": "mode", "currentValue": "ask"}}]
        }}}})
    elif method == "session/prompt":
        command = "retainpdf-agent document inspect"
        send({{
            "jsonrpc": "2.0",
            "id": 901,
            "method": "session/request_permission",
            "params": {{
                "toolCall": {{"toolCallId": "inspect", "kind": "execute", "rawInput": {{"command": command}}}},
                "options": [
                    {{"optionId": "allow_once", "kind": "allow_once"}},
                    {{"optionId": "reject_once", "kind": "reject_once"}}
                ]
            }}
        }})
        permission = json.loads(next(sys.stdin))
        option = permission.get("result", {{}}).get("outcome", {{}}).get("optionId")
        if option != "allow_once":
            sys.exit(11)
        completed = subprocess.run(command, shell=True, capture_output=True, text=True, check=False)
        if completed.returncode != 0:
            sys.stderr.write(completed.stderr)
            sys.exit(12)
        send({{
            "jsonrpc": "2.0",
            "method": "session/update",
            "params": {{"update": {{
                "sessionUpdate": "tool_call_update",
                "toolCallId": "inspect",
                "title": "RetainPDF document inspect",
                "kind": "execute",
                "status": "completed"
            }}}}
        }})
        send({{
            "jsonrpc": "2.0",
            "method": "session/update",
            "params": {{"update": {{
                "sessionUpdate": "agent_message_chunk",
                "content": {{"type": "text", "text": completed.stdout.strip()}}
            }}}}
        }})
        send({{"jsonrpc": "2.0", "id": request_id, "result": {{"stopReason": "end_turn"}}}})
"""
    path.write_text(script, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)
    return path


def _write_gateway_env_asserting_fx(
    path: Path, *, expected_base_url: str | None, expected_chat_url: str | None
) -> Path:
    script = f'''#!{sys.executable}
import json
import os
import sys

if os.environ.get("FX_GATEWAY_BASE_URL") != {expected_base_url!r}:
    sys.exit(21)
if os.environ.get("FX_GATEWAY_CHAT_URL") != {expected_chat_url!r}:
    sys.exit(22)

for raw in sys.stdin:
    message = json.loads(raw)
    if message.get("method") == "initialize":
        sys.stdout.write(json.dumps({{
            "jsonrpc": "2.0",
            "id": message.get("id"),
            "result": {{
                "protocolVersion": 1,
                "agentCapabilities": {{"loadSession": True}},
                "agentInfo": {{"name": "fx", "version": "0.0.5"}}
            }}
        }}) + "\\n")
        sys.stdout.flush()
'''
    path.write_text(script, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)
    return path


def test_fx_acp_runtime_persists_cursor_streams_and_denies_permissions(tmp_path):
    command = _write_fake_fx(tmp_path / "fake-fx")
    rust = FakeRustRuntimeSessions()
    runtime = FxAcpRuntime(_settings(tmp_path, command), rust)  # type: ignore[arg-type]
    events: list[dict] = []

    result = runtime.ask(
        "operate on the PDF",
        conversation_id="conv-a",
        history=[{"role": "user", "content": "earlier request"}],
        on_event=events.append,
    )

    assert result.answer == "safe fx answer"
    assert result.tool_trace == [
        {
            "session_update": "tool_call_update",
            "tool_call_id": "blocked",
            "title": "blocked by host",
            "kind": "execute",
            "status": "failed",
        }
    ]
    # Rejected ACP commands are not authoritative RetainPDF tools and therefore
    # must not be projected as public agent_tool events.
    assert [event["type"] for event in events] == ["answer_delta"]
    stored = rust.get_agent_runtime_session("conv-a")
    assert stored["runtime_id"] == FX_RUNTIME_ID
    assert stored["session_cursor"] == "fx-test-session"
    assert stored["revision"] == 1

    # A replacement adapter loads the durable cursor instead of creating a
    # second authoritative mapping.
    replacement = FxAcpRuntime(_settings(tmp_path, command), rust)  # type: ignore[arg-type]
    assert (
        replacement.ask("continue", conversation_id="conv-a").answer == "safe fx answer"
    )
    assert rust.get_agent_runtime_session("conv-a")["revision"] == 1


def test_fx_acp_runtime_executes_only_through_host_broker(tmp_path):
    fx = _write_broker_using_fx(tmp_path / "fake-fx")
    cli = _write_fake_cli(tmp_path / "real-retainpdf-agent")
    rust = FakeRustRuntimeSessions()
    runtime = FxAcpRuntime(
        _settings(tmp_path, fx, fx_agent_cli_command=str(cli)),
        rust,  # type: ignore[arg-type]
    )

    result = runtime.ask(
        "Inspect the current PDF",
        conversation_id="conv-a",
        document_id="doc-a",
        request_message_id="msg-a",
    )

    payload = json.loads(result.answer)
    assert payload["ok"] is True
    assert payload["capability_present"] is True
    assert payload["api_key_present"] is False
    assert payload["argv"] == ["document", "inspect", "--document-id", "doc-a"]
    assert rust.capability_calls == [
        {
            "conversation_id": "conv-a",
            "document_id": "doc-a",
            "actions": ["document.inspect"],
            "ttl_seconds": 60,
        }
    ]


def test_fx_acp_runtime_rebuilds_when_local_session_is_missing(tmp_path):
    command = _write_fake_fx(tmp_path / "fake-fx")
    rust = FakeRustRuntimeSessions()
    rust.records["conv-lost"] = {
        "conversation_id": "conv-lost",
        "runtime_id": FX_RUNTIME_ID,
        "session_cursor": "missing-session",
        "revision": 4,
        "updated_at": "",
    }
    runtime = FxAcpRuntime(_settings(tmp_path, command), rust)  # type: ignore[arg-type]

    result = runtime.ask(
        "recover",
        conversation_id="conv-lost",
        history=[{"role": "assistant", "content": "durable transcript"}],
    )

    assert result.answer == "safe fx answer"
    stored = rust.get_agent_runtime_session("conv-lost")
    assert stored["session_cursor"] == "fx-test-session"
    assert stored["revision"] == 5


def test_fx_acp_runtime_fails_closed_on_version_mismatch(tmp_path):
    command = _write_fake_fx(tmp_path / "fake-fx", version="0.0.6")
    runtime = FxAcpRuntime(
        _settings(tmp_path, command),
        FakeRustRuntimeSessions(),  # type: ignore[arg-type]
    )

    capability = runtime.probe()
    assert capability.available is False
    assert capability.actual_version == "0.0.6"
    with pytest.raises(RuntimeError, match="version mismatch"):
        runtime.ask("hello", conversation_id="conv-version")


def test_fx_acp_runtime_rejects_oversized_frame_without_unbounded_read(tmp_path):
    command = _write_oversized_fx(tmp_path / "oversized-fx")
    runtime = FxAcpRuntime(
        _settings(tmp_path, command),
        FakeRustRuntimeSessions(),  # type: ignore[arg-type]
    )

    capability = runtime.probe()

    assert capability.available is False
    assert "frame exceeded" in capability.detail


def test_fx_acp_runtime_requires_private_gateway_key(tmp_path):
    command = _write_fake_fx(tmp_path / "fake-fx")
    runtime = FxAcpRuntime(
        _settings(tmp_path, command, fx_gateway_api_key=""),
        FakeRustRuntimeSessions(),  # type: ignore[arg-type]
    )
    with pytest.raises(RuntimeError, match="FX_GATEWAY_API_KEY or"):
        runtime.ask("hello", conversation_id="conv-no-key")


def test_fx_subprocess_resolves_gateway_credential_ref_at_launch(tmp_path):
    secret = "gateway-key-from-shared-vault"
    credential_ref = _write_fx_credential_vault(tmp_path, secret)
    command = _write_fake_fx(
        tmp_path / "fake-fx",
        expected_gateway_key=secret,
    )
    runtime = FxAcpRuntime(
        _settings(
            tmp_path,
            command,
            fx_gateway_api_key="",
            fx_gateway_credential_ref=credential_ref,
            data_root=tmp_path,
        ),
        FakeRustRuntimeSessions(),  # type: ignore[arg-type]
    )

    capability = runtime.probe()

    assert capability.available is True


def test_fx_acp_runtime_accepts_host_openai_bridge_without_gateway_key(tmp_path):
    command = _write_fake_fx(tmp_path / "fake-fx")
    runtime = FxAcpRuntime(
        _settings(
            tmp_path,
            command,
            fx_gateway_api_key="",
            fx_model="qwen-test",
            fx_openai_base_url="http://127.0.0.1:9/v1",
        ),
        FakeRustRuntimeSessions(),  # type: ignore[arg-type]
    )

    capability = runtime.probe()

    assert capability.available is True
    assert capability.actual_version == "0.0.5"


def test_fx_acp_runtime_passes_base_and_actual_chat_url_to_subprocess(tmp_path):
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen()
        port = listener.getsockname()[1]
        base_url = f"http://127.0.0.1:{port}/gateway"
        command = _write_gateway_env_asserting_fx(
            tmp_path / "fake-fx",
            expected_base_url=base_url,
            expected_chat_url=f"{base_url}/v3/ai/language-model",
        )
        runtime = FxAcpRuntime(
            _settings(tmp_path, command, fx_gateway_base_url=f"{base_url}/"),
            FakeRustRuntimeSessions(),  # type: ignore[arg-type]
        )

        capability = runtime.probe()

    assert capability.available is True
    assert capability.actual_version == "0.0.5"


def test_fx_acp_runtime_rejects_unreachable_custom_gateway_before_fx_start(tmp_path):
    with socket.socket() as reserved:
        reserved.bind(("127.0.0.1", 0))
        port = reserved.getsockname()[1]
    marker = tmp_path / "fx-started"
    command = tmp_path / "fake-fx"
    command.write_text(
        f"#!{sys.executable}\nfrom pathlib import Path\nPath({str(marker)!r}).touch()\n",
        encoding="utf-8",
    )
    command.chmod(command.stat().st_mode | stat.S_IXUSR)
    runtime = FxAcpRuntime(
        _settings(
            tmp_path,
            command,
            fx_gateway_base_url=f"http://127.0.0.1:{port}/gateway",
        ),
        FakeRustRuntimeSessions(),  # type: ignore[arg-type]
    )

    capability = runtime.probe()

    assert capability.available is False
    assert "unreachable" in capability.detail
    assert marker.exists() is False


def test_fx_acp_runtime_leaves_fx_default_gateway_when_url_is_empty(tmp_path):
    command = _write_gateway_env_asserting_fx(
        tmp_path / "fake-fx",
        expected_base_url=None,
        expected_chat_url=None,
    )
    runtime = FxAcpRuntime(
        _settings(tmp_path, command, fx_gateway_base_url=""),
        FakeRustRuntimeSessions(),  # type: ignore[arg-type]
    )

    capability = runtime.probe()

    assert capability.available is True
    assert capability.actual_version == "0.0.5"


def test_fx_acp_runtime_rejects_remote_url_before_subprocess_start(tmp_path):
    marker = tmp_path / "fx-started"
    command = tmp_path / "fake-fx"
    command.write_text(
        f"#!{sys.executable}\nfrom pathlib import Path\nPath({str(marker)!r}).touch()\n",
        encoding="utf-8",
    )
    command.chmod(command.stat().st_mode | stat.S_IXUSR)
    runtime = FxAcpRuntime(
        _settings(
            tmp_path,
            command,
            fx_gateway_base_url="https://gateway.example",
        ),
        FakeRustRuntimeSessions(),  # type: ignore[arg-type]
    )

    capability = runtime.probe()

    assert capability.available is False
    assert "FX 0.0.5" in capability.detail
    assert marker.exists() is False
