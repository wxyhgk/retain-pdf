"""翻译期间收到 SIGTERM：先把在途的模型请求等回来，再退出（状态管理设计 S20、路线图第 0 步 Z1）。

谁会发 SIGTERM：运行时退出时停 worker（进程内模式的 rust_api、retain-jobsd，``shutdown_workers.rs``）、用户取消、
任务超时。Rust 先 SIGTERM，宽限 ``RUST_API_WORKER_TERMINATE_GRACE_SECS``（默认 3 秒）后 SIGKILL。

以前翻译期间用默认的 SIGTERM 处理，进程当场死掉：已经发出去的请求（并发 8 到 32 路）在请求日志里只有 dispatch、
没有终态，下次启动全算「结果不明」，任务不自动续跑、要用户确认重复计费。现在收到 SIGTERM：

1. 不再派发新请求：想发请求的线程停在请求日志的闸门上（``request_journal._DispatchGate``），不写 dispatch、不发；
2. 最多等 ``RETAIN_TRANSLATION_SHUTDOWN_DRAIN_SECONDS``（默认 2 秒，比 Rust 的 3 秒宽限短，留出余量）让在途请求
   回来，回来的照常写上终态（成功、被拒……），译文照常进断点；
3. 宽限到了还没回来的保持「结果不明」：下次启动不自动续跑，等用户手动确认（用户 2026-11-26 定）；
4. 然后退出（退出码 143，和被 SIGTERM 杀掉一样）。

不抛异常打断正在跑的线程：打断会让调用方把块记成失败写进断点，在途的请求也就成了结果不明。

运行时退出时 Rust 先停自己的运行时（不再读 worker 的 stdout），最多 1 秒以后才发 SIGTERM：这段和排空期间打日志
都会碰上断开的管道（``BrokenPipeError``），在途请求回来以后打的「http ok」就会让这次请求记成失败。所以翻译期间
``sys.stdout`` / ``sys.stderr`` 换成写不出去就丢掉的包装（日志文件那份照写，见 ``tee_output.py``）；断点经 stdout
发给 Rust 的提交事件丢了也没关系，断点先落盘，下次续跑会重发（outbox）。

Windows：没有 SIGTERM，Rust 用 ``taskkill /T /F``（TerminateProcess）停 worker，这里的处理函数不会被调到，
和以前一样当场结束，在途请求算结果不明。
"""
from __future__ import annotations

import contextlib
import os
import signal
import sys
import threading
from typing import Callable, Iterator

from retainpdf_translation.artifacts import begin_request_drain
from retainpdf_translation.artifacts import inflight_request_count
from retainpdf_translation.artifacts import wait_for_inflight_requests


SHUTDOWN_DRAIN_SECONDS_ENV = "RETAIN_TRANSLATION_SHUTDOWN_DRAIN_SECONDS"
DEFAULT_SHUTDOWN_DRAIN_SECONDS = 2.0
# 上限：Rust 默认 3 秒后 SIGKILL，桌面壳给后端一共 10 秒；配得再大也没用，只会被 SIGKILL 截断。
MAX_SHUTDOWN_DRAIN_SECONDS = 30.0
SHUTDOWN_EXIT_CODE = 128 + 15


def shutdown_drain_seconds() -> float:
    raw = os.environ.get(SHUTDOWN_DRAIN_SECONDS_ENV, "").strip()
    if not raw:
        return DEFAULT_SHUTDOWN_DRAIN_SECONDS
    try:
        value = float(raw)
    except ValueError:
        return DEFAULT_SHUTDOWN_DRAIN_SECONDS
    if value != value:  # NaN
        return DEFAULT_SHUTDOWN_DRAIN_SECONDS
    return min(MAX_SHUTDOWN_DRAIN_SECONDS, max(0.0, value))


class _PipeTolerantStream:
    """写不出去（管道断了、读的一方已经退出）就丢掉，不让打日志的线程因此出错。"""

    def __init__(self, stream) -> None:
        self._stream = stream

    def write(self, data):
        try:
            return self._stream.write(data)
        except (OSError, ValueError):
            return len(data) if isinstance(data, (str, bytes)) else 0

    def flush(self) -> None:
        try:
            self._stream.flush()
        except (OSError, ValueError):
            pass

    def __getattr__(self, name):
        return getattr(self._stream, name)


def _tolerate_closed_output() -> list[tuple[str, object, _PipeTolerantStream]]:
    """换上包装，返回换了哪些（名字、原来的、包装），退出作用域时换回去。"""
    installed = []
    for name in ("stdout", "stderr"):
        stream = getattr(sys, name, None)
        if stream is not None and not isinstance(stream, _PipeTolerantStream):
            wrapper = _PipeTolerantStream(stream)
            setattr(sys, name, wrapper)
            installed.append((name, stream, wrapper))
    return installed


def _restore_output(installed: list[tuple[str, object, _PipeTolerantStream]]) -> None:
    for name, original, wrapper in installed:
        # 期间别人又换过（例如开了日志镜像）就不动它
        if getattr(sys, name, None) is wrapper:
            setattr(sys, name, original)


def _log(message: str) -> None:
    try:
        print(message, file=sys.stderr, flush=True)
    except Exception:  # noqa: BLE001 - 退出路径上打不出日志也要接着退
        pass


def start_drain(*, grace_seconds: float, exit_fn: Callable[[int], object] = os._exit) -> threading.Thread:
    """开始排空：闸门关上，另起一个线程等在途请求（最多 ``grace_seconds``），然后 ``exit_fn(143)``。"""
    _tolerate_closed_output()
    inflight = begin_request_drain()
    _log(
        f"translation: SIGTERM received; no new model requests, waiting up to {grace_seconds:.1f}s "
        f"for {inflight} in-flight request(s)"
    )

    def finish() -> None:
        drained = wait_for_inflight_requests(grace_seconds)
        remaining = inflight_request_count()
        if drained:
            _log("translation: in-flight requests settled; exiting")
        else:
            _log(
                f"translation: {remaining} request(s) still in flight after {grace_seconds:.1f}s; "
                "they stay unresolved in the request journal (next start waits for user confirmation)"
            )
        for stream in (sys.stdout, sys.stderr):
            try:
                stream.flush()
            except Exception:  # noqa: BLE001
                pass
        exit_fn(SHUTDOWN_EXIT_CODE)

    thread = threading.Thread(target=finish, name="translation-shutdown-drain", daemon=True)
    thread.start()
    return thread


@contextlib.contextmanager
def sigterm_drains_inflight_requests(
    *, exit_fn: Callable[[int], object] = os._exit
) -> Iterator[None]:
    """翻译期间把 SIGTERM 换成「排空在途请求再退出」。只在主线程装得上；别的线程里调用就原样跑（默认处理）。"""
    sigterm = getattr(signal, "SIGTERM", None)
    if sigterm is None:
        yield
        return
    started = threading.Event()

    def handler(_signum: int, _frame: object) -> None:
        # 取消和退出可能各发一次 SIGTERM（开发栈还会直接给 worker 的进程组发）：只排空一次
        if started.is_set():
            return
        started.set()
        start_drain(grace_seconds=shutdown_drain_seconds(), exit_fn=exit_fn)

    try:
        previous = signal.signal(sigterm, handler)
    except (ValueError, OSError):
        yield
        return
    installed = _tolerate_closed_output()
    try:
        yield
    finally:
        try:
            signal.signal(sigterm, previous if previous is not None else signal.SIG_DFL)
        except (ValueError, OSError):
            pass
        if not started.is_set():
            _restore_output(installed)
