from __future__ import annotations

import atexit
import sys
from pathlib import Path


class _TeeTextIO:
    def __init__(self, original, mirror) -> None:
        self._original = original
        self._mirror = mirror
        self.encoding = getattr(original, "encoding", "utf-8")

    def write(self, data):
        # 先写日志文件：运行时退出时 Rust 已经不读 stdout，写原流会碰上断开的管道（翻译排空期间，
        # 见 retainpdf_translation/workflow/shutdown_drain.py），这时日志文件里至少还有这一行
        if not self._mirror.closed:
            self._mirror.write(data)
        return self._original.write(data)

    def flush(self) -> None:
        if not self._mirror.closed:
            self._mirror.flush()
        self._original.flush()

    def isatty(self) -> bool:
        return bool(getattr(self._original, "isatty", lambda: False)())

    def fileno(self) -> int:
        return self._original.fileno()

    @property
    def buffer(self):
        return getattr(self._original, "buffer", None)


def _restore_streams_and_close_logs(
    *,
    original_stdout,
    original_stderr,
    stdout_log,
    stderr_log,
) -> None:
    sys.stdout = original_stdout
    sys.stderr = original_stderr
    try:
        stdout_log.flush()
    except Exception:
        pass
    try:
        stderr_log.flush()
    except Exception:
        pass
    try:
        stdout_log.close()
    except Exception:
        pass
    try:
        stderr_log.close()
    except Exception:
        pass


def enable_job_log_capture(logs_dir: Path, *, prefix: str = "python-worker") -> None:
    logs_dir.mkdir(parents=True, exist_ok=True)
    stdout_log = open(logs_dir / f"{prefix}.stdout.log", "a", encoding="utf-8", buffering=1)
    stderr_log = open(logs_dir / f"{prefix}.stderr.log", "a", encoding="utf-8", buffering=1)
    original_stdout = sys.stdout
    original_stderr = sys.stderr
    sys.stdout = _TeeTextIO(original_stdout, stdout_log)
    sys.stderr = _TeeTextIO(original_stderr, stderr_log)
    atexit.register(
        _restore_streams_and_close_logs,
        original_stdout=original_stdout,
        original_stderr=original_stderr,
        stdout_log=stdout_log,
        stderr_log=stderr_log,
    )
