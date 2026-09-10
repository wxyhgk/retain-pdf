from __future__ import annotations

import importlib.util
import os
import signal
import subprocess
import sys
from pathlib import Path
from unittest import mock

import pytest

MODULE_PATH = Path(__file__).resolve().parents[1] / "dev_stack.py"
SPEC = importlib.util.spec_from_file_location("retainpdf_dev_stack", MODULE_PATH)
assert SPEC and SPEC.loader
dev_stack = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = dev_stack
SPEC.loader.exec_module(dev_stack)


def make_paths(tmp_path: Path) -> object:
    script = tmp_path / "product" / "ops" / "development" / "dev_stack.py"
    script.parent.mkdir(parents=True)
    paths = dev_stack.RepoPaths.from_script(script)
    for path in (
        paths.venv_python,
        paths.pipeline_command,
        paths.rust_api,
        paths.jobsd,
        paths.agent,
    ):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("stub")
        path.chmod(0o755)
    paths.ai.mkdir(parents=True, exist_ok=True)
    paths.pipeline.mkdir(parents=True, exist_ok=True)
    return paths


def options(paths: object, *args: str, environ: dict[str, str] | None = None) -> object:
    return dev_stack.parse_args(args, paths=paths, environ=environ or {})


def test_prepare_runs_uv_before_cargo_with_fixed_roots(tmp_path: Path) -> None:
    paths = make_paths(tmp_path)
    opts = options(paths)
    with mock.patch.object(dev_stack.subprocess, "run") as run:
        dev_stack.prepare(paths, opts, {"PATH": "/bin"})

    assert run.call_count == 2
    uv_call, cargo_call = run.call_args_list
    assert uv_call.args[0] == [
        "uv",
        "sync",
        "--project",
        str(paths.services),
        "--locked",
        "--all-extras",
    ]
    assert cargo_call.args[0] == [
        "cargo",
        "build",
        "--locked",
        "--workspace",
        "--bins",
        "--manifest-path",
        str(paths.product / "Cargo.toml"),
    ]
    assert uv_call.kwargs["env"]["UV_PROJECT_ENVIRONMENT"] == str(
        paths.services / ".venv"
    )
    assert cargo_call.kwargs["env"]["CARGO_TARGET_DIR"] == str(paths.product / "target")


def test_no_sync_no_build_skips_preparation_commands(tmp_path: Path) -> None:
    paths = make_paths(tmp_path)
    opts = options(paths, "--no-sync", "--no-build")
    with mock.patch.object(dev_stack.subprocess, "run") as run:
        dev_stack.prepare(paths, opts, {})
    run.assert_not_called()


def test_openai_runtime_is_a_supported_launcher_mode(tmp_path: Path) -> None:
    paths = make_paths(tmp_path)
    opts = options(paths, "--runtime", "openai", "--no-sync", "--no-build")
    env = dev_stack.build_runtime_env(paths, opts, {"PATH": "/usr/bin"})

    assert opts.runtime == "openai"
    assert env["RETAIN_AI_RUNTIME"] == "openai"
    assert env["RETAIN_AI_AGENT_CLI_COMMAND"] == str(paths.agent)
    assert env["RETAIN_AI_FX_AGENT_CLI_COMMAND"] == str(paths.agent)


def test_runtime_env_uses_absolute_commands_and_rust_supervision(tmp_path: Path) -> None:
    paths = make_paths(tmp_path)
    secret = "top-secret-development-key"
    opts = options(
        paths,
        "--runtime",
        "fx",
        "--port",
        "43000",
        "--jobs-port",
        "43002",
        "--ai-port",
        "43100",
        "--data-root",
        str(tmp_path / "state"),
    )
    env = dev_stack.build_runtime_env(
        paths,
        opts,
        {"RUST_API_KEYS": secret, "PATH": "/usr/bin"},
        fx_command="/fixed/fx",
    )

    assert env["RUST_API_KEYS"] == secret
    assert env["RUST_API_JOBS_MODE"] == "remote"
    assert env["RUST_API_JOBS_SUPERVISE"] == "1"
    assert env["RUST_API_JOBSD_COMMAND"] == str(paths.jobsd)
    assert env["RUST_API_AI_SUPERVISE"] == "1"
    assert env["RUST_API_AI_COMMAND"] == str(paths.venv_python)
    assert env["RUST_API_AI_CWD"] == str(paths.ai)
    assert env["RUST_API_AI_SERVICE_BASE"] == "http://127.0.0.1:43100"
    assert env["PYTHON_BIN"] == str(paths.venv_python)
    assert env["RUST_API_PIPELINE_COMMAND"] == str(paths.pipeline_command)
    assert env["RUST_API_PYTHON_ENTRYPOINT_MODE"] == "console"
    assert env["RETAIN_AI_AGENT_CLI_COMMAND"] == str(paths.agent)
    assert env["RETAIN_AI_FX_AGENT_CLI_COMMAND"] == str(paths.agent)
    assert env["RETAIN_AI_FX_COMMAND"] == "/fixed/fx"
    assert env["RETAIN_AI_RUNTIME"] == "fx"
    assert env["RUST_API_PROJECT_ROOT"] == str(paths.product)
    assert env["RUST_API_SCRIPTS_DIR"] == str(paths.pipeline)
    assert env["RUST_API_DATA_ROOT"] == str((tmp_path / "state").resolve())


def test_output_does_not_leak_api_key(tmp_path: Path, capsys: object) -> None:
    paths = make_paths(tmp_path)
    secret = "never-print-this-key"
    opts = options(paths, "--no-sync", "--no-build")
    process = mock.Mock(pid=1234)
    process.poll.side_effect = [None, 0]
    with (
        mock.patch.object(dev_stack.subprocess, "Popen", return_value=process),
        mock.patch.object(dev_stack, "wait_until_ready"),
        mock.patch.object(dev_stack, "terminate_process_group"),
        mock.patch.object(dev_stack.signal, "getsignal", return_value=signal.SIG_DFL),
        mock.patch.object(dev_stack.signal, "signal"),
    ):
        env = dev_stack.build_runtime_env(
            paths, opts, {"RUST_API_KEYS": secret, "PATH": "/bin"}
        )
        assert dev_stack.launch(paths, opts, env) == 0
    captured = capsys.readouterr()
    assert secret not in captured.out
    assert secret not in captured.err


def test_readiness_timeout_reclaims_process_group(tmp_path: Path) -> None:
    paths = make_paths(tmp_path)
    opts = options(paths, "--no-sync", "--no-build")
    process = mock.Mock(pid=4321)
    process.poll.return_value = None
    with (
        mock.patch.object(dev_stack.subprocess, "Popen", return_value=process),
        mock.patch.object(
            dev_stack,
            "wait_until_ready",
            side_effect=dev_stack.StackError("backend readiness timed out after 1s"),
        ),
        mock.patch.object(dev_stack, "terminate_process_group") as terminate,
        mock.patch.object(dev_stack.signal, "getsignal", return_value=signal.SIG_DFL),
        mock.patch.object(dev_stack.signal, "signal"),
        pytest.raises(dev_stack.StackError, match="readiness timed out"),
    ):
        dev_stack.launch(paths, opts, {})
    terminate.assert_called_once_with(process, timeout=opts.shutdown_timeout)


def test_cleanup_signals_rust_and_descendant_process_groups() -> None:
    process = mock.Mock(pid=100)
    process.poll.side_effect = [None, 0, 0]
    process.wait.return_value = 0
    with (
        mock.patch.object(
            dev_stack,
            "_descendant_processes",
            return_value=({101, 102}, {101, 202}),
        ),
        mock.patch.object(dev_stack, "_pid_exists", return_value=False),
        mock.patch.object(dev_stack.os, "getpgid", return_value=100),
        mock.patch.object(dev_stack.os, "getpgrp", return_value=999),
        mock.patch.object(dev_stack.os, "killpg") as killpg,
    ):
        dev_stack.terminate_process_group(process, timeout=1)

    assert [call.args for call in killpg.call_args_list] == [
        (100, signal.SIGTERM),
        (101, signal.SIGTERM),
        (202, signal.SIGTERM),
    ]


def test_descendant_snapshot_walks_multiple_generations() -> None:
    table = """\
      100 1 100
      101 100 101
      102 101 102
      200 1 200
    """
    completed = subprocess.CompletedProcess(["ps"], 0, table, "")
    with mock.patch.object(dev_stack.subprocess, "run", return_value=completed):
        pids, groups = dev_stack._descendant_processes(100)
    assert pids == {101, 102}
    assert groups == {101, 102}


def test_wait_until_ready_fails_when_child_exits() -> None:
    process = mock.Mock()
    process.poll.return_value = 17
    with pytest.raises(dev_stack.StackError, match="status 17"):
        dev_stack.wait_until_ready(
            process,
            "http://127.0.0.1:9/ready",
            timeout=1,
            interval=0.01,
        )


def test_fx_preflight_requires_exact_version_and_provider_configuration() -> None:
    completed = subprocess.CompletedProcess(["/bin/fx", "--version"], 0, "0.0.5\n", "")
    with (
        mock.patch.object(dev_stack.shutil, "which", return_value="/bin/fx"),
        mock.patch.object(dev_stack.subprocess, "run", return_value=completed),
    ):
        assert dev_stack.preflight_fx(
            {"RETAIN_AI_FX_GATEWAY_API_KEY": "secret"}
        ) == str(Path("/bin/fx").resolve())
        assert dev_stack.preflight_fx(
            {"RETAIN_AI_FX_OPENAI_BASE_URL": "http://127.0.0.1:8000/v1"}
        ) == str(Path("/bin/fx").resolve())

    with (
        mock.patch.object(dev_stack.shutil, "which", return_value=None),
        pytest.raises(dev_stack.StackError) as error,
    ):
        dev_stack.preflight_fx({})
    assert "fx executable is missing" in str(error.value)
    assert "RETAIN_AI_FX_GATEWAY_API_KEY or RETAIN_AI_FX_OPENAI_BASE_URL" in str(
        error.value
    )


def test_fx_preflight_error_never_includes_key() -> None:
    secret = "gateway-secret-never-log"
    completed = subprocess.CompletedProcess(["/bin/fx", "--version"], 0, "9.9.9\n", "")
    with (
        mock.patch.object(dev_stack.shutil, "which", return_value="/bin/fx"),
        mock.patch.object(dev_stack.subprocess, "run", return_value=completed),
        pytest.raises(dev_stack.StackError) as error,
    ):
        dev_stack.preflight_fx({"RETAIN_AI_FX_GATEWAY_API_KEY": secret})
    assert secret not in str(error.value)


def test_fx_preflight_accepts_only_the_endpoint_policy_supported_by_fx_005() -> None:
    completed = subprocess.CompletedProcess(["/bin/fx", "--version"], 0, "0.0.5\n", "")
    base = {
        "RETAIN_AI_FX_GATEWAY_API_KEY": "secret",
        "RETAIN_AI_FX_GATEWAY_BASE_URL": "http://localhost:43231/gateway",
    }
    with (
        mock.patch.object(dev_stack.shutil, "which", return_value="/bin/fx"),
        mock.patch.object(dev_stack.subprocess, "run", return_value=completed),
    ):
        assert dev_stack.preflight_fx(base) == str(Path("/bin/fx").resolve())
        with pytest.raises(dev_stack.StackError, match="explicit loopback HTTP"):
            dev_stack.preflight_fx(
                {
                    **base,
                    "RETAIN_AI_FX_GATEWAY_BASE_URL": "https://gateway.example",
                }
            )


def test_prepare_only_does_not_launch(tmp_path: Path) -> None:
    paths = make_paths(tmp_path)
    with (
        mock.patch.object(dev_stack, "prepare") as prepare,
        mock.patch.object(dev_stack, "launch") as launch,
    ):
        result = dev_stack.run(
            ["--prepare-only"],
            paths=paths,
            environ={"PATH": os.environ.get("PATH", "")},
        )
    assert result == 0
    prepare.assert_called_once()
    launch.assert_not_called()


def test_signal_handlers_are_installed_and_restored(tmp_path: Path) -> None:
    paths = make_paths(tmp_path)
    opts = options(paths, "--no-sync", "--no-build")
    process = mock.Mock(pid=111)
    process.poll.return_value = 0
    with (
        mock.patch.object(dev_stack.subprocess, "Popen", return_value=process),
        mock.patch.object(dev_stack, "wait_until_ready"),
        mock.patch.object(dev_stack, "terminate_process_group"),
        mock.patch.object(dev_stack.signal, "getsignal", return_value=signal.SIG_DFL),
        mock.patch.object(dev_stack.signal, "signal") as install,
    ):
        assert dev_stack.launch(paths, opts, {}) == 0
    installed_signals = [call.args[0] for call in install.call_args_list]
    assert installed_signals.count(signal.SIGINT) == 2
    assert installed_signals.count(signal.SIGTERM) == 2
