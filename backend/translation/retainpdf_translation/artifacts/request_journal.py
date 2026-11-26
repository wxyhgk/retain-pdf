from __future__ import annotations

import hashlib
import json
import os
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


TRANSLATION_REQUEST_JOURNAL_FILE_NAME = "translation-request-journal.v1.jsonl"
_SCHEMA = "translation_request_journal_v1"
_SCHEMA_VERSION = 1
_GROUP_COMMIT_WINDOW_SECONDS = 0.005
# failed_not_sent：连接都没建成，请求没发出去（连接被拒、DNS 失败、建连超时，见 client.py 的 _request_never_left）。
# 和别的终态一样把 dispatch 配上；只有 ambiguous 和没配上的 dispatch 算「结果不明」，Rust 那边同一个判据
# （retainpdf-core 的 translation_request_journal.rs）。
_TERMINAL_OUTCOMES = {"succeeded", "rejected", "invalid_response", "failed_not_sent", "ambiguous"}


class RequestDispatchStopped(RuntimeError):
    """进程正在退出排空（``begin_request_drain``），不再放新请求出去。"""


class _DispatchGate:
    """本进程所有请求日志共用的闸门：退出时不再放新请求出去，并数还在途的请求。

    「在途」从 dispatch 落盘之前算起，到 terminal 落盘（或写失败）为止。排空开始以后，想发新请求的线程
    停在 ``enter`` 里不再往下走：不写 dispatch、不发请求，也不抛错（抛错会让调用方把块记成失败、写进断点）。
    进程等在途的请求回来以后自己退出（``workflow/shutdown_drain.py``），停住的线程随进程一起结束。
    """

    def __init__(self) -> None:
        self._condition = threading.Condition()
        self._draining = False
        self._released = False
        self._live = 0

    def enter(self) -> None:
        with self._condition:
            while self._draining and not self._released:
                self._condition.wait()
            if self._draining:
                raise RequestDispatchStopped("translation worker is shutting down; request not dispatched")
            self._live += 1

    def leave(self) -> None:
        with self._condition:
            self._live = max(0, self._live - 1)
            self._condition.notify_all()

    def begin_drain(self) -> int:
        with self._condition:
            self._draining = True
            return self._live

    def live(self) -> int:
        with self._condition:
            return self._live

    def wait_idle(self, timeout: float) -> bool:
        with self._condition:
            return self._condition.wait_for(lambda: self._live == 0, timeout=max(0.0, timeout))

    def release_stopped_for_tests(self) -> None:
        """只给测试用：让停在闸门上的线程抛 ``RequestDispatchStopped`` 出来（正式运行时进程直接退出）。"""
        with self._condition:
            self._released = True
            self._condition.notify_all()

    def reset_for_tests(self) -> None:
        with self._condition:
            self._draining = False
            self._released = False
            self._live = 0
            self._condition.notify_all()


_DISPATCH_GATE = _DispatchGate()


def begin_request_drain() -> int:
    """开始退出排空：之后不再有新请求发出去。返回这时还在途的请求数。"""
    return _DISPATCH_GATE.begin_drain()


def inflight_request_count() -> int:
    return _DISPATCH_GATE.live()


def wait_for_inflight_requests(timeout: float) -> bool:
    """等在途的请求都写上终态，最多 ``timeout`` 秒。等到了返回 True。"""
    return _DISPATCH_GATE.wait_idle(timeout)


class TranslationRequestJournal:
    """Durable, content-free lifecycle journal for upstream LLM requests.

    A dispatch record is fsynced before the request leaves the process. A
    terminal record closes it after a response or a known failure. Unmatched
    dispatches therefore mean only "outcome unknown"; they never imply success.
    """

    def __init__(self, path: Path, *, attempt_id: str) -> None:
        self.path = Path(path)
        self.attempt_id = str(attempt_id or "unknown")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._condition = threading.Condition()
        self._next_sequence = 0
        self._durable_sequence = 0
        self._flush_in_progress = False
        self._failure: BaseException | None = None
        self._closed = False
        # 本进程发出、还没写终态的 dispatch（不含从旧日志继承来的），终态写完从闸门的在途数里减掉
        self._live_tokens: set[str] = set()
        self._open_dispatches, ambiguous_keys, active_ambiguous_keys, valid_size = (
            self._load_existing_state()
        )
        self._ambiguous_request_keys = set(ambiguous_keys)
        self._active_ambiguous_request_keys = set(active_ambiguous_keys)
        self._inherited_unresolved_dispatches = len(self._open_dispatches)
        self._inherited_ambiguous_request_keys = len(self._ambiguous_request_keys)
        self._inherited_active_ambiguous_request_keys = len(
            self._active_ambiguous_request_keys
        )
        flags = os.O_APPEND | os.O_CREAT | os.O_WRONLY
        if hasattr(os, "O_CLOEXEC"):
            flags |= os.O_CLOEXEC
        self._fd = os.open(self.path, flags, 0o600)
        try:
            if os.fstat(self._fd).st_size != valid_size:
                os.ftruncate(self._fd, valid_size)
                os.fsync(self._fd)
            try:
                os.chmod(self.path, 0o600)
            except OSError:
                pass
        except BaseException:
            self._closed = True
            try:
                os.close(self._fd)
            except OSError:
                pass
            raise

    def _load_existing_state(
        self,
    ) -> tuple[dict[str, str], set[str], set[str], int]:
        if not self.path.exists():
            return {}, set(), set(), 0
        raw = self.path.read_bytes()
        valid_size = len(raw) if raw.endswith(b"\n") else raw.rfind(b"\n") + 1
        complete = raw[:valid_size]
        open_dispatches: dict[str, str] = {}
        ambiguous_keys: set[str] = set()
        active_ambiguous_keys: set[str] = set()
        for line_number, raw_line in enumerate(complete.splitlines(), start=1):
            if not raw_line.strip():
                continue
            try:
                event = json.loads(raw_line)
            except json.JSONDecodeError as exc:
                raise RuntimeError(
                    f"invalid translation request journal at line {line_number}: {self.path}"
                ) from exc
            if event.get("schema") != _SCHEMA or event.get("schema_version") != _SCHEMA_VERSION:
                raise RuntimeError(
                    f"unsupported translation request journal contract at line {line_number}: {self.path}"
                )
            token = str(event.get("request_token") or "")
            request_key = str(event.get("request_key") or "")
            if event.get("event") == "dispatch" and token and request_key:
                open_dispatches[token] = request_key
            elif event.get("event") == "terminal" and token:
                open_dispatches.pop(token, None)
                if event.get("outcome") == "ambiguous" and request_key:
                    ambiguous_keys.add(request_key)
                    active_ambiguous_keys.add(request_key)
                elif request_key:
                    active_ambiguous_keys.discard(request_key)
                    if request_key in open_dispatches.values():
                        ambiguous_keys.add(request_key)
                        open_dispatches = {
                            open_token: open_key
                            for open_token, open_key in open_dispatches.items()
                            if open_key != request_key
                        }
        active_ambiguous_keys.update(open_dispatches.values())
        ambiguous_keys.update(active_ambiguous_keys)
        return open_dispatches, ambiguous_keys, active_ambiguous_keys, valid_size

    def record_dispatch(
        self,
        *,
        request_key: str,
        stage: str,
        request_label: str,
        http_attempt: int,
    ) -> str:
        request_token = uuid.uuid4().hex
        with self._condition:
            prior_ambiguous = request_key in self._ambiguous_request_keys
        event = self._base_event(
            event="dispatch",
            request_token=request_token,
            request_key=request_key,
        )
        event.update(
            {
                "stage": str(stage or "unspecified"),
                "request_label_hash": hashlib.sha256(str(request_label or "").encode("utf-8")).hexdigest(),
                "http_attempt": max(1, int(http_attempt)),
                "prior_ambiguous": prior_ambiguous,
            }
        )
        _DISPATCH_GATE.enter()
        try:
            self._append_durable(event)
        except BaseException:
            _DISPATCH_GATE.leave()
            raise
        with self._condition:
            self._open_dispatches[request_token] = request_key
            self._live_tokens.add(request_token)
        return request_token

    def record_terminal(
        self,
        *,
        request_token: str,
        request_key: str,
        outcome: str,
        status_code: int | None = None,
        error_class: str = "",
    ) -> None:
        if outcome not in _TERMINAL_OUTCOMES:
            raise ValueError(f"unsupported request journal outcome: {outcome}")
        event = self._base_event(
            event="terminal",
            request_token=request_token,
            request_key=request_key,
        )
        event["outcome"] = outcome
        if status_code is not None:
            event["status_code"] = int(status_code)
        if error_class:
            event["error_class"] = str(error_class)[:120]
        try:
            self._append_durable(event)
        finally:
            # 写失败也不再算在途：请求已经结束，没写上的终态让这条 dispatch 留成「结果不明」
            with self._condition:
                was_live = request_token in self._live_tokens
                self._live_tokens.discard(request_token)
            if was_live:
                _DISPATCH_GATE.leave()
        with self._condition:
            self._open_dispatches.pop(request_token, None)
            if outcome == "ambiguous":
                self._ambiguous_request_keys.add(request_key)
                self._active_ambiguous_request_keys.add(request_key)
            else:
                self._active_ambiguous_request_keys.discard(request_key)
                inherited_tokens = [
                    token
                    for token, open_key in self._open_dispatches.items()
                    if open_key == request_key
                ]
                if inherited_tokens:
                    self._ambiguous_request_keys.add(request_key)
                    for token in inherited_tokens:
                        self._open_dispatches.pop(token, None)

    def summary(self) -> dict[str, Any]:
        with self._condition:
            return {
                "schema": _SCHEMA,
                "path": str(self.path),
                "inherited_unresolved_dispatches": self._inherited_unresolved_dispatches,
                "inherited_ambiguous_request_keys": self._inherited_ambiguous_request_keys,
                "inherited_active_ambiguous_request_keys": self._inherited_active_ambiguous_request_keys,
                "current_unresolved_dispatches": len(self._open_dispatches),
                "known_ambiguous_request_keys": len(self._ambiguous_request_keys),
                "active_ambiguous_request_keys": len(
                    self._active_ambiguous_request_keys.union(self._open_dispatches.values())
                ),
            }

    def close(self) -> None:
        with self._condition:
            if self._closed:
                return
            while self._flush_in_progress and self._failure is None:
                self._condition.wait()
            # Cleanup must release the descriptor even after a durable-write failure.
            self._closed = True
            os.close(self._fd)

    def _base_event(self, *, event: str, request_token: str, request_key: str) -> dict[str, Any]:
        return {
            "schema": _SCHEMA,
            "schema_version": _SCHEMA_VERSION,
            "event": event,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "attempt_id": self.attempt_id,
            "request_token": request_token,
            "request_key": request_key,
        }

    def _append_durable(self, event: dict[str, Any]) -> None:
        encoded = (json.dumps(event, ensure_ascii=True, sort_keys=True, separators=(",", ":")) + "\n").encode(
            "utf-8"
        )
        leader = False
        with self._condition:
            self._raise_if_unavailable()
            self._write_all(encoded)
            self._next_sequence += 1
            own_sequence = self._next_sequence
            if not self._flush_in_progress:
                self._flush_in_progress = True
                leader = True

        if leader:
            # Let concurrent request workers join this fsync without delaying an
            # individual dispatch by more than a few milliseconds.
            time.sleep(_GROUP_COMMIT_WINDOW_SECONDS)
            with self._condition:
                try:
                    os.fsync(self._fd)
                    self._durable_sequence = self._next_sequence
                except BaseException as exc:  # noqa: BLE001
                    self._failure = exc
                finally:
                    self._flush_in_progress = False
                    self._condition.notify_all()

        with self._condition:
            while self._durable_sequence < own_sequence and self._failure is None:
                self._condition.wait()
            self._raise_if_unavailable()

    def _write_all(self, encoded: bytes) -> None:
        view = memoryview(encoded)
        while view:
            written = os.write(self._fd, view)
            if written <= 0:
                raise OSError("translation request journal write made no progress")
            view = view[written:]

    def _raise_if_unavailable(self) -> None:
        if self._failure is not None:
            raise RuntimeError(f"translation request journal durability failed: {self.path}") from self._failure
        if self._closed:
            raise RuntimeError(f"translation request journal is closed: {self.path}")
