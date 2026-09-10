from __future__ import annotations

import getpass
import os
import re
import secrets
import signal
import socket
import subprocess
import sys
import tempfile
import time
from collections.abc import Mapping, Sequence
from pathlib import Path

from .contracts import LiveE2EError, Options, StackHandle
from .transport import request_json

SCRIPT_DIR = Path(__file__).resolve().parent.parent
PRODUCT_ROOT = Path(__file__).resolve().parents[4]
SERVICES_ROOT = PRODUCT_ROOT / "backend"
DEV_STACK = PRODUCT_ROOT / "ops/development/dev_stack.py"
sys.path.insert(0, str(DEV_STACK.parent))
from dev_stack import terminate_process_group
MAX_DIAGNOSTIC_CHARS = 8_000
SENSITIVE_NAME_PARTS = ("KEY", "TOKEN", "SECRET", "PASSWORD", "CREDENTIAL")


def gateway_key(options: Options, environ: Mapping[str, str]) -> str:
    key = environ.get("RETAIN_AI_FX_GATEWAY_API_KEY", "").strip()
    if environ.get("RETAIN_AI_FX_OPENAI_BASE_URL", "").strip():
        return key or "retainpdf-loopback-bridge"
    if not key and options.prompt_gateway_key:
        key = getpass.getpass("Vercel AI Gateway API key: ").strip()
    if not key:
        raise LiveE2EError(
            "RETAIN_AI_FX_GATEWAY_API_KEY or RETAIN_AI_FX_OPENAI_BASE_URL is "
            "missing; use a hidden local env or --prompt-gateway-key"
        )
    return key


def prepare_data_root(options: Options) -> tuple[Path, bool]:
    if options.data_root is None:
        root = Path(tempfile.mkdtemp(prefix="retainpdf-agent-live-"))
        root.chmod(0o700)
        return root, True
    root = options.data_root
    if root.exists() and (not root.is_dir() or any(root.iterdir())):
        raise LiveE2EError("--data-root must be absent or an empty directory")
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    root.chmod(0o700)
    return root, False


def reserve_ports(count: int = 4) -> tuple[int, ...]:
    sockets: list[socket.socket] = []
    try:
        for _ in range(count):
            holder = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            holder.bind(("127.0.0.1", 0))
            sockets.append(holder)
        return tuple(int(holder.getsockname()[1]) for holder in sockets)
    finally:
        for holder in sockets:
            holder.close()


def start_stack(
    options: Options,
    data_root: Path,
    gateway_key_value: str,
    environ: Mapping[str, str],
    *,
    generation: int = 1,
) -> StackHandle:
    ports = reserve_ports()
    api_key = f"live-{secrets.token_urlsafe(24)}"
    command = [
        sys.executable,
        str(DEV_STACK),
        "--runtime",
        "fx",
        "--port",
        str(ports[0]),
        "--jobs-port",
        str(ports[1]),
        "--ai-port",
        str(ports[2]),
        "--simple-port",
        str(ports[3]),
        "--data-root",
        str(data_root),
        "--readiness-timeout",
        str(options.startup_timeout),
    ]
    if not options.sync:
        command.append("--no-sync")
    if not options.build:
        command.append("--no-build")
    env = dict(environ)
    env.update(
        {
            "RETAIN_AI_FX_GATEWAY_API_KEY": gateway_key_value,
            "RETAIN_AI_FX_TURN_TIMEOUT_SECS": str(options.turn_timeout),
            "RUST_API_KEYS": api_key,
        }
    )
    log_path = data_root / f"live-e2e-stack-{generation:02d}.log"
    descriptor = os.open(log_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    log_file = os.fdopen(descriptor, "wb", buffering=0)
    try:
        process = subprocess.Popen(
            command,
            cwd=PRODUCT_ROOT,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
    except Exception:
        log_file.close()
        raise
    return StackHandle(process, log_file, log_path, ports, api_key)


def wait_ready(stack: StackHandle, timeout: float) -> None:
    deadline = time.monotonic() + timeout
    url = f"{stack.api_url}/ready"
    while time.monotonic() < deadline:
        status = stack.process.poll()
        if status is not None:
            raise LiveE2EError(
                f"backend stack exited before readiness (status {status})"
            )
        try:
            result = request_json("GET", url, stack.api_key, timeout=1.0)
            if (result.get("data") or {}).get("status") == "ready":
                return
        except LiveE2EError:
            pass
        time.sleep(0.25)
    raise LiveE2EError(f"backend readiness timed out after {timeout:g}s")


def stop_stack(stack: StackHandle) -> None:
    try:
        if stack.process.poll() is None:
            stack.process.send_signal(signal.SIGINT)
            try:
                stack.process.wait(timeout=20)
            except subprocess.TimeoutExpired:
                terminate_process_group(stack.process, timeout=5)
    finally:
        stack.log_file.close()


def diagnostic_tail(path: Path, secrets_to_redact: Sequence[str]) -> str:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")[
            -MAX_DIAGNOSTIC_CHARS:
        ]
    except OSError:
        return ""
    for value in sorted(
        (item for item in secrets_to_redact if item), key=len, reverse=True
    ):
        text = text.replace(value, "[REDACTED]")
    return re.sub(
        r"(?i)((?:api[_-]?key|token|secret|password)\s*[=:]\s*)\S+",
        r"\1[REDACTED]",
        text,
    ).strip()


def sensitive_environment_values(environ: Mapping[str, str]) -> tuple[str, ...]:
    return tuple(
        value
        for name, value in environ.items()
        if value
        and len(value) >= 4
        and any(part in name.upper() for part in SENSITIVE_NAME_PARTS)
    )
