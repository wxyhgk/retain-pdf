"""随监督者退出的守卫:rust_api 被强杀后,AI 服务不能成孤儿占着端口。"""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import textwrap
import time
from pathlib import Path

import pytest

from retainpdf_ai import __main__ as ai_main
from retainpdf_ai.config import Settings
from retainpdf_ai.supervisor_watch import (
    SUPERVISOR_PID_ENV,
    start_supervisor_watch,
    supervisor_gone,
    supervisor_pid_from_env,
)

_AI_ROOT = Path(__file__).resolve().parents[1]
posix_only = pytest.mark.skipif(os.name == "nt", reason="Windows 由 taskkill /T 收树")


def test_supervisor_pid_parsing_rejects_missing_and_invalid_values() -> None:
    assert supervisor_pid_from_env({}) is None
    assert supervisor_pid_from_env({SUPERVISOR_PID_ENV: ""}) is None
    assert supervisor_pid_from_env({SUPERVISOR_PID_ENV: "abc"}) is None
    assert supervisor_pid_from_env({SUPERVISOR_PID_ENV: "-5"}) is None
    assert supervisor_pid_from_env({SUPERVISOR_PID_ENV: "0"}) is None
    assert supervisor_pid_from_env({SUPERVISOR_PID_ENV: "1"}) is None
    assert supervisor_pid_from_env({SUPERVISOR_PID_ENV: " 4242 "}) == 4242


def test_supervisor_gone_when_dead_or_reparented() -> None:
    assert not supervisor_gone(100, 100, True)
    assert supervisor_gone(100, 100, False)
    # pid 被复用、看起来"还活着",但父进程已经换成 init。
    assert supervisor_gone(100, 1, True)


def test_watch_is_not_started_when_unsupervised() -> None:
    # 独立运行(手动 python -m retainpdf_ai)时不能有任何看门行为。
    assert start_supervisor_watch(environ={}) is None


def test_entrypoint_starts_the_watch(monkeypatch: pytest.MonkeyPatch) -> None:
    # 光有模块不算数:入口必须真的启动它。
    calls: list[str] = []
    monkeypatch.setattr(ai_main, "start_supervisor_watch", lambda: calls.append("watch"))
    monkeypatch.setattr(
        ai_main, "uvicorn", type("U", (), {"run": staticmethod(lambda app, **kw: None)})
    )
    monkeypatch.setattr(ai_main, "build_app", lambda settings: object())
    monkeypatch.setattr(ai_main, "load_settings", lambda: Settings())
    ai_main.main()
    assert calls == ["watch"]


def _alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    return True


def _wait_until_dead(pid: int, timeout_s: float) -> bool:
    deadline = time.monotonic() + timeout_s
    while _alive(pid):
        if time.monotonic() >= deadline:
            return False
        time.sleep(0.05)
    return True


@posix_only
def test_child_exits_after_supervisor_is_sigkilled(tmp_path: Path) -> None:
    # 真实进程链:supervisor(中间进程)→ 看门的子进程。supervisor 被 SIGKILL
    # 后,子进程必须自己发现并退出——这正是桌面端退出时遗留孤儿的场景。
    child_code = textwrap.dedent(
        """
        import time
        from retainpdf_ai.supervisor_watch import start_supervisor_watch
        start_supervisor_watch(interval_s=0.05, force_exit_after_s=2.0)
        time.sleep(60)
        """
    )
    supervisor_code = textwrap.dedent(
        f"""
        import os, subprocess, sys, time
        env = dict(os.environ, {SUPERVISOR_PID_ENV}=str(os.getpid()))
        child = subprocess.Popen([sys.executable, "-c", {child_code!r}], env=env)
        print(child.pid, flush=True)
        time.sleep(60)
        """
    )
    env = dict(os.environ, PYTHONPATH=os.pathsep.join([str(_AI_ROOT), *sys.path]))
    env.pop(SUPERVISOR_PID_ENV, None)
    supervisor = subprocess.Popen(
        [sys.executable, "-c", supervisor_code],
        env=env,
        stdout=subprocess.PIPE,
        text=True,
        cwd=tmp_path,
    )
    child_pid = 0
    try:
        assert supervisor.stdout is not None
        child_pid = int(supervisor.stdout.readline())
        # 监督者还活着时子进程必须一直在。
        time.sleep(0.5)
        assert _alive(child_pid)

        supervisor.send_signal(signal.SIGKILL)
        supervisor.wait(timeout=5)

        assert _wait_until_dead(child_pid, timeout_s=5), "子进程成了孤儿"
    finally:
        if supervisor.poll() is None:
            supervisor.kill()
        if child_pid and _alive(child_pid):
            os.kill(child_pid, signal.SIGKILL)
