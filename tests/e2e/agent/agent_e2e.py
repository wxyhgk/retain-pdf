#!/usr/bin/env python3
"""Diagnose and exercise the RetainPDF Agent backend integration."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import json
import os
from pathlib import Path
import platform
import re
import shutil
import socket
import subprocess
import sys
from typing import Any, Callable, Mapping, Sequence
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


PRODUCT_ROOT = Path(__file__).resolve().parents[3]
SERVICES_ROOT = PRODUCT_ROOT / "backend"
AI_ROOT = SERVICES_ROOT / "ai"
if str(AI_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_ROOT))

from retainpdf_ai.runtime_credentials import (  # noqa: E402
    RuntimeCredentialError,
    load_runtime_credentials,
    runtime_credential_path,
)

EXPECTED_FX_VERSION = "0.0.5"
DEFAULT_FX_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh"
DOCTOR_SCHEMA = "retainpdf_agent_doctor_v1"
DEFAULT_RUST_HEALTH_URL = "http://127.0.0.1:41000/ready"
DEFAULT_AI_HEALTH_URL = "http://127.0.0.1:41100/readyz"
DEFAULT_TIMEOUT_SECONDS = 300
MAX_DIAGNOSTIC_CHARS = 4_000
SENSITIVE_NAME_PARTS = ("KEY", "TOKEN", "SECRET", "PASSWORD", "CREDENTIAL")


RunCallable = Callable[..., subprocess.CompletedProcess[str]]
WhichCallable = Callable[[str], str | None]
UrlopenCallable = Callable[..., Any]


@dataclass(frozen=True)
class SmokeStep:
    name: str
    command: tuple[str, ...]
    cwd: Path


def _present(value: str | None) -> str:
    return "present" if value and value.strip() else "missing"


def _effective_environment(
    environ: Mapping[str, str], *, load_persisted: bool
) -> tuple[dict[str, str], dict[str, Any]]:
    """Overlay the private page-saved config without exposing any raw key."""

    effective = dict(environ)
    data_root = Path(
        environ.get("RETAIN_AI_DATA_ROOT", "").strip() or PRODUCT_ROOT / "data"
    )
    check: dict[str, Any] = {
        "status": "not_checked",
        "source": "environment",
        "revision": 0,
        "path": str(runtime_credential_path(data_root)),
    }
    if not load_persisted:
        return effective, check
    try:
        stored = load_runtime_credentials(data_root)
    except RuntimeCredentialError:
        check["status"] = "invalid"
        return effective, check
    revision = int(stored.get("revision") or 0)
    check.update(
        {
            "status": "ok",
            "source": "persisted" if revision else "environment",
            "revision": revision,
        }
    )
    if not revision:
        return effective, check

    field_to_env = {
        "agent_runtime": "RETAIN_AI_RUNTIME",
        "llm_base_url": "RETAIN_AI_LLM_BASE_URL",
        "llm_model": "RETAIN_AI_LLM_MODEL",
        "fx_model": "RETAIN_AI_FX_MODEL",
    }
    for field, env_name in field_to_env.items():
        value = str(stored.get(field) or "")
        if value:
            effective[env_name] = value
    for field, env_name in (
        ("llm_api_key", "RETAIN_AI_LLM_API_KEY"),
        ("fx_gateway_api_key", "RETAIN_AI_FX_GATEWAY_API_KEY"),
    ):
        value = str(stored.get(field) or "")
        if value:
            effective[env_name] = value
        else:
            effective.pop(env_name, None)
    mode = str(stored.get("fx_gateway_base_url_mode") or "inherit_env")
    if mode == "custom":
        effective["RETAIN_AI_FX_GATEWAY_BASE_URL"] = str(
            stored.get("fx_gateway_base_url") or ""
        )
    elif mode == "official_default":
        effective.pop("RETAIN_AI_FX_GATEWAY_BASE_URL", None)
    elif mode != "inherit_env":
        check["status"] = "invalid"
    return effective, check


def _credential_checks(environ: Mapping[str, str]) -> dict[str, str]:
    service_key = (
        environ.get("RETAIN_AI_API_KEYS", "").strip()
        or environ.get("RETAIN_API_KEYS", "").strip()
        or environ.get("RUST_API_KEYS", "").strip()
    )
    rust_api_key = environ.get("RETAIN_AI_RUST_API_KEY", "").strip() or environ.get(
        "RUST_API_KEYS", ""
    ).strip()
    return {
        "fx_gateway_api_key": _present(environ.get("RETAIN_AI_FX_GATEWAY_API_KEY")),
        "service_api_key": _present(service_key),
        "rust_api_key": _present(rust_api_key),
        "llm_api_key": _present(environ.get("RETAIN_AI_LLM_API_KEY")),
    }


def _fx_gateway_check(environ: Mapping[str, str]) -> dict[str, Any]:
    raw = environ.get("RETAIN_AI_FX_GATEWAY_BASE_URL", "").strip().rstrip("/")
    if not raw:
        return {
            "status": "default",
            "base_url": DEFAULT_FX_GATEWAY_BASE_URL,
            "chat_url": f"{DEFAULT_FX_GATEWAY_BASE_URL}/v3/ai/language-model",
        }
    try:
        parsed = urlsplit(raw)
        port = parsed.port
    except ValueError:
        return {
            "status": "invalid",
            "base_url": None,
            "chat_url": None,
            "detail": "fx 0.0.5 admits only explicit loopback HTTP URLs with a port",
        }
    if (
        parsed.scheme.lower() != "http"
        or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
        or port is None
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        return {
            "status": "invalid",
            "base_url": None,
            "chat_url": None,
            "detail": "fx 0.0.5 admits only explicit loopback HTTP URLs with a port",
        }
    return {
        "status": "ok",
        "base_url": raw,
        "chat_url": f"{raw}/v3/ai/language-model",
    }


def _probe_fx_gateway_socket(
    check: dict[str, Any], *, timeout: float
) -> dict[str, Any]:
    if check.get("status") != "ok":
        return check
    parsed = urlsplit(str(check["base_url"]))
    try:
        with socket.create_connection(
            (str(parsed.hostname), int(parsed.port)), timeout=timeout
        ):
            pass
    except OSError:
        return {
            **check,
            "status": "unreachable",
            "detail": "custom loopback Gateway is not accepting connections",
        }
    return check


def _resolve_command_path(raw: str, which: WhichCallable) -> Path | None:
    value = raw.strip()
    if not value or any(character in value for character in "\r\n\0"):
        return None
    candidate = Path(value).expanduser()
    resolved = str(candidate) if candidate.is_absolute() else which(value)
    return Path(resolved).resolve() if resolved else None


def _is_executable_file(path: Path) -> bool:
    return path.is_file() and os.access(path, os.X_OK)


def _backend_python_check(*, run: RunCallable) -> dict[str, Any]:
    candidates = (
        SERVICES_ROOT / ".venv" / "bin" / "python",
        SERVICES_ROOT / ".venv" / "Scripts" / "python.exe",
    )
    path = next((candidate for candidate in candidates if _is_executable_file(candidate)), None)
    result: dict[str, Any] = {
        "status": "missing",
        "executable": str(path.resolve()) if path else None,
        "version": None,
        "required_version": "3.11",
    }
    if path is None:
        return result
    try:
        completed = run(
            [str(path), "--version"],
            cwd=PRODUCT_ROOT,
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        result["status"] = "error"
        return result
    output = (completed.stdout or completed.stderr or "").strip().splitlines()
    version_line = output[0].strip() if output else ""
    version_match = re.fullmatch(r"Python\s+(\d+\.\d+\.\d+)", version_line)
    version = version_match.group(1) if version_match else None
    result["version"] = version
    if completed.returncode != 0 or version is None:
        result["status"] = "error"
    elif version.split(".")[:2] != ["3", "11"]:
        result["status"] = "version_mismatch"
    else:
        result["status"] = "ok"
    return result


def _fx_check(
    environ: Mapping[str, str],
    *,
    run: RunCallable,
    which: WhichCallable,
) -> dict[str, Any]:
    raw_command = environ.get("RETAIN_AI_FX_COMMAND", "fx") or "fx"
    path = _resolve_command_path(raw_command, which)
    result: dict[str, Any] = {
        "status": "missing",
        "path": str(path) if path else None,
        "version": None,
        "expected_version": EXPECTED_FX_VERSION,
    }
    if path is None or not _is_executable_file(path):
        return result
    try:
        completed = run(
            [str(path), "--version"],
            cwd=PRODUCT_ROOT,
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        result["status"] = "error"
        return result
    raw_version = (completed.stdout or completed.stderr or "").strip().splitlines()
    version_line = raw_version[0].strip() if raw_version else ""
    version_match = re.fullmatch(r"(?:fx\s+)?(\d+\.\d+\.\d+)", version_line)
    version = version_match.group(1) if version_match else None
    result["version"] = version
    if completed.returncode != 0 or version is None:
        result["status"] = "error"
    elif version != EXPECTED_FX_VERSION:
        result["status"] = "version_mismatch"
    else:
        result["status"] = "ok"
    return result


def _agent_check(
    environ: Mapping[str, str], *, which: WhichCallable
) -> dict[str, Any]:
    override = environ.get("RETAIN_AI_AGENT_CLI_COMMAND", "").strip() or environ.get(
        "RETAIN_AI_FX_AGENT_CLI_COMMAND", ""
    ).strip()
    override_path = _resolve_command_path(override, which) if override else None
    debug_path = PRODUCT_ROOT / "target" / "debug" / "retainpdf-agent"
    release_path = PRODUCT_ROOT / "target" / "release" / "retainpdf-agent"

    def candidate(path: Path | None, *, configured: bool = True) -> dict[str, Any]:
        if not configured:
            return {"status": "not_configured", "path": None}
        if path is None or not path.is_file():
            return {"status": "missing", "path": str(path.resolve()) if path else None}
        return {
            "status": "ok" if _is_executable_file(path) else "not_executable",
            "path": str(path.resolve()),
        }

    candidate_checks = {
        "env_override": candidate(override_path, configured=bool(override)),
        "debug": candidate(debug_path),
        "release": candidate(release_path),
    }
    if override:
        selected = candidate_checks["env_override"]
        if selected["status"] == "ok":
            return {
                "status": "ok",
                "path": selected["path"],
                "source": "env_override",
                "candidates": candidate_checks,
            }
        return {
            "status": selected["status"],
            "path": selected["path"],
            "source": "env_override",
            "candidates": candidate_checks,
        }
    for source in ("debug", "release"):
        selected = candidate_checks[source]
        if selected["status"] == "ok":
            return {
                "status": "ok",
                "path": selected["path"],
                "source": source,
                "candidates": candidate_checks,
            }
    selected_source = next(
        (
            source
            for source in ("debug", "release")
            if candidate_checks[source]["status"] == "not_executable"
        ),
        None,
    )
    return {
        "status": "not_executable" if selected_source else "missing",
        "path": candidate_checks[selected_source]["path"] if selected_source else None,
        "source": selected_source,
        "candidates": candidate_checks,
    }


def _validate_local_health_url(url: str) -> None:
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("health URL must use http or https")
    if parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError("health URL must target the local loopback interface")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("health URL must not contain credentials, query, or fragment")


def _probe_endpoint(
    url: str, *, timeout: float, open_url: UrlopenCallable
) -> dict[str, Any]:
    _validate_local_health_url(url)
    request = Request(
        url,
        headers={"Accept": "application/json", "User-Agent": "retainpdf-agent-doctor/1"},
        method="GET",
    )
    try:
        with open_url(request, timeout=timeout) as response:
            status_code = int(getattr(response, "status", response.getcode()))
            response.read(65_537)
        return {
            "status": "running" if 200 <= status_code < 300 else "unhealthy",
            "http_status": status_code,
            "url": url,
        }
    except HTTPError as error:
        return {"status": "unhealthy", "http_status": error.code, "url": url}
    except (URLError, TimeoutError, OSError):
        return {"status": "unreachable", "http_status": None, "url": url}


def collect_doctor_report(
    *,
    environ: Mapping[str, str] | None = None,
    probe_live: bool = False,
    rust_health_url: str = DEFAULT_RUST_HEALTH_URL,
    ai_health_url: str = DEFAULT_AI_HEALTH_URL,
    probe_timeout: float = 1.5,
    run: RunCallable | None = None,
    which: WhichCallable | None = None,
    open_url: UrlopenCallable | None = None,
) -> dict[str, Any]:
    raw_env = os.environ if environ is None else environ
    env, runtime_config_check = _effective_environment(
        raw_env,
        load_persisted=(
            environ is None or bool(raw_env.get("RETAIN_AI_DATA_ROOT", "").strip())
        ),
    )
    command_runner = subprocess.run if run is None else run
    command_finder = shutil.which if which is None else which
    url_opener = urlopen if open_url is None else open_url
    runtime = env.get("RETAIN_AI_RUNTIME", "python").strip().lower() or "python"
    runtime_ok = runtime in {"python", "openai", "fx"}
    credentials = _credential_checks(env)
    python_check = _backend_python_check(run=command_runner)
    checks: dict[str, Any] = {
        "platform": {
            "status": "ok",
            "system": sys.platform,
            "machine": platform.machine(),
        },
        "python": python_check,
        "fx": _fx_check(env, run=command_runner, which=command_finder),
        "fx_gateway": _fx_gateway_check(env),
        "retainpdf_agent": _agent_check(env, which=command_finder),
        "runtime": {"status": "ok" if runtime_ok else "unsupported", "value": runtime},
        "runtime_config": runtime_config_check,
        "credentials": credentials,
        "endpoints": {
            "rust": {"status": "not_checked", "http_status": None, "url": rust_health_url},
            "ai": {"status": "not_checked", "http_status": None, "url": ai_health_url},
        },
    }
    if probe_live:
        checks["fx_gateway"] = _probe_fx_gateway_socket(
            checks["fx_gateway"], timeout=probe_timeout
        )
        checks["endpoints"] = {
            "rust": _probe_endpoint(
                rust_health_url, timeout=probe_timeout, open_url=url_opener
            ),
            "ai": _probe_endpoint(ai_health_url, timeout=probe_timeout, open_url=url_opener),
        }

    required_ok = [
        python_check["status"] == "ok",
        runtime_ok,
        credentials["service_api_key"] == "present",
        credentials["rust_api_key"] == "present",
        runtime_config_check["status"] != "invalid",
    ]
    if runtime == "fx":
        required_ok.extend(
            (
                checks["fx"]["status"] == "ok",
                checks["retainpdf_agent"]["status"] == "ok",
                credentials["fx_gateway_api_key"] == "present",
                checks["fx_gateway"]["status"] in {"default", "ok"},
            )
        )
    elif runtime == "openai":
        required_ok.extend(
            (
                checks["retainpdf_agent"]["status"] == "ok",
                credentials["llm_api_key"] == "present",
            )
        )
    elif runtime == "python":
        required_ok.append(credentials["llm_api_key"] == "present")
    if probe_live:
        required_ok.extend(
            endpoint["status"] == "running"
            for endpoint in checks["endpoints"].values()
        )
    return {"schema": DOCTOR_SCHEMA, "ok": all(required_ok), "checks": checks}


def _print_doctor_human(report: Mapping[str, Any]) -> None:
    checks = report["checks"]
    print(f"RetainPDF Agent doctor: {'ready' if report['ok'] else 'not ready'}")
    print(
        f"  platform: {checks['platform']['system']} {checks['platform']['machine']}"
    )
    print(
        "  python: "
        f"{checks['python']['status']} ({checks['python']['version']}, "
        f"required {checks['python']['required_version']})"
    )
    print(
        f"  fx: {checks['fx']['status']} "
        f"({checks['fx']['version'] or 'unknown'}, {checks['fx']['path'] or 'not found'})"
    )
    print(
        "  fx gateway: "
        f"{checks['fx_gateway']['status']} "
        f"({checks['fx_gateway']['base_url'] or 'invalid custom URL'})"
    )
    agent = checks["retainpdf_agent"]
    print(f"  retainpdf-agent: {agent['status']} ({agent['path'] or 'not found'})")
    print(f"  runtime: {checks['runtime']['status']} ({checks['runtime']['value']})")
    print(
        "  runtime config: "
        f"{checks['runtime_config']['status']} "
        f"({checks['runtime_config']['source']}, "
        f"revision {checks['runtime_config']['revision']})"
    )
    print("  credentials:")
    for name, status in checks["credentials"].items():
        print(f"    {name}: {status}")
    print("  endpoints:")
    for name, endpoint in checks["endpoints"].items():
        suffix = (
            f" HTTP {endpoint['http_status']}" if endpoint["http_status"] is not None else ""
        )
        print(f"    {name}: {endpoint['status']}{suffix}")


def smoke_steps(*, skip_sync: bool = False, skip_build: bool = False) -> list[SmokeStep]:
    steps: list[SmokeStep] = []
    if not skip_sync:
        steps.append(
            SmokeStep(
                "sync Python backend environment",
                ("uv", "sync", "--project", "backend", "--locked", "--all-extras"),
                PRODUCT_ROOT,
            )
        )
    if not skip_build:
        steps.append(
            SmokeStep(
                "build retainpdf-agent",
                (
                    "cargo",
                    "build",
                    "--locked",
                    "--manifest-path",
                    "backend/api/Cargo.toml",
                    "--bin",
                    "retainpdf-agent",
                ),
                PRODUCT_ROOT,
            )
        )
    steps.extend(
        (
            SmokeStep(
                "real PDF document operation",
                (
                    "cargo",
                    "test",
                    "--locked",
                    "--manifest-path",
                    "backend/api/Cargo.toml",
                    "--lib",
                    "api_tests::document_operations::restricted_page_program_produces_validates_and_commits_a_real_pdf",
                    "--",
                    "--exact",
                ),
                PRODUCT_ROOT,
            ),
            SmokeStep(
                "fx broker and runtime",
                (
                    "uv",
                    "run",
                    "--project",
                    "backend",
                    "--locked",
                    "python",
                    "-m",
                    "pytest",
                    "backend/ai/tests/test_fx_command_broker.py",
                    "backend/ai/tests/test_runtime.py",
                    "tests/e2e/agent/tests/test_agent_live_e2e.py",
                    "-q",
                ),
                PRODUCT_ROOT,
            ),
        )
    )
    return steps


def _is_sensitive_name(name: str) -> bool:
    upper = name.upper()
    return any(part in upper for part in SENSITIVE_NAME_PARTS)


def _smoke_environment(environ: Mapping[str, str]) -> tuple[dict[str, str], tuple[str, ...]]:
    # Child output is not trusted: redact every inherited environment value, not
    # only known credential names, before showing a bounded failure diagnostic.
    env = {name: value for name, value in environ.items() if not _is_sensitive_name(name)}
    venv_bin = SERVICES_ROOT / ".venv" / "bin"
    old_path = env.get("PATH", "")
    env["PATH"] = f"{venv_bin}{os.pathsep}{old_path}" if old_path else str(venv_bin)
    # The current Rust test helper falls back to `python3`, so PATH is authoritative.
    # PYTHON_BIN also keeps this smoke environment correct for non-test API config.
    env["PYTHON_BIN"] = str(venv_bin / "python")
    redactions = tuple(
        sorted(
            {
                value
                for value in (*environ.values(), *env.values())
                if len(value) >= 4
            },
            key=len,
            reverse=True,
        )
    )
    return env, redactions


def _bounded_diagnostic(value: str | bytes | None, redactions: Sequence[str]) -> str:
    if value is None:
        return ""
    text = value.decode("utf-8", "replace") if isinstance(value, bytes) else value
    for inherited_value in redactions:
        text = text.replace(inherited_value, "[REDACTED]")
    text = re.sub(
        r"(?i)((?:api[_-]?key|token|secret|password)\s*[=:]\s*)\S+",
        r"\1[REDACTED]",
        text,
    )
    return text[-MAX_DIAGNOSTIC_CHARS:].strip()


def run_smoke(
    *,
    skip_sync: bool = False,
    skip_build: bool = False,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
    environ: Mapping[str, str] | None = None,
    run: RunCallable | None = None,
) -> int:
    command_runner = subprocess.run if run is None else run
    env, redactions = _smoke_environment(os.environ if environ is None else environ)
    steps = smoke_steps(skip_sync=skip_sync, skip_build=skip_build)
    for index, step in enumerate(steps, start=1):
        print(f"[{index}/{len(steps)}] {step.name}: running", flush=True)
        try:
            completed = command_runner(
                list(step.command),
                cwd=step.cwd,
                env=env,
                check=False,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired as error:
            print(f"[{index}/{len(steps)}] {step.name}: timed out", file=sys.stderr)
            diagnostic = _bounded_diagnostic(error.stderr or error.stdout, redactions)
            if diagnostic:
                print(diagnostic, file=sys.stderr)
            return 1
        except OSError as error:
            print(
                f"[{index}/{len(steps)}] {step.name}: could not start ({error.__class__.__name__})",
                file=sys.stderr,
            )
            return 1
        if completed.returncode != 0:
            print(
                f"[{index}/{len(steps)}] {step.name}: failed (exit {completed.returncode})",
                file=sys.stderr,
            )
            diagnostic = _bounded_diagnostic(
                completed.stderr or completed.stdout, redactions
            )
            if diagnostic:
                print(diagnostic, file=sys.stderr)
            return completed.returncode if 0 < completed.returncode < 256 else 1
        print(f"[{index}/{len(steps)}] {step.name}: passed", flush=True)
    print("RetainPDF Agent smoke: passed")
    return 0


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    doctor = subparsers.add_parser("doctor", help="inspect local Agent readiness")
    doctor.add_argument("--json", action="store_true", help="emit stable JSON")
    doctor.add_argument(
        "--probe-live",
        action="store_true",
        help="probe the local Rust and AI health endpoints",
    )
    doctor.add_argument("--rust-health-url", default=DEFAULT_RUST_HEALTH_URL)
    doctor.add_argument("--ai-health-url", default=DEFAULT_AI_HEALTH_URL)
    doctor.add_argument("--probe-timeout", type=float, default=1.5)

    smoke = subparsers.add_parser("smoke", help="run the offline Agent backend smoke")
    smoke.add_argument("--skip-sync", action="store_true")
    smoke.add_argument("--skip-build", action="store_true")
    smoke.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT_SECONDS)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    if args.command == "doctor":
        if args.probe_timeout <= 0:
            parser.error("--probe-timeout must be positive")
        try:
            report = collect_doctor_report(
                probe_live=args.probe_live,
                rust_health_url=args.rust_health_url,
                ai_health_url=args.ai_health_url,
                probe_timeout=args.probe_timeout,
            )
        except ValueError as error:
            parser.error(str(error))
        if args.json:
            print(json.dumps(report, ensure_ascii=False, sort_keys=True))
        else:
            _print_doctor_human(report)
        return 0 if report["ok"] else 1
    if args.timeout <= 0:
        parser.error("--timeout must be positive")
    return run_smoke(
        skip_sync=args.skip_sync,
        skip_build=args.skip_build,
        timeout=args.timeout,
    )


if __name__ == "__main__":
    raise SystemExit(main())
