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
_TERMINAL_OUTCOMES = {"succeeded", "rejected", "invalid_response", "ambiguous"}


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
        self._append_durable(event)
        with self._condition:
            self._open_dispatches[request_token] = request_key
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
        self._append_durable(event)
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
