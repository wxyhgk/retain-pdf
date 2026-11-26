"""JSON 落盘和原子写。

仓库里「先写临时文件、再 ``os.replace`` 换上」的 Python 实现只有这一份（2026-11-26，状态管理 Z5）：
`atomic_write`（任意写法）、`atomic_write_text`、`atomic_write_bytes`、`save_json_atomic`，以及只换名的
`replace_file`。别处要原子写就调这里，不要再自己写一份。

- 临时文件和目标在同一个目录（同一个文件系统，``os.replace`` 才是原子的），名字 ``.<目标名>.<随机>.tmp``，
  并发写同一个目标互不踩；失败时删掉临时文件。
- 默认 ``durable=True``：换名前 fsync 文件，换名后 fsync 目录（目录打不开的平台跳过）。
- Windows 上杀毒软件、索引器会短暂占着目标文件，``os.replace`` 抛 ``PermissionError``（winerror 5、32、33）。
  只在 Windows 上按指数退避重试，10 次、合计约 2 秒；别的平台不重试，第一次失败就抛。
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import tempfile
import time
from typing import IO, Any, Callable

# 只在 Windows 上重试；测试里改成 True 模拟。
_IS_WINDOWS = os.name == "nt"
# ERROR_ACCESS_DENIED、ERROR_SHARING_VIOLATION、ERROR_LOCK_VIOLATION：别的进程短暂占着文件。
_WINDOWS_TRANSIENT_WINERRORS = frozenset({5, 32, 33})
REPLACE_RETRY_ATTEMPTS = 10
# 第 n 次重试前等 base * 2**n：0.002 + 0.004 + … + 1.024 ≈ 2.05 秒。
REPLACE_RETRY_BASE_SECONDS = 0.002
_sleep: Callable[[float], None] = time.sleep


def _json_dump_kwargs(*, compact: bool, indent: int | None) -> dict[str, Any]:
    if compact:
        return {"ensure_ascii": False, "separators": (",", ":")}
    return {"ensure_ascii": False, "indent": indent}


def _is_transient_windows_lock(error: OSError) -> bool:
    if not _IS_WINDOWS:
        return False
    return isinstance(error, PermissionError) or getattr(error, "winerror", None) in _WINDOWS_TRANSIENT_WINERRORS


def replace_file(source: Path | str, target: Path | str) -> None:
    """``os.replace(source, target)``；Windows 上目标被短暂占用时退避重试（见模块说明）。"""
    for attempt in range(REPLACE_RETRY_ATTEMPTS + 1):
        try:
            os.replace(source, target)
            return
        except OSError as error:
            if attempt >= REPLACE_RETRY_ATTEMPTS or not _is_transient_windows_lock(error):
                raise
            _sleep(REPLACE_RETRY_BASE_SECONDS * (2**attempt))


def fsync_parent_dir(path: Path | str) -> None:
    """换名之后 fsync 目录，断电后新名字也在。目录打不开（Windows）就跳过。"""
    try:
        dir_fd = os.open(Path(path).parent, os.O_RDONLY)
    except OSError:
        return
    try:
        os.fsync(dir_fd)
    except OSError:
        pass
    finally:
        os.close(dir_fd)


def atomic_write(
    path: Path | str,
    write: Callable[[IO[Any]], object],
    *,
    binary: bool = False,
    durable: bool = True,
) -> None:
    """``write(handle)`` 写进同目录的临时文件，写完再换上 ``path``。读的一方任何时候看到的都是完整的旧版或新版。"""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary: Path | None = Path(tmp_name)
    try:
        handle: IO[Any] = os.fdopen(fd, "wb") if binary else os.fdopen(fd, "w", encoding="utf-8")
        with handle:
            write(handle)
            handle.flush()
            if durable:
                os.fsync(handle.fileno())
        replace_file(temporary, path)
        temporary = None
        if durable:
            fsync_parent_dir(path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def atomic_write_text(path: Path | str, text: str, *, durable: bool = True) -> None:
    atomic_write(path, lambda handle: handle.write(text), durable=durable)


def atomic_write_bytes(path: Path | str, data: bytes, *, durable: bool = True) -> None:
    atomic_write(path, lambda handle: handle.write(data), binary=True, durable=durable)


def save_json(path: Path, payload: Any, *, compact: bool = False) -> None:
    """Write JSON without building a giant intermediate string.

    ``path.write_text(json.dumps(...))`` doubles peak memory (object graph +
    full serialized text). For ~100MB+ document.v1 payloads that triggers
    MemoryError on Windows desktop Python. Stream with ``json.dump`` instead.

    compact=True skips pretty-printing; use it for large machine-consumed
    documents (document.v1.json, provider payloads) where indent=2 inflates
    the file by 30-50% and slows every downstream parse.

    不是原子写：写到一半崩溃会留下截断的文件。别人会读、或者续跑要信它的产物（规范化文档、断点、页文件……）
    用 `save_json_atomic`。
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, **_json_dump_kwargs(compact=compact, indent=2))


def save_json_atomic(
    path: Path | str,
    payload: Any,
    *,
    compact: bool = False,
    indent: int | None = 2,
    durable: bool = True,
) -> None:
    """Atomically replace a JSON artifact after fully writing it beside the target.

    Normalized document files are consumed concurrently by the API and AI
    service. Writing them in place exposes readers to truncated JSON when a
    worker is interrupted. A same-directory temporary file keeps ``os.replace``
    on the same filesystem and therefore atomic. 和 `save_json` 一样流式写，不先拼整串。
    """
    dump_kwargs = _json_dump_kwargs(compact=compact, indent=indent)
    atomic_write(path, lambda handle: json.dump(payload, handle, **dump_kwargs), durable=durable)


def load_json(path: Path) -> Any:
    """Read JSON without ``read_text`` + ``json.loads`` (same memory concern)."""
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)
