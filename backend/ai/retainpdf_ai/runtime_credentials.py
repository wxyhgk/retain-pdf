"""Private, backend-owned credentials for the AI runtime.

The browser may submit a credential once, but it never receives the raw value
back.  The file lives below the configured data root so every checkout/runtime
uses the same explicit persistence boundary as the rest of RetainPDF data.
"""

from __future__ import annotations

import json
import os
import secrets
import stat
import threading
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from pathlib import Path
from typing import Any

try:  # POSIX is the production path; atomic CAS still works in-process elsewhere.
    import fcntl
except ImportError:  # pragma: no cover - Windows fallback
    fcntl = None  # type: ignore[assignment]


SCHEMA = "retainpdf_ai_runtime_credentials_v1"
MAX_FILE_BYTES = 64 * 1024
RELATIVE_PATH = Path("secrets") / "ai-runtime.json"
LOCK_NAME = ".ai-runtime.lock"
FX_GATEWAY_BASE_URL_MODES = {"inherit_env", "official_default", "custom"}
STRING_FIELDS = {
    "agent_runtime",
    "agent_confirmation_mode",
    "llm_base_url",
    "llm_model",
    "llm_api_key",
    "llm_credential_ref",
    "fx_gateway_base_url",
    "fx_gateway_base_url_mode",
    "fx_gateway_api_key",
    "fx_gateway_credential_ref",
    "fx_model",
}
_WRITE_LOCK = threading.Lock()


class RuntimeCredentialError(RuntimeError):
    """A safe configuration/storage failure that never includes secret values."""


class RuntimeCredentialConflict(RuntimeCredentialError):
    """The caller tried to replace a newer runtime configuration revision."""


def runtime_credential_path(data_root: Path) -> Path:
    return Path(data_root).resolve() / RELATIVE_PATH


def _validate_record(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or value.get("schema") != SCHEMA:
        raise RuntimeCredentialError("AI runtime credential file has an unsupported schema")
    unknown = set(value) - ({"schema", "revision"} | STRING_FIELDS)
    if unknown:
        raise RuntimeCredentialError("AI runtime credential file contains unsupported fields")
    revision = value.get("revision", 0)
    if isinstance(revision, bool) or not isinstance(revision, int) or revision < 0:
        raise RuntimeCredentialError("AI runtime credential file has an invalid revision")
    result: dict[str, Any] = {"schema": SCHEMA, "revision": revision}
    for name in STRING_FIELDS:
        raw = value.get(name, "")
        if not isinstance(raw, str):
            raise RuntimeCredentialError("AI runtime credential file contains invalid values")
        result[name] = raw.strip()
    mode = result["fx_gateway_base_url_mode"]
    if not mode:
        if "fx_gateway_base_url" not in value:
            mode = "inherit_env"
        elif result["fx_gateway_base_url"]:
            mode = "custom"
        else:
            mode = "official_default"
        result["fx_gateway_base_url_mode"] = mode
    if mode not in FX_GATEWAY_BASE_URL_MODES:
        raise RuntimeCredentialError("AI runtime credential file has an invalid FX URL mode")
    if result["llm_api_key"] and result["llm_credential_ref"]:
        raise RuntimeCredentialError(
            "AI runtime model credential sources are ambiguous"
        )
    if result["fx_gateway_api_key"] and result["fx_gateway_credential_ref"]:
        raise RuntimeCredentialError("AI runtime FX credential sources are ambiguous")
    return result


def load_runtime_credentials(data_root: Path) -> dict[str, Any]:
    path = runtime_credential_path(data_root)
    try:
        info = path.lstat()
    except FileNotFoundError:
        return {"schema": SCHEMA, "revision": 0}
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISREG(info.st_mode):
        raise RuntimeCredentialError("AI runtime credential path is unsafe")
    if info.st_size > MAX_FILE_BYTES:
        raise RuntimeCredentialError("AI runtime credential file is too large")
    if os.name == "posix" and stat.S_IMODE(info.st_mode) & 0o077:
        raise RuntimeCredentialError("AI runtime credential file permissions must be 0600")
    try:
        raw = path.read_bytes()
        value = json.loads(raw)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeCredentialError("AI runtime credential file is unreadable") from exc
    return _validate_record(value)


@contextmanager
def _exclusive_file_lock(directory: Path) -> Iterator[None]:
    lock_path = directory / LOCK_NAME
    flags = os.O_RDWR | os.O_CREAT
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(lock_path, flags, 0o600)
    try:
        if os.name == "posix":
            os.fchmod(descriptor, 0o600)
        if fcntl is not None:
            fcntl.flock(descriptor, fcntl.LOCK_EX)
        yield
    finally:
        if fcntl is not None:
            fcntl.flock(descriptor, fcntl.LOCK_UN)
        os.close(descriptor)


def save_runtime_credentials(
    data_root: Path,
    record: Mapping[str, Any],
    *,
    expected_revision: int | None = None,
) -> Path:
    path = runtime_credential_path(data_root)
    directory = path.parent
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    if directory.is_symlink() or not directory.is_dir():
        raise RuntimeCredentialError("AI runtime credential directory is unsafe")
    if os.name == "posix":
        directory.chmod(0o700)

    with _WRITE_LOCK, _exclusive_file_lock(directory):
        current = load_runtime_credentials(data_root)
        current_revision = int(current.get("revision") or 0)
        if expected_revision is not None and expected_revision != current_revision:
            raise RuntimeCredentialConflict(
                "AI runtime configuration changed; reload it before saving again"
            )
        candidate = dict(record)
        candidate.pop("schema", None)
        candidate.pop("revision", None)
        normalized = _validate_record(
            {
                "schema": SCHEMA,
                "revision": current_revision + 1,
                **candidate,
            }
        )
        encoded = json.dumps(
            normalized,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        if len(encoded) > MAX_FILE_BYTES:
            raise RuntimeCredentialError("AI runtime credential payload is too large")

        temporary = directory / f".{path.name}.{secrets.token_hex(8)}.tmp"
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW
        descriptor = os.open(temporary, flags, 0o600)
        try:
            with os.fdopen(descriptor, "wb", closefd=False) as stream:
                stream.write(encoded)
                stream.flush()
                os.fsync(stream.fileno())
            os.close(descriptor)
            descriptor = -1
            os.replace(temporary, path)
            if os.name == "posix":
                path.chmod(0o600)
                directory_descriptor = os.open(directory, os.O_RDONLY)
                try:
                    os.fsync(directory_descriptor)
                finally:
                    os.close(directory_descriptor)
        except Exception:
            if descriptor >= 0:
                os.close(descriptor)
            try:
                temporary.unlink()
            except FileNotFoundError:
                pass
            raise
    return path


def masked_secret(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        return ""
    return f"••••{normalized[-4:]}" if len(normalized) >= 8 else "••••"
