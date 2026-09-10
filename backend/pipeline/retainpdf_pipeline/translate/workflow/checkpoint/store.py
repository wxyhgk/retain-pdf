from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

try:  # POSIX file locking; missing on Windows.
    import fcntl
except ImportError:  # pragma: no cover - Windows fallback
    fcntl = None  # type: ignore[assignment]

try:  # Windows file locking; missing on POSIX.
    import msvcrt
except ImportError:  # pragma: no cover - POSIX fallback
    msvcrt = None  # type: ignore[assignment]

CHECKPOINT_LOCK_FILE_NAME = ".translation-checkpoint.lock"
CHECKPOINT_SNAPSHOTS_DIR_NAME = ".translation-checkpoints"


def _lock_exclusive(handle: Any) -> None:
    """Take a non-blocking exclusive lock, or raise ``BlockingIOError``."""
    if fcntl is not None:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        return
    if msvcrt is not None:
        try:
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError as exc:
            raise BlockingIOError("checkpoint lock is held by another worker") from exc
        return
    # No OS locking available: single-process fallback, keep the handle open
    # so close() stays symmetric.


def _unlock(handle: Any) -> None:
    if fcntl is not None:
        fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        return
    if msvcrt is not None:
        try:
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        except OSError:
            pass


class CheckpointStore:
    def __init__(self, checkpoint_path: Path) -> None:
        self.path = Path(checkpoint_path)
        self._lock_handle: Any = None

    def acquire(self) -> None:
        if self._lock_handle is not None:
            raise RuntimeError("Checkpoint store already owns a lease")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        lock_path = self.path.parent / CHECKPOINT_LOCK_FILE_NAME
        handle = lock_path.open("a+b")
        try:
            _lock_exclusive(handle)
        except BlockingIOError as exc:
            handle.close()
            raise RuntimeError(
                f"Translation checkpoint is already owned by another worker: {self.path.parent}"
            ) from exc
        self._lock_handle = handle

    def require_owned_path(self, path: Path) -> None:
        if self._lock_handle is None or self.path.resolve() != Path(path).resolve():
            raise RuntimeError("Checkpoint store does not own the requested output lease")

    def load(self) -> object | None:
        if not self.path.is_file():
            return None
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"Invalid translation checkpoint: {self.path}") from exc

    def save(self, payload: object) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_name = tempfile.mkstemp(
            prefix=f".{self.path.name}.",
            suffix=".tmp",
            dir=self.path.parent,
            text=True,
        )
        tmp_path = Path(tmp_name)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, ensure_ascii=False, indent=2)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(tmp_path, self.path)
            _fsync_parent_dir(self.path)
        except Exception:
            try:
                tmp_path.unlink()
            except FileNotFoundError:
                pass
            raise

    def restore_committed_pages(self, payload: dict[str, Any]) -> None:
        """Restore page files that are ahead of the last checkpoint marker.

        Page JSON is written before the checkpoint. A crash in that gap can
        leave the public page path containing uncommitted bytes. Each
        checkpoint generation keeps hard-linked page snapshots, so restart
        can restore exactly the last committed generation before resuming.
        """

        for page in payload.get("pages", []):
            if not isinstance(page, dict):
                raise RuntimeError(f"Invalid translation checkpoint page: {self.path}")
            relative = str(page.get("path", "") or "")
            expected_hash = str(page.get("page_hash", "") or "")
            if not expected_hash:
                continue
            page_path = self.path.parent / _safe_page_name(relative)
            if page_path.is_file() and _sha256(page_path) == expected_hash:
                continue
            snapshot_relative = str(page.get("snapshot_path", "") or "")
            snapshot = self.path.parent / _safe_snapshot_path(
                snapshot_relative,
                page_name=page_path.name,
            )
            if not snapshot.is_file() or snapshot.is_symlink():
                raise RuntimeError(
                    f"Committed translation page snapshot is missing: {snapshot}"
                )
            if _sha256(snapshot) != expected_hash:
                raise RuntimeError(
                    f"Committed translation page snapshot hash mismatch: {snapshot}"
                )
            _replace_with_snapshot(snapshot, page_path)

    def snapshot_pages(self, payload: dict[str, Any]) -> None:
        generation = int(payload.get("generation", 0) or 0)
        snapshot_dir = (
            self.path.parent
            / CHECKPOINT_SNAPSHOTS_DIR_NAME
            / f"generation-{generation}"
        )
        pages = [page for page in payload.get("pages", []) if isinstance(page, dict)]
        if not pages:
            return
        snapshot_dir.mkdir(parents=True, exist_ok=True)
        for page in pages:
            page_name = _safe_page_name(str(page.get("path", "") or ""))
            source = self.path.parent / page_name
            if not source.is_file() or source.is_symlink():
                raise RuntimeError(f"Translation checkpoint page is missing: {source}")
            expected_hash = str(page.get("page_hash", "") or "")
            if not expected_hash or _sha256(source) != expected_hash:
                raise RuntimeError(f"Translation checkpoint page hash mismatch: {source}")
            target = snapshot_dir / page_name
            if target.exists() and (
                target.is_symlink()
                or not target.is_file()
                or _sha256(target) != expected_hash
            ):
                if target.is_dir() and not target.is_symlink():
                    shutil.rmtree(target)
                else:
                    target.unlink()
            if not target.exists():
                try:
                    os.link(source, target)
                except OSError:
                    shutil.copy2(source, target)
            if _sha256(target) != expected_hash:
                raise RuntimeError(
                    f"Translation checkpoint snapshot hash mismatch: {target}"
                )
            page["snapshot_path"] = target.relative_to(self.path.parent).as_posix()
        _fsync_parent_dir(snapshot_dir / ".sentinel")

    def prune_snapshots(self, generation: int) -> None:
        snapshots_root = self.path.parent / CHECKPOINT_SNAPSHOTS_DIR_NAME
        if not snapshots_root.is_dir():
            return
        keep = f"generation-{int(generation)}"
        for candidate in snapshots_root.iterdir():
            if candidate.name != keep and candidate.is_dir() and not candidate.is_symlink():
                shutil.rmtree(candidate)

    def close(self) -> None:
        if self._lock_handle is None:
            return
        try:
            _unlock(self._lock_handle)
        finally:
            self._lock_handle.close()
            self._lock_handle = None


def _fsync_parent_dir(path: Path) -> None:
    try:
        dir_fd = os.open(path.parent, os.O_RDONLY)
    except OSError:
        return
    try:
        os.fsync(dir_fd)
    finally:
        os.close(dir_fd)


def _safe_page_name(relative: str) -> str:
    path = Path(relative)
    if (
        len(path.parts) != 1
        or not path.name.startswith("page-")
        or not path.name.endswith(".json")
    ):
        raise RuntimeError(f"Unsafe translation checkpoint page path: {relative}")
    return path.name


def _safe_snapshot_path(relative: str, *, page_name: str) -> Path:
    path = Path(relative)
    if (
        len(path.parts) != 3
        or path.parts[0] != CHECKPOINT_SNAPSHOTS_DIR_NAME
        or not path.parts[1].startswith("generation-")
        or path.parts[2] != page_name
    ):
        raise RuntimeError(f"Unsafe translation checkpoint snapshot path: {relative}")
    return path


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _replace_with_snapshot(snapshot: Path, target: Path) -> None:
    fd, tmp_name = tempfile.mkstemp(
        prefix=f".{target.name}.",
        suffix=".restore.tmp",
        dir=target.parent,
    )
    os.close(fd)
    tmp_path = Path(tmp_name)
    try:
        tmp_path.unlink()
        try:
            os.link(snapshot, tmp_path)
        except OSError:
            shutil.copy2(snapshot, tmp_path)
        os.replace(tmp_path, target)
        _fsync_parent_dir(target)
    except Exception:
        try:
            tmp_path.unlink()
        except FileNotFoundError:
            pass
        raise
