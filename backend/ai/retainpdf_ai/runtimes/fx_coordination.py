"""Bounded, conversation-scoped coordination for fx turns."""

from __future__ import annotations

import hashlib
import os
import stat
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

try:
    import fcntl
except ImportError:  # pragma: no cover - fx itself is unsupported on Windows
    fcntl = None  # type: ignore[assignment]


def conversation_namespace(conversation_id: str) -> str:
    value = conversation_id.strip() or "probe"
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:32]


class FxTurnCoordinator:
    """Allow bounded cross-conversation work and single-flight per session."""

    def __init__(self, state_root: Path, max_concurrent_turns: int) -> None:
        self._state_root = state_root.resolve()
        self._slots = threading.BoundedSemaphore(max(1, max_concurrent_turns))
        self._guard = threading.Lock()
        self._conversation_locks: dict[str, tuple[threading.Lock, int]] = {}

    @contextmanager
    def turn(self, conversation_id: str) -> Iterator[None]:
        namespace = conversation_namespace(conversation_id)
        conversation_lock = self._retain_lock(namespace)
        conversation_lock.acquire()
        descriptor: int | None = None
        slot_acquired = False
        try:
            descriptor = self._lock_file(namespace)
            self._slots.acquire()
            slot_acquired = True
            yield
        finally:
            if slot_acquired:
                self._slots.release()
            if descriptor is not None:
                if fcntl is not None:
                    fcntl.flock(descriptor, fcntl.LOCK_UN)
                os.close(descriptor)
            conversation_lock.release()
            self._release_lock(namespace)

    def _retain_lock(self, namespace: str) -> threading.Lock:
        with self._guard:
            current = self._conversation_locks.get(namespace)
            if current is None:
                lock = threading.Lock()
                self._conversation_locks[namespace] = (lock, 1)
                return lock
            lock, users = current
            self._conversation_locks[namespace] = (lock, users + 1)
            return lock

    def _release_lock(self, namespace: str) -> None:
        with self._guard:
            lock, users = self._conversation_locks[namespace]
            if users <= 1:
                self._conversation_locks.pop(namespace, None)
            else:
                self._conversation_locks[namespace] = (lock, users - 1)

    def _lock_file(self, namespace: str) -> int:
        if fcntl is None:
            raise RuntimeError("fx session coordination requires POSIX file locks")
        lock_root = self._state_root / "locks"
        for path in (self._state_root, lock_root):
            path.mkdir(parents=True, exist_ok=True, mode=0o700)
            if path.is_symlink() or not path.is_dir():
                raise RuntimeError("fx coordination contains an unsafe directory")
            try:
                path.chmod(0o700)
            except OSError:
                pass
        lock_path = lock_root / f"{namespace}.lock"
        flags = os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0)
        descriptor = os.open(lock_path, flags, 0o600)
        if not stat.S_ISREG(os.fstat(descriptor).st_mode):
            os.close(descriptor)
            raise RuntimeError("fx coordination lock is not a regular file")
        os.fchmod(descriptor, 0o600)
        fcntl.flock(descriptor, fcntl.LOCK_EX)
        return descriptor


_COORDINATORS_GUARD = threading.Lock()
_COORDINATORS: dict[Path, FxTurnCoordinator] = {}


def coordinator_for(
    state_root: Path,
    max_concurrent_turns: int,
) -> FxTurnCoordinator:
    key = state_root.resolve()
    with _COORDINATORS_GUARD:
        coordinator = _COORDINATORS.get(key)
        if coordinator is None:
            coordinator = FxTurnCoordinator(key, max_concurrent_turns)
            _COORDINATORS[key] = coordinator
        return coordinator
