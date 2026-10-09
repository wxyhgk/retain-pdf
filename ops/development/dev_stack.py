#!/usr/bin/env python3
"""Prepare and run the authoritative RetainPDF backend development stack.

The launcher owns one process only: ``rust_api``.  Rust then supervises jobsd
and the AI service, matching the packaged backend topology.
"""

from __future__ import annotations

import argparse
import ipaddress
import os
import shutil
import signal
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

FX_VERSION = "0.0.5"
DEFAULT_API_KEY = "dev-local-key"


class StackError(RuntimeError):
    """A safe, user-facing startup error (never contains secret values)."""


@dataclass(frozen=True)
class RepoPaths:
    product: Path
    services: Path
    api: Path
    ai: Path
    pipeline: Path
    venv_python: Path
    pipeline_command: Path
    target_debug: Path
    rust_api: Path
    jobsd: Path
    agent: Path

    @classmethod
    def from_script(
        cls,
        script: Path | None = None,
        environ: Mapping[str, str] | None = None,
    ) -> RepoPaths:
        source = (script or Path(__file__)).resolve()
        product = source.parents[2]
        services = product / "backend"
        target_debug = product / "target" / "debug"
        executable_suffix = ".exe" if os.name == "nt" else ""
        # 环境位置可以被 UV_PROJECT_ENVIRONMENT 覆盖 —— uv 自己就认这个变量，
        # 下面 prepare() 也是设它来告诉 uv 往哪装。
        #
        # 为什么需要覆盖：worktree 里本来是靠一个**提交进仓库的符号链接**
        # （`backend/.venv -> /Users/.../retain-pdf/backend/.venv`）来共用主 checkout
        # 的环境的。那个链接带着一台机器的绝对路径，别人 clone 下来是悬空的，
        # 跑 uv sync 还会顺着它往外写。链接已经撤出仓库，改用这个变量：
        #
        #     export UV_PROJECT_ENVIRONMENT=/path/to/main-checkout/backend/.venv
        #
        # 不设就还是 `<repo>/backend/.venv`，和以前一样。
        # **不读 os.environ**，只认显式传进来的那份。
        #
        # 读全局会咬人：`tests/test_dev_stack.py` 的 make_paths 造一个 tmp 下的假
        # script，期望所有路径都落在 tmp_path 里，然后往 venv_python 和
        # pipeline_command 写 "stub"。第一版这里写的是 `environ or os.environ`，
        # 于是 shell 里 export 过 UV_PROJECT_ENVIRONMENT 的人跑这个测试，stub 会被
        # 写进**真的 venv** —— 而 `bin/python` 是指向 uv 托管解释器的符号链接，
        # 写穿之后那个解释器本体也成了 "stub"，所有项目一起坏。（真发生过。）
        venv_root = (
            Path(venv)
            if (venv := (environ or {}).get("UV_PROJECT_ENVIRONMENT"))
            else services / ".venv"
        )
        venv_bin = venv_root / ("Scripts" if os.name == "nt" else "bin")
        return cls(
            product=product,
            services=services,
            api=services / "api",
            ai=services / "ai",
            pipeline=services / "pipeline",
            venv_python=venv_bin / ("python.exe" if os.name == "nt" else "python"),
            pipeline_command=venv_bin / f"retainpdf-pipeline{executable_suffix}",
            target_debug=target_debug,
            rust_api=target_debug / f"rust_api{executable_suffix}",
            jobsd=target_debug / f"retain-jobsd{executable_suffix}",
            agent=target_debug / f"retainpdf-agent{executable_suffix}",
        )


@dataclass(frozen=True)
class Options:
    runtime: str
    sync: bool
    build: bool
    prepare_only: bool
    host: str
    port: int
    jobs_port: int
    ai_port: int
    simple_port: int
    data_root: Path
    readiness_timeout: float
    readiness_interval: float
    shutdown_timeout: float


def _env_int(environ: Mapping[str, str], name: str, default: int) -> int:
    value = environ.get(name, "").strip()
    if not value:
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise StackError(f"{name} must be an integer") from exc


def parse_args(
    argv: Sequence[str] | None = None,
    *,
    paths: RepoPaths | None = None,
    environ: Mapping[str, str] | None = None,
) -> Options:
    repo = paths or RepoPaths.from_script(environ=os.environ)
    source_env = os.environ if environ is None else environ
    parser = argparse.ArgumentParser(
        description="Prepare and run the RetainPDF backend development stack."
    )
    parser.add_argument(
        "--runtime",
        choices=("python", "openai", "fx"),
        default="python",
    )
    parser.add_argument("--no-sync", action="store_true", help="skip uv sync")
    parser.add_argument("--no-build", action="store_true", help="skip cargo build")
    parser.add_argument(
        "--prepare-only", action="store_true", help="prepare binaries and exit"
    )
    parser.add_argument(
        "--host", default=source_env.get("RUST_API_BIND_HOST", "127.0.0.1")
    )
    parser.add_argument(
        "--port", type=int, default=_env_int(source_env, "RUST_API_PORT", 41000)
    )
    parser.add_argument(
        "--jobs-port",
        type=int,
        default=_env_int(source_env, "RUST_API_JOBS_PORT", 41002),
    )
    parser.add_argument(
        "--ai-port",
        type=int,
        default=_env_int(source_env, "RUST_API_AI_PORT", 41100),
    )
    parser.add_argument(
        "--simple-port",
        type=int,
        default=_env_int(source_env, "RUST_API_SIMPLE_PORT", 42000),
    )
    parser.add_argument(
        "--data-root",
        type=Path,
        default=Path(source_env.get("RUST_API_DATA_ROOT", repo.product / "data")),
    )
    parser.add_argument("--readiness-timeout", type=float, default=60.0)
    parser.add_argument("--readiness-interval", type=float, default=0.25)
    parser.add_argument("--shutdown-timeout", type=float, default=10.0)
    args = parser.parse_args(argv)

    ports = (args.port, args.jobs_port, args.ai_port, args.simple_port)
    if any(port < 1 or port > 65535 for port in ports):
        parser.error("ports must be between 1 and 65535")
    if args.readiness_timeout <= 0 or args.readiness_interval <= 0:
        parser.error("readiness timeout and interval must be positive")
    if args.shutdown_timeout < 0:
        parser.error("shutdown timeout cannot be negative")

    data_root = args.data_root.expanduser()
    if not data_root.is_absolute():
        data_root = (Path.cwd() / data_root).resolve()
    else:
        data_root = data_root.resolve()
    return Options(
        runtime=args.runtime,
        sync=not args.no_sync,
        build=not args.no_build,
        prepare_only=args.prepare_only,
        host=args.host,
        port=args.port,
        jobs_port=args.jobs_port,
        ai_port=args.ai_port,
        simple_port=args.simple_port,
        data_root=data_root,
        readiness_timeout=args.readiness_timeout,
        readiness_interval=args.readiness_interval,
        shutdown_timeout=args.shutdown_timeout,
    )


def prepare(paths: RepoPaths, options: Options, environ: Mapping[str, str]) -> None:
    command_env = dict(environ)
    # 已经设了就不覆盖 —— 那是调用方选的环境位置（见 from_script 的注释）。
    command_env.setdefault("UV_PROJECT_ENVIRONMENT", str(paths.services / ".venv"))
    command_env["CARGO_TARGET_DIR"] = str(paths.product / "target")
    commands: list[list[str]] = []
    if options.sync:
        commands.append(
            [
                "uv",
                "sync",
                "--project",
                str(paths.services),
                "--locked",
                "--all-extras",
            ]
        )
    if options.build:
        commands.append(
            [
                "cargo",
                "build",
                "--locked",
                "--workspace",
                "--bins",
                "--manifest-path",
                str(paths.product / "Cargo.toml"),
            ]
        )
    for command in commands:
        print(f"[dev-stack] preparing: {command[0]} {command[1]}", flush=True)
        try:
            subprocess.run(
                command,
                cwd=paths.product,
                env=command_env,
                check=True,
            )
        except FileNotFoundError as exc:
            raise StackError(
                f"required command is not installed: {command[0]}"
            ) from exc
        except subprocess.CalledProcessError as exc:
            raise StackError(f"preparation command failed: {command[0]}") from exc


def validate_artifacts(paths: RepoPaths) -> None:
    required = (
        paths.venv_python,
        paths.pipeline_command,
        paths.rust_api,
        paths.jobsd,
        paths.agent,
    )
    missing = [path for path in required if not path.is_file()]
    if missing:
        joined = ", ".join(str(path) for path in missing)
        raise StackError(f"required backend artifacts are missing: {joined}")
    not_executable = [path for path in required if not os.access(path, os.X_OK)]
    if not_executable:
        joined = ", ".join(str(path) for path in not_executable)
        raise StackError(f"backend artifacts are not executable: {joined}")


def preflight_fx(environ: Mapping[str, str]) -> str:
    errors: list[str] = []
    fx_name = environ.get("RETAIN_AI_FX_COMMAND", "fx").strip() or "fx"
    fx_command = shutil.which(fx_name)
    if fx_command is None:
        errors.append("fx executable is missing")
    else:
        try:
            result = subprocess.run(
                [fx_command, "--version"],
                check=False,
                capture_output=True,
                text=True,
                timeout=10,
            )
        except (OSError, subprocess.SubprocessError):
            errors.append("fx version check failed")
        else:
            output = (result.stdout or result.stderr).strip().splitlines()
            version = output[-1].strip() if output else ""
            if result.returncode != 0 or version != FX_VERSION:
                errors.append(f"fx {FX_VERSION} is required")
    if not (
        environ.get("RETAIN_AI_FX_GATEWAY_API_KEY", "").strip()
        or environ.get("RETAIN_AI_FX_OPENAI_BASE_URL", "").strip()
    ):
        errors.append(
            "RETAIN_AI_FX_GATEWAY_API_KEY or RETAIN_AI_FX_OPENAI_BASE_URL is missing"
        )
    raw_base_url = environ.get("RETAIN_AI_FX_GATEWAY_BASE_URL", "").strip().rstrip("/")
    if raw_base_url:
        try:
            parsed = urllib.parse.urlsplit(raw_base_url)
            port = parsed.port
        except ValueError:
            parsed = None
            port = None
        if parsed is None or (
            parsed.scheme.lower() != "http"
            or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
            or port is None
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
        ):
            errors.append(
                "RETAIN_AI_FX_GATEWAY_BASE_URL must be explicit loopback HTTP "
                "with a port for fx 0.0.5"
            )
    if errors:
        raise StackError("fx preflight failed: " + "; ".join(errors))
    assert fx_command is not None
    return str(Path(fx_command).resolve())


LOCAL_ENV_FILE_NAME = ".env.local"


def parse_env_file(text: str) -> dict[str, str]:
    """`KEY=VALUE` 一行一个；`#` 开头和空行跳过；值两端的成对引号去掉。不做变量展开。"""
    values: dict[str, str] = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if key.startswith("export "):
            key = key[len("export "):].strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        if key and key.replace("_", "").isalnum():
            values[key] = value
    return values


def local_env_candidates(product: Path, main_checkout: Path | None) -> list[Path]:
    """先找当前检出的 `.env.local`，找不到再找 main 检出的。

    开发栈常跑在 worktree 上，而 `.env.local`（本机测试用的模型 key，gitignore 掉的）只放
    在 main 检出里一份 —— 每个 worktree 各放一份就是多一处明文 key。
    """
    candidates = [product / LOCAL_ENV_FILE_NAME]
    if main_checkout is not None and main_checkout.resolve() != product.resolve():
        candidates.append(main_checkout / LOCAL_ENV_FILE_NAME)
    return candidates


def main_checkout_of(product: Path) -> Path | None:
    """worktree 所属的 main 检出：`git rev-parse --git-common-dir` 的上一级。不是 git 仓库就 None。"""
    try:
        result = subprocess.run(
            ["git", "-C", str(product), "rev-parse", "--path-format=absolute", "--git-common-dir"],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0 or not result.stdout.strip():
        return None
    return Path(result.stdout.strip()).parent


def load_local_env(product: Path, main_checkout: Path | None) -> tuple[dict[str, str], Path | None]:
    for candidate in local_env_candidates(product, main_checkout):
        if candidate.is_file():
            return parse_env_file(candidate.read_text(encoding="utf-8")), candidate
    return {}, None


def build_runtime_env(
    paths: RepoPaths,
    options: Options,
    environ: Mapping[str, str],
    *,
    fx_command: str | None = None,
    local_env: Mapping[str, str] | None = None,
) -> dict[str, str]:
    env = dict(environ)
    # `.env.local` 只补 shell 里没设的变量：显式 export 的优先。下面开发栈自己管的
    # RUST_API_* 等再覆盖一遍，`.env.local` 改不动它们。
    for key, value in (local_env or {}).items():
        env.setdefault(key, value)
    api_keys = env.get("RUST_API_KEYS", "").strip() or DEFAULT_API_KEY
    keys = {key.strip() for key in api_keys.split(",") if key.strip()}
    try:
        address = ipaddress.ip_address(options.host)
    except ValueError as exc:
        raise StackError("bind host must be an IPv4 or IPv6 address") from exc
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
        address = address.ipv4_mapped
    if not keys or (not address.is_loopback and DEFAULT_API_KEY in keys):
        raise StackError(
            "a non-default RUST_API_KEYS value is required for non-loopback listening"
        )
    # The launcher selects the installed runtime explicitly. Do not forward the
    # retired script/console selector from an older developer environment.
    env.pop("RUST_API_PYTHON_ENTRYPOINT_MODE", None)
    bin_path = os.pathsep.join((str(paths.target_debug), str(paths.venv_python.parent)))
    inherited_path = env.get("PATH", "")
    env.update(
        {
            "PATH": bin_path + (os.pathsep + inherited_path if inherited_path else ""),
            "CARGO_MANIFEST_PATH": str(paths.product / "Cargo.toml"),
            "CARGO_TARGET_DIR": str(paths.product / "target"),
            "PYTHON_BIN": str(paths.venv_python),
            "PYTHONUNBUFFERED": "1",
            "RETAIN_API_KEYS": api_keys,
            "RETAIN_AI_RUNTIME": options.runtime,
            "RETAIN_AI_DATA_ROOT": str(options.data_root),
            "RETAIN_AI_AGENT_CLI_COMMAND": str(paths.agent),
            "RETAIN_AI_FX_AGENT_CLI_COMMAND": str(paths.agent),
            "RETAIN_AI_FX_STATE_ROOT": str(options.data_root / "agent-runtime" / "fx"),
            "RETAIN_PDF_PROJECT_ROOT": str(paths.product),
            "RETAIN_PDF_SERVICES_ROOT": str(paths.services),
            "RUST_API_KEYS": api_keys,
            # 命令行 retainpdf 靠 ~/.retainpdf/run/backend.json 找到正在运行的后端。
            "RUST_API_WRITE_RUNTIME_FILE": "1",
            "RUST_API_PROJECT_ROOT": str(paths.product),
            "RUST_API_ROOT": str(paths.api),
            "RUST_API_DATA_ROOT": str(options.data_root),
            "RUST_API_SCRIPTS_DIR": str(paths.pipeline),
            "RUST_API_PIPELINE_COMMAND": str(paths.pipeline_command),
            "RUST_API_BIND_HOST": options.host,
            "RUST_API_PORT": str(options.port),
            "RUST_API_SIMPLE_PORT": str(options.simple_port),
            "RUST_API_JOBS_MODE": "remote",
            "RUST_API_JOBS_HOST": "127.0.0.1",
            "RUST_API_JOBS_PORT": str(options.jobs_port),
            "RUST_API_JOBS_SUPERVISE": "1",
            "RUST_API_JOBSD_COMMAND": str(paths.jobsd),
            "RUST_API_JOBSD_CWD": str(paths.api),
            "RUST_API_AI_HOST": "127.0.0.1",
            "RUST_API_AI_PORT": str(options.ai_port),
            "RUST_API_AI_SERVICE_BASE": f"http://127.0.0.1:{options.ai_port}",
            "RUST_API_AI_SUPERVISE": "1",
            "RUST_API_AI_COMMAND": str(paths.venv_python),
            "RUST_API_AI_ARGS": "-m retainpdf_ai",
            "RUST_API_AI_CWD": str(paths.ai),
        }
    )
    if fx_command is not None:
        env["RETAIN_AI_FX_COMMAND"] = fx_command
    return env


def readiness_url(options: Options) -> str:
    probe_host = "127.0.0.1" if options.host in {"0.0.0.0", "::"} else options.host
    if ":" in probe_host and not probe_host.startswith("["):
        probe_host = f"[{probe_host}]"
    return f"http://{probe_host}:{options.port}/ready"


def wait_until_ready(
    process: subprocess.Popen[bytes],
    url: str,
    *,
    timeout: float,
    interval: float,
) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        returncode = process.poll()
        if returncode is not None:
            raise StackError(f"rust_api exited before readiness (status {returncode})")
        try:
            with urllib.request.urlopen(url, timeout=min(1.0, interval)) as response:
                if 200 <= response.getcode() < 300:
                    return
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError):
            pass
        time.sleep(interval)
    raise StackError(f"backend readiness timed out after {timeout:g}s")


def _descendant_processes(root_pid: int) -> tuple[set[int], set[int]]:
    """Return descendant pids/groups before the supervisor parent disappears.

    Rust deliberately puts each supervised service (and workers) into its own
    process group.  They remain in our session but are not reached by a signal
    to the rust_api group, so cleanup needs a snapshot of the complete tree.
    """
    try:
        result = subprocess.run(
            ["ps", "-Ao", "pid=,ppid=,pgid="],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return set(), set()
    if result.returncode != 0:
        return set(), set()

    rows: list[tuple[int, int, int]] = []
    for line in result.stdout.splitlines():
        fields = line.split()
        if len(fields) != 3:
            continue
        try:
            rows.append(tuple(map(int, fields)))
        except ValueError:
            continue
    descendants: set[int] = set()
    parents = {root_pid}
    while parents:
        children = {pid for pid, ppid, _pgid in rows if ppid in parents}
        children -= descendants
        if not children:
            break
        descendants.update(children)
        parents = children
    groups = {pgid for pid, _ppid, pgid in rows if pid in descendants and pgid > 1}
    return descendants, groups


def _pid_exists(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def _signal_groups(groups: set[int], signum: int) -> None:
    own_group = os.getpgrp() if os.name == "posix" else -1
    for group in sorted(groups):
        if group <= 1 or group == own_group:
            continue
        try:
            os.killpg(group, signum)
        except ProcessLookupError:
            pass


def terminate_process_group(
    process: subprocess.Popen[bytes], *, timeout: float
) -> None:
    if process.poll() is not None:
        return
    descendants, groups = _descendant_processes(process.pid)
    try:
        if os.name == "posix":
            groups.add(os.getpgid(process.pid))
            _signal_groups(groups, signal.SIGTERM)
        else:  # pragma: no cover - development is currently macOS/Linux
            process.terminate()
        process.wait(timeout=timeout)
    except ProcessLookupError:
        pass
    except subprocess.TimeoutExpired:
        pass

    deadline = time.monotonic() + timeout
    while any(_pid_exists(pid) for pid in descendants) and time.monotonic() < deadline:
        time.sleep(0.05)
    remaining = {pid for pid in descendants if _pid_exists(pid)}
    if process.poll() is None or remaining:
        if os.name == "posix":
            _signal_groups(groups, signal.SIGKILL)
        else:  # pragma: no cover
            process.kill()

    try:
        if process.poll() is None:
            process.wait(timeout=max(timeout, 1.0))
    except subprocess.TimeoutExpired:
        pass


def launch(paths: RepoPaths, options: Options, env: Mapping[str, str]) -> int:
    shutdown = threading.Event()
    previous_handlers: dict[int, object] = {}

    def request_shutdown(signum: int, _frame: object) -> None:
        print(f"[dev-stack] received signal {signum}; shutting down")
        shutdown.set()

    for signum in (signal.SIGINT, signal.SIGTERM):
        previous_handlers[signum] = signal.getsignal(signum)
        signal.signal(signum, request_shutdown)

    process: subprocess.Popen[bytes] | None = None
    try:
        process = subprocess.Popen(
            [str(paths.rust_api)],
            cwd=paths.api,
            env=dict(env),
            start_new_session=True,
        )
        url = readiness_url(options)
        print(
            f"[dev-stack] starting backend runtime={options.runtime} "
            f"api=http://{options.host}:{options.port}"
        )
        print("[dev-stack] API authentication configured (value hidden)")
        wait_until_ready(
            process,
            url,
            timeout=options.readiness_timeout,
            interval=options.readiness_interval,
        )
        print(f"[dev-stack] ready: {url}")
        while not shutdown.wait(0.2):
            returncode = process.poll()
            if returncode is not None:
                if returncode != 0:
                    raise StackError(f"rust_api exited with status {returncode}")
                return 0
        return 0
    finally:
        if process is not None:
            terminate_process_group(process, timeout=options.shutdown_timeout)
        for signum, handler in previous_handlers.items():
            signal.signal(signum, handler)


def run(
    argv: Sequence[str] | None = None,
    *,
    paths: RepoPaths | None = None,
    environ: Mapping[str, str] | None = None,
) -> int:
    repo = paths or RepoPaths.from_script(environ=os.environ)
    source_env = dict(os.environ if environ is None else environ)
    options = parse_args(argv, paths=repo, environ=source_env)
    local_env, local_env_file = load_local_env(repo.product, main_checkout_of(repo.product))
    if local_env_file is not None:
        # 只打印变量名：值里有 API key。
        print(f"[dev-stack] loaded {local_env_file}: {', '.join(sorted(local_env))}")
    runtime_env = build_runtime_env(repo, options, source_env, local_env=local_env)
    prepare(repo, options, source_env)
    validate_artifacts(repo)
    fx_command = preflight_fx(source_env) if options.runtime == "fx" else None
    if options.prepare_only:
        print("[dev-stack] backend preparation complete")
        return 0
    if fx_command is not None:
        runtime_env["RETAIN_AI_FX_COMMAND"] = fx_command
    return launch(repo, options, runtime_env)


def main(argv: Sequence[str] | None = None) -> int:
    try:
        return run(argv)
    except StackError as exc:
        print(f"[dev-stack] error: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
