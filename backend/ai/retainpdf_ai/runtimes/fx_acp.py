"""Low-level JSON-RPC transport for the pinned fx ACP subprocess."""

from __future__ import annotations

import json
import os
import queue
import signal
import subprocess
import threading
import time
from collections.abc import Callable
from pathlib import Path
from types import TracebackType
from typing import Any, Self

from ..request_control import RequestControl

_MAX_ACP_LINE_BYTES = 1024 * 1024


class FxAcpClient:
    def __init__(
        self,
        executable: Path,
        workspace: Path,
        env: dict[str, str],
        *,
        permission_handler: Callable[[dict[str, Any]], bool] | None,
        startup_timeout: float,
        turn_timeout: float,
        cleanup: Callable[[], None] | None = None,
    ) -> None:
        kwargs: dict[str, Any] = {
            "args": [str(executable), "acp"],
            "cwd": workspace,
            "env": env,
            "stdin": subprocess.PIPE,
            "stdout": subprocess.PIPE,
            "stderr": subprocess.PIPE,
            "text": True,
            "encoding": "utf-8",
            "errors": "replace",
            "bufsize": 1,
        }
        if os.name == "posix":
            kwargs["start_new_session"] = True
        elif os.name == "nt":
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        self._process = subprocess.Popen(**kwargs)
        self._lines: queue.Queue[str | None] = queue.Queue(maxsize=256)
        self._closed = threading.Event()
        self._stderr_seen = False
        self._next_id = 1
        self._permission_handler = permission_handler
        self._cleanup = cleanup
        self._startup_timeout = max(1.0, startup_timeout)
        self._turn_timeout = max(1.0, turn_timeout)
        self._stdout_thread = threading.Thread(target=self._read_stdout, daemon=True)
        self._stderr_thread = threading.Thread(target=self._read_stderr, daemon=True)
        self._stdout_thread.start()
        self._stderr_thread.start()

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        _type: type[BaseException] | None,
        _value: BaseException | None,
        _traceback: TracebackType | None,
    ) -> None:
        self.close()

    def initialize(self) -> str:
        result = self._request(
            "initialize",
            {"protocolVersion": 1, "clientCapabilities": {}},
            timeout=self._startup_timeout,
        )
        if result.get("protocolVersion") != 1:
            raise RuntimeError("fx ACP protocol version is incompatible")
        capabilities = result.get("agentCapabilities") or {}
        if capabilities.get("loadSession") is not True:
            raise RuntimeError("fx ACP peer does not support durable session loading")
        agent = result.get("agentInfo") or {}
        if agent.get("name") != "fx":
            raise RuntimeError("ACP peer did not identify itself as fx")
        return str(agent.get("version") or "")

    def create_session(self) -> str:
        result = self._request("session/new", {"mcpServers": []})
        session_id = str(result.get("sessionId") or "").strip()
        if not session_id:
            raise RuntimeError("fx session/new did not return a session id")
        return session_id

    def load_session(self, session_id: str) -> None:
        self._request(
            "session/load",
            {"sessionId": session_id, "mcpServers": []},
        )

    def set_mode(self, mode_id: str) -> None:
        result = self._request(
            "session/set_config_option",
            {"configId": "mode", "value": mode_id},
        )
        options = result.get("configOptions") or []
        selected = next(
            (
                option.get("currentValue")
                for option in options
                if isinstance(option, dict) and option.get("id") == "mode"
            ),
            None,
        )
        if selected != mode_id:
            raise RuntimeError(
                f"fx did not enter the required {mode_id!r} permission mode"
            )

    def prompt(
        self,
        session_id: str,
        prompt: str,
        on_update: Callable[[dict[str, Any]], None],
        request_control: RequestControl | None = None,
    ) -> str:
        result = self._request(
            "session/prompt",
            {
                "sessionId": session_id,
                "prompt": [{"type": "text", "text": prompt}],
            },
            timeout=self._turn_timeout,
            on_update=on_update,
            request_control=request_control,
        )
        return str(result.get("stopReason") or "unknown")

    def close(self) -> None:
        process = self._process
        self._closed.set()
        if process.poll() is None and process.stdin is not None:
            try:
                process.stdin.close()
            except OSError:
                pass
        if process.poll() is None:
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self._terminate_process(signal.SIGTERM)
        if process.poll() is None:
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self._terminate_process(signal.SIGKILL)
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    pass
        self._stdout_thread.join(timeout=1)
        self._stderr_thread.join(timeout=1)
        cleanup, self._cleanup = self._cleanup, None
        if cleanup is not None:
            try:
                cleanup()
            except Exception:
                pass

    def _terminate_process(self, sig: signal.Signals) -> None:
        process = self._process
        if process.poll() is not None:
            return
        if os.name == "posix" and process.pid:
            try:
                os.killpg(process.pid, sig)
            except ProcessLookupError:
                return
        elif sig == signal.SIGTERM:
            process.terminate()
        else:
            process.kill()

    def _put_line(self, line: str | None) -> None:
        while not self._closed.is_set():
            try:
                self._lines.put(line, timeout=0.1)
                return
            except queue.Full:
                continue

    def _request(
        self,
        method: str,
        params: dict[str, Any],
        *,
        timeout: float | None = None,
        on_update: Callable[[dict[str, Any]], None] | None = None,
        request_control: RequestControl | None = None,
    ) -> dict[str, Any]:
        request_id = self._next_id
        self._next_id += 1
        self._send(
            {"jsonrpc": "2.0", "id": request_id, "method": method, "params": params}
        )
        deadline = time.monotonic() + (timeout or self._startup_timeout)
        while True:
            if request_control is not None:
                request_control.raise_if_stopped()
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise RuntimeError(f"fx ACP request timed out: {method}")
            try:
                line = self._lines.get(timeout=min(remaining, 0.2))
            except queue.Empty as exc:
                if request_control is not None:
                    request_control.raise_if_stopped()
                if time.monotonic() < deadline:
                    continue
                raise RuntimeError(f"fx ACP request timed out: {method}") from exc
            if line is None:
                raise RuntimeError(
                    f"fx ACP process exited during {method}: {self._stderr_text()}"
                )
            if len(line.encode("utf-8")) > _MAX_ACP_LINE_BYTES:
                raise RuntimeError("fx ACP frame exceeded the backend size limit")
            try:
                message = json.loads(line)
            except json.JSONDecodeError as exc:
                raise RuntimeError("fx ACP stdout contained non-JSON output") from exc
            if not isinstance(message, dict):
                raise RuntimeError(  # noqa: TRY004 - malformed wire protocol
                    "fx ACP frame must be a JSON object"
                )
            if message.get("method") == "session/request_permission":
                request_params = message.get("params") or {}
                approved = bool(
                    self._permission_handler is not None
                    and isinstance(request_params, dict)
                    and self._permission_handler(request_params)
                )
                self._send(
                    {
                        "jsonrpc": "2.0",
                        "id": message.get("id"),
                        "result": permission_result(request_params, approved),
                    }
                )
                continue
            if message.get("method") == "session/update":
                update = (message.get("params") or {}).get("update")
                if isinstance(update, dict) and on_update is not None:
                    on_update(update)
                continue
            if "method" in message and "id" in message:
                self._send(
                    {
                        "jsonrpc": "2.0",
                        "id": message.get("id"),
                        "error": {
                            "code": -32601,
                            "message": "RetainPDF host does not admit this ACP request",
                        },
                    }
                )
                continue
            if message.get("id") != request_id:
                continue
            if message.get("error"):
                error = message.get("error") or {}
                raise RuntimeError(
                    f"fx ACP {method} failed: {error.get('message') or 'unknown error'}"
                )
            result = message.get("result")
            if not isinstance(result, dict):
                raise RuntimeError(  # noqa: TRY004 - malformed wire protocol
                    f"fx ACP {method} returned an invalid result"
                )
            return result

    def _send(self, message: dict[str, Any]) -> None:
        if self._process.poll() is not None or self._process.stdin is None:
            raise RuntimeError("fx ACP process is not running")
        encoded = json.dumps(message, ensure_ascii=False, separators=(",", ":"))
        if len(encoded.encode("utf-8")) > _MAX_ACP_LINE_BYTES:
            raise RuntimeError("fx ACP request exceeded the backend size limit")
        self._process.stdin.write(encoded + "\n")
        self._process.stdin.flush()

    def _read_stdout(self) -> None:
        stream = self._process.stdout
        if stream is None:
            self._put_line(None)
            return
        while not self._closed.is_set():
            line = stream.readline(_MAX_ACP_LINE_BYTES + 1)
            if not line:
                break
            self._put_line(line.rstrip("\r\n"))
        self._put_line(None)

    def _read_stderr(self) -> None:
        stream = self._process.stderr
        if stream is None:
            return
        for _line in stream:
            # fx receives a Gateway credential. Do not retain or surface raw
            # stderr because upstream diagnostics are not guaranteed to be
            # secret-free.
            self._stderr_seen = True

    def _stderr_text(self) -> str:
        return "stderr content suppressed" if self._stderr_seen else "no diagnostics"


def permission_result(params: dict[str, Any], approved: bool) -> dict[str, Any]:
    options = params.get("options")
    options = options if isinstance(options, list) else []
    target = "allow_once" if approved else "reject_once"
    aliases = {target, target.replace("_", "-")}
    for option in options:
        if not isinstance(option, dict):
            continue
        option_id = str(option.get("optionId") or "")
        kind = str(option.get("kind") or "")
        if option_id in aliases or kind in aliases:
            return {
                "outcome": {
                    "outcome": "selected",
                    "optionId": option_id,
                }
            }
    return {"outcome": {"outcome": "cancelled"}}
