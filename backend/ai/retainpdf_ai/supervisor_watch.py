"""被 rust_api 监督时,随监督者一起退出。

rust_api 把本服务放进独立进程组,好让组杀能收走整棵树;代价是 rust_api 自己被
SIGKILL(桌面端退出、OOM、``kill -9``)时信号到不了这里,本进程成了孤儿、继续
占着端口,下次启动就是端口冲突。macOS 没有 ``PR_SET_PDEATHSIG``,所以轮询:
监督者在 ``RETAIN_SUPERVISOR_PID`` 里写下自己的 pid,这里定期确认它还在。

约定与 Rust 侧 ``retain-proc/src/supervisor_watch.rs`` 一致,两边改动需同步。
"""

from __future__ import annotations

import logging
import os
import signal
import threading
import time
from collections.abc import Mapping

LOGGER = logging.getLogger(__name__)

SUPERVISOR_PID_ENV = "RETAIN_SUPERVISOR_PID"


def supervisor_pid_from_env(environ: Mapping[str, str] = os.environ) -> int | None:
    """未设置或不合法时返回 None(即独立运行,不看门)。"""
    raw = environ.get(SUPERVISOR_PID_ENV, "").strip()
    if not raw.isdigit():
        return None
    pid = int(raw)
    # 0 是"整个进程组",1 是 init/launchd,都不可能是真正的监督者。
    return pid if pid > 1 else None


def supervisor_gone(initial_ppid: int, current_ppid: int, supervisor_alive: bool) -> bool:
    """监督者 pid 已不存在,或父进程变了(被收养,防 pid 复用后误判存活)。"""
    return not supervisor_alive or current_ppid != initial_ppid


def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def start_supervisor_watch(
    *,
    interval_s: float = 1.0,
    force_exit_after_s: float = 10.0,
    environ: Mapping[str, str] = os.environ,
) -> threading.Thread | None:
    """未被监督或在 Windows 上返回 None;否则起一条守护线程。

    发现监督者没了先给自己发 SIGTERM,让 uvicorn 走正常收尾;收尾卡住则
    ``force_exit_after_s`` 秒后硬退出。
    """
    if os.name == "nt":
        # Windows 上桌面端用 taskkill /T /F 收整棵树,不依赖这里。
        return None
    supervisor_pid = supervisor_pid_from_env(environ)
    if supervisor_pid is None:
        return None
    initial_ppid = os.getppid()

    def watch() -> None:
        while not supervisor_gone(initial_ppid, os.getppid(), _pid_alive(supervisor_pid)):
            time.sleep(interval_s)
        LOGGER.warning("supervisor process %s exited; shutting down", supervisor_pid)
        os.kill(os.getpid(), signal.SIGTERM)
        time.sleep(force_exit_after_s)
        os._exit(1)

    thread = threading.Thread(target=watch, name="supervisor-watch", daemon=True)
    thread.start()
    return thread
