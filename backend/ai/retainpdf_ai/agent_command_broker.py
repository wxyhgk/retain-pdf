"""Host lifecycle and execution boundary for document-capable Agent runtimes.

fx executes only the generated ``retainpdf-agent`` wrapper. OpenAI-compatible
function-calling runtimes invoke the same exact argv grammar directly through
the host. Neither path receives a Rust credential: the broker mints a
single-action capability and runs the real CLI in a separate host process.
"""

from __future__ import annotations

import json
import os
import secrets
import shutil
import socket
import stat
import subprocess
import threading
from collections import Counter
from collections.abc import Callable
from pathlib import Path
from types import TracebackType
from typing import TYPE_CHECKING, Any, Self

from .agent_broker_commands import parse_broker_argv, parse_broker_command
from .agent_broker_contracts import (
    BrokerCommand,
    BrokerScope,
    BrokerUsageError,
    CapabilityIssuer,
)
from .agent_broker_events import safe_operation_event
from .agent_broker_transport import (
    MAX_BROKER_FRAME_BYTES,
    failure,
    recv_json_line,
    wrapper_source,
)
from .agent_translation_runner import CliResult, TranslationCommandRunner

if TYPE_CHECKING:
    from .tools import ToolRegistry

_MAX_CALLS_PER_TURN = 16
# shell 命令单独计数。和上面那个刻意不共用:operation 有副作用,16 次/轮是
# 有意压着的;而终端里 cat/grep/jq 翻几十次很正常,共用会让终端刚打开就没气。
_MAX_SHELL_CALLS_PER_TURN = 200
# 终端（PTY）里的 broker 跟着终端活，不是跟着一轮对话。精修一章几十块，
# 每块 show + revise 两条，16 次/轮的上限在这里没有意义。
_MAX_TERMINAL_CALLS = 2000
_CLI_TIMEOUT_SECONDS = 30

# Kept as a compatibility alias for existing tests and integrations importing
# the formerly local helper through fx_command_broker.
_safe_operation_event = safe_operation_event


class AgentCommandBroker:
    def __init__(
        self,
        *,
        state_root: Path,
        cli_command: str,
        rust_api_url: str,
        rust: CapabilityIssuer,
        scope: BrokerScope,
        on_operation_event: Callable[[dict[str, Any]], None] | None = None,
        tool_registry: ToolRegistry | None = None,
        on_tool_event: Callable[[dict[str, Any]], None] | None = None,
        shell_mode: bool = False,
        job_dir: Path | None = None,
        terminal_mode: bool = False,
    ) -> None:
        self._state_root = state_root.resolve()
        self._cli_command = cli_command
        self._rust_api_url = rust_api_url.rstrip("/")
        self._rust = rust
        self._scope = scope
        self._on_operation_event = on_operation_event
        self._tool_registry = tool_registry
        self._on_tool_event = on_tool_event
        self._citations: dict[int, Any] = {}
        self._next_ref = 1
        self._turn_id = secrets.token_urlsafe(18)
        self._root = self._state_root / "brokers" / self._turn_id
        self._bin_dir = self._root / "bin"
        self._work_dir = self._root / "work"
        self._request_dir = self._work_dir / "requests"
        # Darwin's sockaddr_un path is short. Keep only the socket in a random
        # owner-only /tmp directory; all turn files remain under state_root.
        self._socket_dir = Path("/tmp") / f"rpdf-fx-{self._turn_id[:16]}"
        self._socket_path = self._socket_dir / "broker.sock"
        self._broker_key = secrets.token_urlsafe(32)
        self._approved: Counter[tuple[str, ...]] = Counter()
        self._approved_tool_ids: dict[tuple[str, ...], list[str]] = {}
        self._approved_lock = threading.Lock()
        self._stop = threading.Event()
        self._listener: socket.socket | None = None
        self._thread: threading.Thread | None = None
        self._call_count = 0
        self._shell_mode = bool(shell_mode)
        self._shell_call_count = 0
        # 译文精修命令要在宿主侧扫这本书的译文文件（term-set 列受影响的块）。
        self._job_dir = job_dir.resolve() if job_dir is not None else None
        # 终端模式：没有 ACP 的 request_permission，wrapper 打进来的命令不经
        # approve_permission 预批，所以只放行 translation 这一组（其余要会话）。
        self._terminal_mode = bool(terminal_mode)
        self._request_seq = 0

    @property
    def bin_dir(self) -> Path:
        return self._bin_dir

    @property
    def instructions(self) -> str:
        if self._scope.green_light:
            confirmation = (
                "RetainPDF green-light mode is enabled. You may run and commit operations "
                "needed by the current user request without asking for manual confirmation. "
                "This does not permit any command outside the listed grammar."
            )
        elif self._scope.confirmed:
            confirmation = (
                "The host supplied explicit run/commit confirmation for this turn."
            )
        else:
            confirmation = (
                "The host did not confirm run/commit; those commands will be rejected. "
                "Tell the user to use the operation card action. Never claim that typing an "
                "exact phrase in chat will grant confirmation."
            )
        return (
            "The only host tool is retainpdf-agent. Supported commands are exactly:\n"
            "retainpdf-agent document inspect\n"
            "retainpdf-agent document usage\n"
            "retainpdf-agent tool call --name <allowed-name> "
            "--arguments-base64url <base64url-encoded-compact-json-object>\n"
            "retainpdf-agent operation create --program-json '<compact-json>'\n"
            "retainpdf-agent operation get --operation-id <id>\n"
            "retainpdf-agent operation run --operation-id <id>\n"
            "retainpdf-agent operation run --operation-id <id> --retry failed\n"
            "retainpdf-agent operation run --operation-id <id> --retry ambiguous "
            "--accept-duplicate-risk yes\n"
            "retainpdf-agent operation commit --operation-id <id>\n"
            "retainpdf-agent operation cancel --operation-id <id> "
            "--reason-code <agent_abort|superseded|user_cancelled>\n"
            "The compact program JSON is exactly "
            '{"schema":"retainpdf_page_program_v1","steps":[...]}. '
            "Steps are applied in order and use 1-based current-page numbers. "
            'Allowed steps are {"op":"select_pages","pages":[...]}, which '
            "can delete/reorder/duplicate pages, and "
            '{"op":"rotate_pages","pages":[...],"degrees":90|180|270}. '
            "Allowed tool names are list_documents, search_fulltext, read_blocks, "
            "search_favorites, search_markdown, read_markdown_chunk, "
            "calculate_expression, calculate_statistics, analyze_table, and generate_chart. "
            "Table analysis and chart tools require document_id, job_id, page_idx, and "
            "block_ids from prior reading results. Do not invent those references. "
            "Do not use shell syntax, paths, redirection, substitutions, or other commands. "
            "The host injects document scope, message identity, idempotency keys, and credentials. "
            f"{confirmation}"
            f"{self._translation_instructions()}"
        )

    def _translation_instructions(self) -> str:
        if not self._scope.job_id.strip():
            return ""
        return (
            "\nTranslation refinement for this book (same confirmation rule applies to "
            "revise/refine/rerender/term-set):\n"
            "retainpdf-agent translation issues [--pages 3-5] [--severity critical|major|minor] "
            "[--limit 50]\n"
            "retainpdf-agent translation show --item-id <id>\n"
            "retainpdf-agent translation data [--dataset <name> [--query 'field=value&group_by=field&sort=-field&limit=50']] "
            "(read-only; without --dataset it lists datasets such as revisions, qa_violations, layout_blocks, "
            "terms, escalated, events, token_usage and their fields)\n"
            "retainpdf-agent translation revise --item-id <id> --text '<new>' --reason \"<why>\"\n"
            "retainpdf-agent translation refine [--pages 3-5] [--review-only]\n"
            "retainpdf-agent translation rerender\n"
            'retainpdf-agent translation term-set --source "<term>" --target "<rendering>"\n'
            "Keep placeholders such as <f1-e32/> or [[FORMULA_1]] and $...$ math verbatim; "
            "edit only the faulty span; propose changes and get user approval before revising; "
            "rerender once after all revisions."
        )

    @property
    def citations(self) -> dict[int, Any]:
        return dict(self._citations)

    def __enter__(self) -> Self:
        if os.name != "posix":
            raise RuntimeError("fx command broker requires a Unix-domain socket")
        for path in (
            self._state_root,
            self._root,
            self._bin_dir,
            self._work_dir,
            self._request_dir,
            self._socket_dir,
        ):
            path.mkdir(parents=True, exist_ok=True, mode=0o700)
            if path.is_symlink() or not path.is_dir():
                raise RuntimeError("fx broker directory is unsafe")
            path.chmod(0o700)
        self._write_wrapper()
        listener = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        listener.bind(str(self._socket_path))
        self._socket_path.chmod(0o600)
        listener.listen(4)
        listener.settimeout(0.2)
        self._listener = listener
        self._thread = threading.Thread(target=self._serve, daemon=True)
        self._thread.start()
        return self

    def __exit__(
        self,
        _type: type[BaseException] | None,
        _value: BaseException | None,
        _traceback: TracebackType | None,
    ) -> None:
        self.close()

    def close(self) -> None:
        self._stop.set()
        if self._listener is not None:
            self._listener.close()
        if self._thread is not None:
            self._thread.join(timeout=1)
        shutil.rmtree(self._root, ignore_errors=True)
        shutil.rmtree(self._socket_dir, ignore_errors=True)

    def approve_permission(self, params: dict[str, Any]) -> bool:
        options = params.get("options")
        if not isinstance(options, list) or not any(
            isinstance(option, dict)
            and (
                str(option.get("optionId") or "") in {"allow_once", "allow-once"}
                or str(option.get("kind") or "") in {"allow_once", "allow-once"}
            )
            for option in options
        ):
            return False
        tool_call = params.get("toolCall")
        if not isinstance(tool_call, dict) or tool_call.get("kind") != "execute":
            return False
        raw_input = tool_call.get("rawInput")
        if not isinstance(raw_input, dict):
            return False
        raw_command = raw_input.get("command")
        if not isinstance(raw_command, str):
            return False
        try:
            command = parse_broker_command(raw_command, self._scope)
        except ValueError:
            # 不是 broker 那条固定语法。此前一律拒绝 —— 这就是「fx 明明自带
            # 终端，却只能跑一条命令」的来源：终端一直都在，被这里堵死的。
            #
            # shell 模式打开后放行。配额分开记：broker operation 是有副作用的
            # 结构化操作，16 次/轮是有意的上限；而在终端里查点东西几十条命令
            # 很正常，共用配额会让终端刚打开就没气了。
            return self._approve_shell_command(raw_command, tool_call)
        with self._approved_lock:
            if sum(self._approved.values()) >= _MAX_CALLS_PER_TURN:
                return False
            self._approved[command.public_argv] += 1
            tool_call_id = str(tool_call.get("toolCallId") or "")[:256]
            self._approved_tool_ids.setdefault(command.public_argv, []).append(
                tool_call_id
            )
        self._emit_tool_event(command, tool_call_id, "running")
        return True

    def _approve_shell_command(
        self, raw_command: str, tool_call: dict[str, Any]
    ) -> bool:
        """放行 broker 语法之外的普通命令。

        关着就是老行为（拒绝），开着就放行。开关来自
        `RETAIN_AI_FX_SHELL_MODE`，默认关 —— 老路径一个字节都没变。

        事件里只带可执行文件名，不带参数：参数里会出现文档正文、路径和用户
        输入，灌进事件流既没用，又会跟着日志到处跑。
        """
        if not self._shell_mode:
            return False
        with self._approved_lock:
            if self._shell_call_count >= _MAX_SHELL_CALLS_PER_TURN:
                return False
            self._shell_call_count += 1
            tool_call_id = str(tool_call.get("toolCallId") or "")[:256]
        self._emit_shell_event(raw_command, tool_call_id)
        return True

    def _emit_shell_event(self, raw_command: str, tool_call_id: str) -> None:
        if self._on_tool_event is None:
            return
        from .unified_tools import agent_tool_event

        head = raw_command.strip().split(None, 1)
        executable = head[0] if head else ""
        name = f"shell:{executable.rsplit('/', 1)[-1] or 'unknown'}"
        try:
            self._on_tool_event(agent_tool_event(name, tool_call_id, "running"))
        except Exception:  # noqa: BLE001,S110 - progress delivery is best effort
            pass

    def execute_host_argv(self, argv: tuple[str, ...]) -> dict[str, Any]:
        """Execute one structured model tool call through the shared broker."""
        command = parse_broker_argv(argv, self._scope)
        with self._approved_lock:
            if self._call_count >= _MAX_CALLS_PER_TURN:
                return failure("broker call limit reached")
            self._call_count += 1
        return self._execute(command)

    def _serve(self) -> None:
        listener = self._listener
        if listener is None:
            return
        while not self._stop.is_set():
            try:
                connection, _ = listener.accept()
            except TimeoutError:
                continue
            except OSError:
                return
            with connection:
                response = self._handle_connection(connection)
                encoded = json.dumps(
                    response, ensure_ascii=False, separators=(",", ":")
                ).encode("utf-8")
                if len(encoded) > MAX_BROKER_FRAME_BYTES:
                    encoded = (
                        b'{"exit_code":1,"stdout":"","stderr":'
                        b'"broker response exceeded limit"}'
                    )
                try:
                    connection.sendall(encoded + b"\n")
                except OSError:
                    pass

    def _handle_connection(self, connection: socket.socket) -> dict[str, Any]:
        try:
            payload = recv_json_line(connection)
            if payload.get("broker_key") != self._broker_key:
                return failure("broker authentication failed")
            argv = payload.get("argv")
            if not isinstance(argv, list) or not all(
                isinstance(item, str) for item in argv
            ):
                return failure("invalid broker argv")
            public_argv = ("retainpdf-agent", *argv)
            command = parse_broker_argv(public_argv, self._scope)
            if self._terminal_mode:
                return self._handle_terminal_command(command)
            with self._approved_lock:
                if self._approved[command.public_argv] <= 0:
                    return failure("command was not approved")
                self._approved[command.public_argv] -= 1
                approved_ids = self._approved_tool_ids.get(command.public_argv, [])
                tool_call_id = approved_ids.pop(0) if approved_ids else ""
                if self._call_count >= _MAX_CALLS_PER_TURN:
                    return failure("broker call limit reached")
                self._call_count += 1
            return self._execute(command, tool_call_id=tool_call_id)
        except BrokerUsageError as exc:
            return failure(f"{exc}\n")
        except (OSError, TypeError, ValueError, json.JSONDecodeError):
            return failure("invalid broker request")
        except Exception:  # noqa: BLE001 - never expose host diagnostics to fx
            return failure("host command execution failed")

    def _handle_terminal_command(self, command: BrokerCommand) -> dict[str, Any]:
        if not command.action.startswith("translation."):
            return failure(
                "这个终端只支持 retainpdf-agent translation 命令；"
                "文档操作请在阅读页的对话里做。\n"
            )
        with self._approved_lock:
            if self._call_count >= _MAX_TERMINAL_CALLS:
                return failure("broker call limit reached")
            self._call_count += 1
        return self._execute(command)

    def _execute(
        self, command: BrokerCommand, *, tool_call_id: str = ""
    ) -> dict[str, Any]:
        if command.action == "tool.call":
            return self._execute_host_tool(command, tool_call_id=tool_call_id)
        if command.action.startswith("translation."):
            return self._execute_translation(command, tool_call_id=tool_call_id)
        issued = self._rust.issue_agent_capability(
            conversation_id=self._scope.conversation_id,
            document_id=self._scope.document_id,
            actions=[command.action],
            ttl_seconds=60,
        )
        capability = str(issued.get("capability") or "")
        if not capability:
            return failure("host did not issue a capability")
        cli_path = _resolve_cli(self._cli_command)
        argv = [str(cli_path), *command.cli_argv]
        if command.request_payload is not None:
            request_name = f"request-{self._call_count:02d}.json"
            request_path = self._request_dir / request_name
            _write_json_no_follow(request_path, command.request_payload)
            argv.extend(["--request", f"requests/{request_name}"])
        env = self._cli_env(capability)
        try:
            completed = subprocess.run(
                argv,
                cwd=self._work_dir,
                env=env,
                stdin=subprocess.DEVNULL,
                capture_output=True,
                timeout=_CLI_TIMEOUT_SECONDS,
                check=False,
            )
        except subprocess.TimeoutExpired:
            return failure("retainpdf-agent timed out")
        stdout = completed.stdout[:MAX_BROKER_FRAME_BYTES].decode(
            "utf-8", errors="replace"
        )
        stderr = completed.stderr[:MAX_BROKER_FRAME_BYTES].decode(
            "utf-8", errors="replace"
        )
        stdout = stdout.replace(capability, "[REDACTED]")
        stderr = stderr.replace(capability, "[REDACTED]")
        if completed.returncode == 0 and self._on_operation_event is not None:
            event = safe_operation_event(command, stdout, self._scope)
            if event is not None:
                try:
                    self._on_operation_event(event)
                except Exception:  # noqa: BLE001, S110 - discovery is best effort
                    pass
        response = {
            "exit_code": int(completed.returncode),
            "stdout": stdout,
            "stderr": stderr,
        }
        self._emit_tool_event(
            command,
            tool_call_id,
            "completed" if completed.returncode == 0 else "failed",
        )
        return response

    def _execute_translation(
        self, command: BrokerCommand, *, tool_call_id: str = ""
    ) -> dict[str, Any]:
        runner = TranslationCommandRunner(
            job_id=self._scope.job_id.strip(),
            job_dir=self._job_dir,
            call=self._call_job_cli,
        )
        response = runner.run(command)
        self._emit_tool_event(
            command,
            tool_call_id,
            "completed" if response.get("exit_code") == 0 else "failed",
        )
        return response

    def _call_job_cli(
        self,
        action: str,
        cli_argv: tuple[str, ...],
        payload: dict[str, Any] | None,
    ) -> CliResult:
        """用一张任务级、单动作的 capability 跑一次真正的 CLI。"""
        try:
            issued = self._rust.issue_agent_capability(
                conversation_id="",
                document_id="",
                actions=[action],
                ttl_seconds=60,
                job_id=self._scope.job_id.strip(),
            )
        except Exception:  # noqa: BLE001 - 不把宿主细节漏给 agent
            return CliResult(False, None, None, "host could not issue a capability")
        capability = str(issued.get("capability") or "")
        if not capability:
            return CliResult(False, None, None, "host did not issue a capability")
        argv = [str(_resolve_cli(self._cli_command)), *cli_argv]
        if payload is not None:
            with self._approved_lock:
                self._request_seq += 1
                request_name = f"job-request-{self._request_seq:04d}.json"
            _write_json_no_follow(self._request_dir / request_name, payload)
            argv.extend(["--request", f"requests/{request_name}"])
        try:
            completed = subprocess.run(
                argv,
                cwd=self._work_dir,
                env=self._cli_env(capability),
                stdin=subprocess.DEVNULL,
                capture_output=True,
                timeout=_CLI_TIMEOUT_SECONDS,
                check=False,
            )
        except subprocess.TimeoutExpired:
            return CliResult(False, None, None, "retainpdf-agent timed out")
        raw = completed.stdout if completed.returncode == 0 else completed.stderr
        text = raw[:MAX_BROKER_FRAME_BYTES].decode("utf-8", errors="replace")
        text = text.replace(capability, "[REDACTED]")
        try:
            envelope = json.loads(text)
        except json.JSONDecodeError:
            return CliResult(False, None, None, "retainpdf-agent returned non-JSON output")
        if not isinstance(envelope, dict):
            return CliResult(False, None, None, "retainpdf-agent returned an invalid envelope")
        error = envelope.get("error") if isinstance(envelope.get("error"), dict) else {}
        status = envelope.get("http_status")
        return CliResult(
            ok=completed.returncode == 0 and bool(envelope.get("ok")),
            http_status=status if isinstance(status, int) else None,
            response=envelope.get("response"),
            message=str(error.get("message") or ""),
        )

    def _cli_env(self, capability: str) -> dict[str, str]:
        return {
            "HOME": str(self._root),
            "PATH": os.defpath,
            "RETAINPDF_AGENT_API_URL": self._rust_api_url,
            "RETAINPDF_AGENT_CAPABILITY": capability,
        }

    def _execute_host_tool(
        self, command: BrokerCommand, *, tool_call_id: str = ""
    ) -> dict[str, Any]:
        from .agent import assign_refs, public_tool_payload, scope_tool_arguments
        from .unified_tools import (
            CALCULATION_TOOL_NAMES,
            agent_tool_event,
            with_tool_context,
        )

        registry = self._tool_registry
        payload = command.request_payload or {}
        name = str(payload.get("name") or "")
        arguments = payload.get("arguments")
        tool_call_id = tool_call_id or f"broker-{self._call_count:02d}"
        if registry is None or not isinstance(arguments, dict):
            return failure("host tool is unavailable")
        scoped = scope_tool_arguments(
            name,
            arguments,
            document_id=self._scope.document_id,
            job_id=self._scope.job_id,
        )
        if name in CALCULATION_TOOL_NAMES:
            scoped = with_tool_context(
                scoped,
                conversation_id=self._scope.conversation_id,
                request_message_id=self._scope.request_message_id,
                document_id=self._scope.document_id,
                job_id=self._scope.job_id,
                tool_call_id=tool_call_id,
            )
        result = registry.invoke(name, scoped)
        self._next_ref = assign_refs(result, self._citations, self._next_ref)
        public = result if name in CALCULATION_TOOL_NAMES else public_tool_payload(result)
        if self._on_tool_event is not None:
            event = agent_tool_event(
                name,
                tool_call_id,
                "failed" if public.get("error") else "completed",
                public,
            )
            try:
                self._on_tool_event(event)
            except Exception:  # noqa: BLE001,S110 - event delivery is best effort
                pass
        return {
            "exit_code": 0,
            "stdout": json.dumps(public, ensure_ascii=False, separators=(",", ":")),
            "stderr": "",
        }

    def _emit_tool_event(
        self, command: BrokerCommand, tool_call_id: str, status: str
    ) -> None:
        if self._on_tool_event is None:
            return
        from .unified_tools import agent_tool_event

        payload = command.request_payload or {}
        if command.action == "tool.call":
            name = str(payload.get("name") or "")
        elif command.action.startswith("translation."):
            name = command.action.replace(".", "_").replace("-", "_")
        else:
            name = f"document_{command.action.replace('.', '_')}"
        try:
            self._on_tool_event(agent_tool_event(name, tool_call_id, status))
        except Exception:  # noqa: BLE001,S110 - progress delivery is best effort
            pass

    def _write_wrapper(self) -> None:
        wrapper = self._bin_dir / "retainpdf-agent"
        if wrapper.exists() or wrapper.is_symlink():
            raise RuntimeError("fx broker wrapper already exists")
        source = wrapper_source(str(self._socket_path), self._broker_key)
        descriptor = os.open(wrapper, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o700)
        try:
            os.write(descriptor, source.encode("utf-8"))
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
        wrapper.chmod(stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)


def resolve_agent_cli(command: str) -> Path:
    """Resolve the real host CLI; raises RuntimeError when it is unusable."""
    return _resolve_cli(command)


def _resolve_cli(command: str) -> Path:
    raw = command.strip()
    if not raw or any(character in raw for character in "\r\n\0"):
        raise RuntimeError("invalid retainpdf-agent command")
    resolved = shutil.which(raw) if not Path(raw).is_absolute() else raw
    if not resolved:
        raise RuntimeError("retainpdf-agent executable was not found")
    path = Path(resolved).resolve()
    if not path.is_file() or not os.access(path, os.X_OK):
        raise RuntimeError("retainpdf-agent executable is not runnable")
    return path


def _write_json_no_follow(path: Path, payload: dict[str, Any]) -> None:
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode(
            "utf-8"
        )
        os.write(descriptor, encoded)
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


__all__ = [
    "AgentCommandBroker",
    "BrokerCommand",
    "BrokerScope",
    "CapabilityIssuer",
    "parse_broker_argv",
    "parse_broker_command",
]
