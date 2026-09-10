from __future__ import annotations

from contextlib import redirect_stderr, redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import pytest


SCRIPT = Path(__file__).resolve().parents[1] / "agent_e2e.py"
SPEC = importlib.util.spec_from_file_location("agent_e2e", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
agent_e2e = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = agent_e2e
SPEC.loader.exec_module(agent_e2e)


def _executable(path: Path, content: str = "") -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    path.chmod(0o700)
    return path


@pytest.fixture(autouse=True)
def isolated_backend_python(tmp_path, monkeypatch):
    """Doctor tests must not depend on an installed checkout-local environment."""
    backend = tmp_path / "backend"
    _executable(backend / ".venv/bin/python")
    monkeypatch.setattr(agent_e2e, "SERVICES_ROOT", backend)


def _completed(command, returncode=0, stdout="", stderr=""):
    return subprocess.CompletedProcess(command, returncode, stdout, stderr)


def _doctor_version_run(fx_version="0.0.5"):
    def run(command, **kwargs):
        output = fx_version if Path(command[0]).name == "fx" else "Python 3.11.9"
        return _completed(command, stdout=f"{output}\n")

    return run


def test_doctor_never_serializes_credential_values(tmp_path):
    fx = _executable(tmp_path / "fx")
    cli = _executable(tmp_path / "retainpdf-agent")
    secrets = {
        "RETAIN_AI_FX_GATEWAY_API_KEY": "gateway-super-secret",
        "RETAIN_AI_API_KEYS": "service-super-secret",
        "RETAIN_AI_RUST_API_KEY": "rust-super-secret",
        "RETAIN_AI_LLM_API_KEY": "llm-super-secret",
    }
    report = agent_e2e.collect_doctor_report(
        environ={
            **secrets,
            "RETAIN_AI_RUNTIME": "fx",
            "RETAIN_AI_FX_COMMAND": str(fx),
            "RETAIN_AI_FX_AGENT_CLI_COMMAND": str(cli),
        },
        run=_doctor_version_run(),
        which=lambda command: None,
    )

    serialized = json.dumps(report)
    assert report["ok"] is True
    assert all(secret not in serialized for secret in secrets.values())
    assert set(report["checks"]["credentials"].values()) == {"present"}


def test_doctor_reports_fx_version_mismatch(tmp_path):
    fx = _executable(tmp_path / "fx")
    cli = _executable(tmp_path / "retainpdf-agent")
    report = agent_e2e.collect_doctor_report(
        environ={
            "RETAIN_AI_RUNTIME": "fx",
            "RETAIN_AI_FX_COMMAND": str(fx),
            "RETAIN_AI_FX_AGENT_CLI_COMMAND": str(cli),
            "RETAIN_AI_FX_GATEWAY_API_KEY": "present-value",
            "RETAIN_AI_API_KEYS": "present-value",
            "RETAIN_AI_RUST_API_KEY": "present-value",
        },
        run=_doctor_version_run("0.0.6"),
        which=lambda command: None,
    )

    assert report["ok"] is False
    assert report["checks"]["fx"]["status"] == "version_mismatch"
    assert report["checks"]["fx"]["version"] == "0.0.6"


def test_doctor_validates_fx_gateway_url_without_serializing_invalid_value(tmp_path):
    fx = _executable(tmp_path / "fx")
    cli = _executable(tmp_path / "retainpdf-agent")
    base = {
        "RETAIN_AI_RUNTIME": "fx",
        "RETAIN_AI_FX_COMMAND": str(fx),
        "RETAIN_AI_FX_AGENT_CLI_COMMAND": str(cli),
        "RETAIN_AI_FX_GATEWAY_API_KEY": "present-value",
        "RETAIN_AI_API_KEYS": "present-value",
        "RETAIN_AI_RUST_API_KEY": "present-value",
    }
    valid = agent_e2e.collect_doctor_report(
        environ={
            **base,
            "RETAIN_AI_FX_GATEWAY_BASE_URL": "http://127.0.0.1:43231/gateway/",
        },
        run=_doctor_version_run(),
        which=lambda command: None,
    )
    invalid_value = "http://user:do-not-serialize@127.0.0.1:43231"
    invalid = agent_e2e.collect_doctor_report(
        environ={**base, "RETAIN_AI_FX_GATEWAY_BASE_URL": invalid_value},
        run=_doctor_version_run(),
        which=lambda command: None,
    )

    assert valid["ok"] is True
    assert valid["checks"]["fx_gateway"] == {
        "status": "ok",
        "base_url": "http://127.0.0.1:43231/gateway",
        "chat_url": "http://127.0.0.1:43231/gateway/v3/ai/language-model",
    }
    assert invalid["ok"] is False
    assert invalid["checks"]["fx_gateway"]["status"] == "invalid"
    assert invalid_value not in json.dumps(invalid)
    assert "do-not-serialize" not in json.dumps(invalid)


def test_doctor_uses_private_persisted_runtime_config(tmp_path):
    fx = _executable(tmp_path / "fx")
    cli = _executable(tmp_path / "retainpdf-agent")
    from retainpdf_ai.runtime_credentials import save_runtime_credentials

    save_runtime_credentials(
        tmp_path,
        {
            "agent_runtime": "fx",
            "fx_gateway_api_key": "persisted-gateway-secret",
            "fx_gateway_base_url": "",
            "fx_gateway_base_url_mode": "official_default",
        },
    )

    report = agent_e2e.collect_doctor_report(
        environ={
            "RETAIN_AI_DATA_ROOT": str(tmp_path),
            "RETAIN_AI_RUNTIME": "python",
            "RETAIN_AI_FX_COMMAND": str(fx),
            "RETAIN_AI_FX_AGENT_CLI_COMMAND": str(cli),
            "RETAIN_AI_API_KEYS": "service-key",
            "RETAIN_AI_RUST_API_KEY": "rust-key",
        },
        run=_doctor_version_run(),
        which=lambda command: None,
    )

    serialized = json.dumps(report)
    assert report["ok"] is True
    assert report["checks"]["runtime"] == {"status": "ok", "value": "fx"}
    assert report["checks"]["runtime_config"]["source"] == "persisted"
    assert report["checks"]["runtime_config"]["revision"] == 1
    assert report["checks"]["fx_gateway"]["status"] == "default"
    assert "persisted-gateway-secret" not in serialized


def test_doctor_does_not_restore_environment_key_after_persisted_clear(tmp_path):
    from retainpdf_ai.runtime_credentials import save_runtime_credentials

    save_runtime_credentials(
        tmp_path,
        {
            "agent_runtime": "python",
            "llm_api_key": "",
        },
    )

    report = agent_e2e.collect_doctor_report(
        environ={
            "RETAIN_AI_DATA_ROOT": str(tmp_path),
            "RETAIN_AI_RUNTIME": "python",
            "RETAIN_AI_LLM_API_KEY": "environment-key-must-not-return",
            "RETAIN_AI_API_KEYS": "service-key",
            "RETAIN_AI_RUST_API_KEY": "rust-key",
        },
        which=lambda command: None,
    )

    assert report["ok"] is False
    assert report["checks"]["credentials"]["llm_api_key"] == "missing"
    assert "environment-key-must-not-return" not in json.dumps(report)


def test_doctor_only_requires_fx_tools_for_fx_runtime():
    report = agent_e2e.collect_doctor_report(
        run=_doctor_version_run(),
        environ={
            "RETAIN_AI_RUNTIME": "python",
            "RUST_API_KEYS": "present-value",
            "RETAIN_AI_LLM_API_KEY": "present-value",
        },
        which=lambda command: None,
    )

    assert report["ok"] is True
    assert report["checks"]["fx"]["status"] == "missing"


def test_doctor_openai_runtime_requires_model_key_and_agent_cli(tmp_path):
    cli = _executable(tmp_path / "retainpdf-agent")
    base = {
        "RETAIN_AI_RUNTIME": "openai",
        "RETAIN_AI_API_KEYS": "present-value",
        "RETAIN_AI_RUST_API_KEY": "present-value",
        "RETAIN_AI_FX_AGENT_CLI_COMMAND": str(cli),
    }
    missing_key = agent_e2e.collect_doctor_report(
        run=_doctor_version_run(),
        environ=base,
        which=lambda command: None,
    )
    assert missing_key["ok"] is False

    ready = agent_e2e.collect_doctor_report(
        run=_doctor_version_run(),
        environ={**base, "RETAIN_AI_LLM_API_KEY": "present-value"},
        which=lambda command: None,
    )
    assert ready["ok"] is True
    assert ready["checks"]["retainpdf_agent"]["status"] == "ok"
    assert ready["checks"]["fx"]["status"] == "missing"


class _HealthResponse:
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def getcode(self):
        return self.status

    def read(self, limit):
        assert limit == 65_537
        return b'{"ok":true}'


def test_doctor_live_endpoint_reports_running(tmp_path):
    fx = _executable(tmp_path / "fx")
    cli = _executable(tmp_path / "retainpdf-agent")
    opened = []

    def fake_open(request, *, timeout):
        opened.append((request.full_url, timeout))
        return _HealthResponse()

    report = agent_e2e.collect_doctor_report(
        environ={
            "RETAIN_AI_RUNTIME": "fx",
            "RETAIN_AI_FX_COMMAND": str(fx),
            "RETAIN_AI_FX_AGENT_CLI_COMMAND": str(cli),
            "RETAIN_AI_FX_GATEWAY_API_KEY": "present-value",
            "RETAIN_AI_API_KEYS": "present-value",
            "RETAIN_AI_RUST_API_KEY": "present-value",
        },
        probe_live=True,
        run=_doctor_version_run(),
        which=lambda command: None,
        open_url=fake_open,
    )

    assert report["ok"] is True
    assert report["checks"]["endpoints"]["rust"]["status"] == "running"
    assert report["checks"]["endpoints"]["ai"]["status"] == "running"
    assert opened == [
        (agent_e2e.DEFAULT_RUST_HEALTH_URL, 1.5),
        (agent_e2e.DEFAULT_AI_HEALTH_URL, 1.5),
    ]


def test_smoke_constructs_sync_build_and_focused_tests_with_venv_python():
    calls = []

    def fake_run(command, **kwargs):
        calls.append((command, kwargs))
        return _completed(command)

    output = io.StringIO()
    with redirect_stdout(output):
        exit_code = agent_e2e.run_smoke(
            environ={"PATH": "/usr/bin", "API_KEY": "must-not-leak"},
            run=fake_run,
        )

    assert exit_code == 0
    assert [call[0] for call in calls] == [
        ["uv", "sync", "--project", "backend", "--locked", "--all-extras"],
        [
            "cargo",
            "build",
            "--locked",
            "--manifest-path",
            "backend/api/Cargo.toml",
            "--bin",
            "retainpdf-agent",
        ],
        [
            "cargo",
            "test",
            "--locked",
            "--manifest-path",
            "backend/api/Cargo.toml",
            "--lib",
            "api_tests::document_operations::restricted_page_program_produces_validates_and_commits_a_real_pdf",
            "--",
            "--exact",
        ],
        [
            "uv",
            "run",
            "--project",
            "backend",
            "--locked",
            "python",
            "-m",
            "pytest",
            "backend/ai/tests/test_fx_command_broker.py",
            "backend/ai/tests/test_runtime.py",
            "tests/e2e/agent/tests/test_agent_live_e2e.py",
            "-q",
        ],
    ]
    expected_python = str(agent_e2e.SERVICES_ROOT / ".venv" / "bin" / "python")
    for _, kwargs in calls:
        assert "shell" not in kwargs
        assert kwargs["env"]["PYTHON_BIN"] == expected_python
        assert kwargs["env"]["PATH"].startswith(str(Path(expected_python).parent))
        assert "API_KEY" not in kwargs["env"]
        assert kwargs["timeout"] == agent_e2e.DEFAULT_TIMEOUT_SECONDS
    assert "must-not-leak" not in output.getvalue()


def test_smoke_stops_on_first_failure_and_redacts_diagnostic():
    calls = []

    def fake_run(command, **kwargs):
        calls.append(command)
        if len(calls) == 2:
            return _completed(
                command,
                returncode=7,
                stderr="API_KEY=top-secret-value build failed",
            )
        return _completed(command)

    stdout = io.StringIO()
    stderr = io.StringIO()
    with redirect_stdout(stdout), redirect_stderr(stderr):
        exit_code = agent_e2e.run_smoke(
            environ={"PATH": "/usr/bin", "API_KEY": "top-secret-value"},
            run=fake_run,
        )

    assert exit_code == 7
    assert len(calls) == 2
    assert "top-secret-value" not in stderr.getvalue()
    assert "[REDACTED]" in stderr.getvalue()
