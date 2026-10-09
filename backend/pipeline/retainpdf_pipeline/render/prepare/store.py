"""渲染准备步骤的缓存：``<job>/artifacts/render_prepare/<step>/``。

每个步骤一个目录、一份 ``manifest.json``：

    {"schema": "render_prepare_step_v1", "step": ..., "version": ..., "key": <指纹>,
     "inputs": <参与指纹的输入>, "outputs": {名字: 相对路径}, "elapsed_seconds": ..., "created_at": ...}

指纹只包含真正影响产物的输入（文件身份 + 参数 + 算法版本）。读的时候指纹不同就当没有，
由调用方重做；写的时候先写产物、最后原子写 manifest，进程中途被杀不会留下「manifest 在、
产物不全」的状态。
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
import time
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from datetime import timezone
from pathlib import Path
from typing import Any

PREPARE_DIR_NAME = "render_prepare"
STEP_MANIFEST_SCHEMA = "render_prepare_step_v1"
MANIFEST_NAME = "manifest.json"


def file_identity(path: Path | str | None) -> dict[str, Any] | None:
    """文件身份：路径、大小、修改时间（与现有 prewarm 指纹同一口径）。文件不存在返回 None。"""
    if path is None:
        return None
    resolved = Path(path).resolve()
    try:
        stat = resolved.stat()
    except OSError:
        return None
    return {"path": str(resolved), "size": int(stat.st_size), "mtime_ns": int(stat.st_mtime_ns)}


def content_identity(path: Path | str) -> dict[str, Any]:
    """文件内容的身份（不含路径）：同一份文件的硬链接相同，文件被替换（新 inode）就不同。

    用在「输入是别的步骤产物的硬链接」时：链接放在哪个目录都不该让缓存失效。
    """
    stat = Path(path).stat()
    return {"dev": int(stat.st_dev), "ino": int(stat.st_ino), "size": int(stat.st_size), "mtime_ns": int(stat.st_mtime_ns)}


def link_or_copy(source: Path, target: Path) -> None:
    """把缓存产物放到调用方要的位置：硬链接（缓存文件之后被替换也不影响它），不行就复制。"""
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.unlink(missing_ok=True)
    try:
        os.link(source, target)
    except OSError:
        shutil.copyfile(source, target)


def fingerprint(inputs: dict[str, Any]) -> str:
    canonical = json.dumps(inputs, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
        os.replace(tmp_name, path)
    except BaseException:
        Path(tmp_name).unlink(missing_ok=True)
        raise


@contextmanager
def _exclusive_lock(path: Path):
    """跨进程互斥（渲染准备进程与渲染进程可能同时做同一步）：同一时刻只有一方在做，另一方等它
    做完再读缓存。锁随文件句柄关闭释放，进程被杀也不会留下死锁。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a+b") as handle:
        if os.name == "nt":  # pragma: no cover - Windows
            import msvcrt

            handle.seek(0)
            while True:
                try:
                    msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
                    break
                except OSError:
                    continue
            try:
                yield
            finally:
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl

            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


@dataclass(frozen=True)
class StepRecord:
    step: str
    key: str
    directory: Path
    outputs: dict[str, Path]
    elapsed_seconds: float
    hit: bool

    def output(self, name: str) -> Path:
        return self.outputs[name]


class PrepareStore:
    """一个任务的渲染准备缓存。root 通常是 ``<job>/artifacts/render_prepare``。"""

    def __init__(self, root: Path) -> None:
        self.root = Path(root)

    @classmethod
    def for_artifacts_dir(cls, artifacts_dir: Path) -> "PrepareStore":
        return cls(Path(artifacts_dir) / PREPARE_DIR_NAME)

    def step_dir(self, step: str) -> Path:
        return self.root / step

    def lock(self, step: str):
        """步骤级互斥锁（with store.lock(step): ...），在 load / build / save 外面包一层。"""
        return _exclusive_lock(self.root / f".{step}.lock")

    def load(self, step: str, version: str, inputs: dict[str, Any]) -> StepRecord | None:
        """指纹一致且产物都在时返回记录，否则 None。"""
        directory = self.step_dir(step)
        try:
            manifest = json.loads((directory / MANIFEST_NAME).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return None
        key = fingerprint({"step": step, "version": version, "inputs": inputs})
        if manifest.get("schema") != STEP_MANIFEST_SCHEMA or manifest.get("key") != key:
            return None
        outputs = {name: directory / rel for name, rel in dict(manifest.get("outputs") or {}).items()}
        if not all(path.is_file() for path in outputs.values()):
            return None
        return StepRecord(step, key, directory, outputs, float(manifest.get("elapsed_seconds") or 0.0), hit=True)

    def save(
        self,
        step: str,
        version: str,
        inputs: dict[str, Any],
        outputs: dict[str, Path],
        *,
        elapsed_seconds: float,
    ) -> StepRecord:
        """outputs 必须已经写在 step_dir(step) 下；最后才写 manifest。"""
        directory = self.step_dir(step)
        key = fingerprint({"step": step, "version": version, "inputs": inputs})
        relative = {name: str(Path(path).resolve().relative_to(directory.resolve())) for name, path in outputs.items()}
        _write_json_atomic(
            directory / MANIFEST_NAME,
            {
                "schema": STEP_MANIFEST_SCHEMA,
                "step": step,
                "version": version,
                "key": key,
                "inputs": inputs,
                "outputs": relative,
                "elapsed_seconds": round(float(elapsed_seconds), 3),
                "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            },
        )
        return StepRecord(step, key, directory, dict(outputs), float(elapsed_seconds), hit=False)

    def run(self, step: str, version: str, inputs: dict[str, Any], build) -> StepRecord:
        """命中缓存就直接返回；否则删掉旧 manifest，调用 build(step_dir) -> {名字: 路径} 后保存。

        整个过程持步骤锁：另一个进程正在做同一步时先等它，做完若指纹一致就直接命中。
        """
        with self.lock(step):
            cached = self.load(step, version, inputs)
            if cached is not None:
                return cached
            directory = self.step_dir(step)
            directory.mkdir(parents=True, exist_ok=True)
            (directory / MANIFEST_NAME).unlink(missing_ok=True)
            started = time.perf_counter()
            outputs = build(directory)
            return self.save(step, version, inputs, outputs, elapsed_seconds=time.perf_counter() - started)


__all__ = [
    "PREPARE_DIR_NAME",
    "PrepareStore",
    "StepRecord",
    "content_identity",
    "file_identity",
    "fingerprint",
    "link_or_copy",
]
