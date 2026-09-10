from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "agent_live_e2e.py"
SPEC = importlib.util.spec_from_file_location("agent_live_e2e", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
agent_live_e2e = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = agent_live_e2e
SPEC.loader.exec_module(agent_live_e2e)
pdf_check = importlib.import_module("agent_live.pdf_check")
scenarios = importlib.import_module("agent_live.scenarios")


def _options(tmp_path: Path, *args: str):
    return agent_live_e2e.parse_args(
        ["--fixture", str(tmp_path / "fixture.pdf"), *args]
    )


def test_cli_entrypoint_stays_thin():
    source = SCRIPT.read_text(encoding="utf-8")
    assert len(source.splitlines()) < 220
    assert "def _request_json" not in source
    assert "def _verify_candidate" not in source


def test_missing_gateway_key_fails_before_startup(tmp_path: Path):
    with pytest.raises(agent_live_e2e.LiveE2EError, match="GATEWAY_API_KEY"):
        agent_live_e2e.stack.gateway_key(_options(tmp_path), {})


def test_openai_compatible_bridge_does_not_require_gateway_key(tmp_path: Path):
    assert (
        agent_live_e2e.stack.gateway_key(
            _options(tmp_path),
            {"RETAIN_AI_FX_OPENAI_BASE_URL": "http://127.0.0.1:8000/v1"},
        )
        == "retainpdf-loopback-bridge"
    )


def test_restart_recovery_scenario_is_selectable(tmp_path: Path):
    options = _options(tmp_path, "--scenario", "restart-recovery")
    assert options.scenario == "restart-recovery"


def test_main_reports_missing_gateway_key_without_traceback(capsys):
    assert agent_live_e2e.main([]) == 1
    captured = capsys.readouterr()
    assert "GATEWAY_API_KEY" in captured.err
    assert "Traceback" not in captured.err


def test_data_root_must_be_isolated(tmp_path: Path):
    occupied = tmp_path / "occupied"
    occupied.mkdir()
    (occupied / "user-data").write_text("keep", encoding="utf-8")
    with pytest.raises(agent_live_e2e.LiveE2EError, match="empty directory"):
        agent_live_e2e.stack.prepare_data_root(
            _options(tmp_path, "--data-root", str(occupied))
        )
    assert (occupied / "user-data").read_text(encoding="utf-8") == "keep"


def test_multipart_contains_pdf_without_changing_fixture(tmp_path: Path):
    fixture = tmp_path / "fixture.pdf"
    fixture.write_bytes(b"%PDF-safe-fixture")
    body, content_type = pdf_check.multipart_pdf(fixture)
    assert b"%PDF-safe-fixture" in body
    assert b'filename="retainpdf-live-fixture.pdf"' in body
    assert content_type.startswith("multipart/form-data; boundary=")
    assert fixture.read_bytes() == b"%PDF-safe-fixture"


def test_operation_discovery_requires_exactly_one_durable_operation(tmp_path: Path):
    operations = tmp_path / "operations"
    operations.mkdir()
    (operations / "runs").mkdir()
    with pytest.raises(agent_live_e2e.LiveE2EError, match="found 0"):
        pdf_check.operation_id(tmp_path)
    (operations / "op-one").mkdir()
    assert pdf_check.operation_id(tmp_path) == "op-one"
    (operations / "op-two").mkdir()
    with pytest.raises(agent_live_e2e.LiveE2EError, match="found 2"):
        pdf_check.operation_id(tmp_path)


def test_candidate_path_cannot_escape_data_root(tmp_path: Path):
    operation = {
        "status": "committed",
        "candidate_version": {
            "status": "committed",
            "artifact_key": "../outside.pdf",
        },
    }
    with pytest.raises(agent_live_e2e.LiveE2EError, match="escaped"):
        pdf_check.verify_candidate(tmp_path, operation)


def test_diagnostic_redacts_all_supplied_secrets(tmp_path: Path):
    log = tmp_path / "stack.log"
    log.write_text(
        "gateway-secret\nAPI_KEY=api-secret\nnormal diagnostic\n",
        encoding="utf-8",
    )
    output = agent_live_e2e.stack.diagnostic_tail(log, ("gateway-secret", "api-secret"))
    assert "gateway-secret" not in output
    assert "api-secret" not in output
    assert "normal diagnostic" in output


def test_only_sensitive_environment_names_feed_log_redaction():
    values = agent_live_e2e.stack.sensitive_environment_values(
        {
            "PATH": "/ordinary/path",
            "PORT": "41000",
            "API_KEY": "secret-value",
            "ACCESS_TOKEN": "token-value",
        }
    )
    assert values == ("secret-value", "token-value")


def test_candidate_verifier_accepts_only_expected_pdf_shape(
    tmp_path: Path, monkeypatch
):
    data_root = tmp_path / "data"
    candidate = data_root / "operations" / "op-one" / "candidate.pdf"
    candidate.parent.mkdir(parents=True)
    candidate.write_bytes(b"%PDF")
    python = pdf_check.SERVICES_ROOT / ".venv" / "bin" / "python"
    monkeypatch.setattr(
        Path, "is_file", lambda self: True if self == python else self.exists()
    )
    monkeypatch.setattr(
        pdf_check.subprocess,
        "run",
        lambda *args, **kwargs: subprocess.CompletedProcess(
            args[0],
            0,
            json.dumps(
                {
                    "source": {"pages": 3, "rotations": [0, 0, 0]},
                    "candidate": {"pages": 4, "rotations": [0, 90, 0, 0]},
                }
            ),
            "",
        ),
    )
    result = pdf_check.verify_candidate(
        data_root,
        {
            "status": "committed",
            "candidate_version": {
                "status": "committed",
                "artifact_key": "operations/op-one/candidate.pdf",
                "content_sha256": "abc",
            },
        },
    )
    assert result["pages"] == 4
    assert result["rotations"] == [0, 90, 0, 0]


def test_restart_recovery_run_restarts_same_data_root(
    tmp_path: Path, monkeypatch, capsys
):
    data_root = tmp_path / "state"
    data_root.mkdir()
    starts = []
    stops = []
    phase_one = {"operation_id": "op-one"}

    class FakeStack:
        def __init__(self, generation: int):
            self.generation = generation
            self.log_path = data_root / f"stack-{generation}.log"
            self.api_key = f"api-{generation}"

    def fake_start(options, root, gateway_key, environ, *, generation=1):
        assert root == data_root
        starts.append(generation)
        return FakeStack(generation)

    monkeypatch.setattr(
        agent_live_e2e.stack,
        "prepare_data_root",
        lambda options: (data_root, True),
    )
    monkeypatch.setattr(agent_live_e2e.stack, "start_stack", fake_start)
    monkeypatch.setattr(agent_live_e2e.stack, "wait_ready", lambda stack, timeout: None)
    monkeypatch.setattr(
        agent_live_e2e.scenarios,
        "exercise_recovery_phase_one",
        lambda stack, options, root: phase_one,
    )

    def fake_phase_two(stack, options, root, recovery):
        assert stack.generation == 2
        assert root == data_root
        assert recovery is phase_one
        return {"schema": scenarios.RECOVERY_SCHEMA, "ok": True}

    monkeypatch.setattr(
        agent_live_e2e.scenarios, "exercise_recovery_phase_two", fake_phase_two
    )
    monkeypatch.setattr(
        agent_live_e2e.stack,
        "stop_stack",
        lambda stack: stops.append(stack.generation),
    )
    monkeypatch.setattr(agent_live_e2e.shutil, "rmtree", lambda root: None)

    result = agent_live_e2e.run(
        _options(tmp_path, "--scenario", "restart-recovery"),
        {"RETAIN_AI_FX_OPENAI_BASE_URL": "http://127.0.0.1:8000/v1"},
    )

    assert result == 0
    assert starts == [1, 2]
    assert stops == [1, 2]
    assert json.loads(capsys.readouterr().out) == {
        "ok": True,
        "schema": scenarios.RECOVERY_SCHEMA,
    }
