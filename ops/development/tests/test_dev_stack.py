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
    ):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("stub")
        path.chmod(0o755)
    paths.pipeline.mkdir(parents=True, exist_ok=True)
    return paths


def test_make_paths_never_escapes_tmp_path(tmp_path: Path) -> None:
    """夹具往 venv_python / pipeline_command 写 "stub"，所以它们**必须**在 tmp_path 里。

    真发生过：`RepoPaths.from_script` 一度在不传 environ 时读 `os.environ`，于是
    shell 里 export 过 UV_PROJECT_ENVIRONMENT 的人跑这个文件，stub 被写进真的 venv。
    而 `bin/python` 是指向 uv 托管解释器的符号链接 —— 写穿之后那个解释器本体也成了
    "stub"，所有项目一起坏，得 `uv python install --reinstall` 才能救回来。

    所以这一条不是在测 dev_stack，是在挡住**这个测试文件自己**往仓库外写。
    """
    import os as _os

    before = _os.environ.get("UV_PROJECT_ENVIRONMENT")
    _os.environ["UV_PROJECT_ENVIRONMENT"] = "/definitely/not/under/tmp/venv"
    try:
        paths = make_paths(tmp_path)
    finally:
        if before is None:
            _os.environ.pop("UV_PROJECT_ENVIRONMENT", None)
        else:
            _os.environ["UV_PROJECT_ENVIRONMENT"] = before

    written = (
        paths.venv_python,
        paths.pipeline_command,
        paths.rust_api,
        paths.jobsd,
    )
    escaped = [str(path) for path in written if tmp_path not in path.parents]
    assert escaped == [], (
        "夹具会往这些路径写 \"stub\"，而它们跑到 tmp_path 外面去了：" + ", ".join(escaped)
    )


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


def test_runtime_env_uses_absolute_commands_and_rust_supervision(tmp_path: Path) -> None:
    paths = make_paths(tmp_path)
    secret = "top-secret-development-key"
    opts = options(
        paths,
        "--port",
        "43000",
        "--jobs-port",
        "43002",
        "--data-root",
        str(tmp_path / "state"),
    )
    env = dev_stack.build_runtime_env(
        paths,
        opts,
        {"RUST_API_KEYS": secret, "PATH": "/usr/bin"},
    )

    assert env["RUST_API_KEYS"] == secret
    assert env["RUST_API_JOBS_MODE"] == "remote"
    assert env["RUST_API_JOBS_SUPERVISE"] == "1"
    assert env["RUST_API_JOBSD_COMMAND"] == str(paths.jobsd)
    # RetainPDF 自己的 AI 服务 2026-11-03 删了：开发栈不再起它
    assert not any(key.startswith(("RUST_API_AI_", "RETAIN_AI_")) for key in env)
    assert env["PYTHON_BIN"] == str(paths.venv_python)
    assert env["RUST_API_PIPELINE_COMMAND"] == str(paths.pipeline_command)
    assert "RUST_API_PYTHON_ENTRYPOINT_MODE" not in env
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


@pytest.mark.parametrize("host", ["0.0.0.0", "::", "192.168.1.2", "::ffff:192.168.1.2"])
@pytest.mark.parametrize("key", ["", "dev-local-key", "custom, dev-local-key", " , "])
def test_network_bind_rejects_default_or_empty_keys_before_preparation(
    tmp_path: Path, host: str, key: str,
) -> None:
    paths = make_paths(tmp_path)
    with (
        mock.patch.object(dev_stack, "prepare") as prepare,
        mock.patch.object(dev_stack, "launch") as launch,
        pytest.raises(dev_stack.StackError, match="non-default RUST_API_KEYS"),
    ):
        dev_stack.run(["--host", host], paths=paths, environ={"RUST_API_KEYS": key})
    prepare.assert_not_called()
    launch.assert_not_called()


def test_runtime_env_preserves_explicit_key_and_drops_retired_selector(tmp_path: Path) -> None:
    paths = make_paths(tmp_path)
    opts = options(paths, "--host", "0.0.0.0", "--simple-port", "43200")
    env = dev_stack.build_runtime_env(paths, opts, {
        "RUST_API_KEYS": "explicit-test-key", "RUST_API_PYTHON_ENTRYPOINT_MODE": "script",
    })
    assert env["RUST_API_KEYS"] == "explicit-test-key"
    assert env["RUST_API_SIMPLE_PORT"] == "43200"
    assert "RUST_API_PYTHON_ENTRYPOINT_MODE" not in env


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


# ── .env.local ────────────────────────────────────────────────────────────


def test_env_file_parsing_skips_comments_and_strips_quotes() -> None:
    text = """
# 注释
RETAIN_TEST_TRANSLATION_MODEL=glm-5.3-flash
export RETAIN_TEST_TRANSLATION_WORKERS = 20
QUOTED="https://open.bigmodel.cn/api/paas/v4"
SINGLE='a b'
not a line
BAD-NAME=x
EMPTY=
"""
    assert dev_stack.parse_env_file(text) == {
        "RETAIN_TEST_TRANSLATION_MODEL": "glm-5.3-flash",
        "RETAIN_TEST_TRANSLATION_WORKERS": "20",
        "QUOTED": "https://open.bigmodel.cn/api/paas/v4",
        "SINGLE": "a b",
        "EMPTY": "",
    }


def test_a_worktree_falls_back_to_the_main_checkout_env_file(tmp_path: Path) -> None:
    worktree = tmp_path / "worktree"
    main = tmp_path / "main"
    worktree.mkdir()
    main.mkdir()
    (main / ".env.local").write_text("RETAIN_TEST_TRANSLATION_MODEL=from-main\n")
    values, source = dev_stack.load_local_env(worktree, main)
    assert values == {"RETAIN_TEST_TRANSLATION_MODEL": "from-main"}
    assert source == main / ".env.local"
    # 当前检出自己有一份时用自己的。
    (worktree / ".env.local").write_text("RETAIN_TEST_TRANSLATION_MODEL=from-worktree\n")
    values, source = dev_stack.load_local_env(worktree, main)
    assert values == {"RETAIN_TEST_TRANSLATION_MODEL": "from-worktree"}
    assert source == worktree / ".env.local"


def test_no_env_file_anywhere_loads_nothing(tmp_path: Path) -> None:
    assert dev_stack.load_local_env(tmp_path, None) == ({}, None)


def test_env_file_values_reach_the_backend_but_never_override_explicit_or_managed_vars(tmp_path: Path) -> None:
    paths = make_paths(tmp_path)
    opts = options(paths)
    env = dev_stack.build_runtime_env(
        paths,
        opts,
        {"PATH": "/usr/bin", "RETAIN_TEST_TRANSLATION_WORKERS": "5"},
        local_env={
            "RETAIN_TEST_TRANSLATION_MODEL": "glm-5.3-flash",
            "RETAIN_TEST_TRANSLATION_WORKERS": "20",
            "RUST_API_DATA_ROOT": "/tmp/hijacked",
        },
    )
    assert env["RETAIN_TEST_TRANSLATION_MODEL"] == "glm-5.3-flash", ".env.local 的值没传给后端"
    assert env["RETAIN_TEST_TRANSLATION_WORKERS"] == "5", "shell 里显式设的值该优先"
    assert env["RUST_API_DATA_ROOT"] == str(opts.data_root), ".env.local 改动了开发栈自己管的变量"


def test_run_prints_only_variable_names_from_the_env_file(tmp_path: Path, capsys) -> None:
    # 值里有 API key，日志里只能出现变量名。
    paths = make_paths(tmp_path)
    (paths.product / ".env.local").write_text("RETAIN_TEST_TRANSLATION_API_KEY=super-secret-value\n")
    with mock.patch.object(dev_stack, "main_checkout_of", return_value=None), \
         mock.patch.object(dev_stack, "prepare"), \
         mock.patch.object(dev_stack, "validate_artifacts"), \
         mock.patch.object(dev_stack, "launch", return_value=0) as launch:
        assert dev_stack.run(["--no-sync", "--no-build"], paths=paths, environ={"PATH": "/usr/bin"}) == 0
    out = capsys.readouterr().out
    assert "RETAIN_TEST_TRANSLATION_API_KEY" in out
    assert "super-secret-value" not in out
    assert launch.call_args.args[2]["RETAIN_TEST_TRANSLATION_API_KEY"] == "super-secret-value"
