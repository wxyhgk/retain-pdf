"""Read opaque credentials from the Rust-owned vault without copying secrets."""

from __future__ import annotations

import json
import os
import stat
import threading
from collections.abc import Iterator
from contextlib import contextmanager, nullcontext
from pathlib import Path
from typing import Any

try:  # POSIX is the production path; the local lock is the fallback elsewhere.
    import fcntl
except ImportError:  # pragma: no cover - Windows fallback
    fcntl = None  # type: ignore[assignment]


VAULT_SCHEMA = "retainpdf_credential_vault_v1"
MAX_VAULT_BYTES = 256 * 1024
MAX_SECRET_BYTES = 8192
VAULT_PATH = Path("secrets") / "credentials.json"
LOCK_PATH = Path("secrets") / ".credentials.lock"
_ACCESS_LOCK = threading.RLock()


class CredentialReferenceError(RuntimeError):
    """A safe reference/storage failure that never contains a secret."""


def _valid_shape(value: str) -> bool:
    return (
        bool(value)
        and len(value) <= 64
        and all(
            character.isascii()
            and (character.islower() or character.isdigit() or character in "_-")
            for character in value
        )
    )


def _prepare_lock_file(data_root: Path) -> int:
    directory = Path(data_root).resolve() / "secrets"
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    info = directory.lstat()
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISDIR(info.st_mode):
        raise CredentialReferenceError("credential vault directory is unsafe")
    if os.name == "posix":
        directory.chmod(0o700)
    flags = os.O_RDWR | os.O_CREAT
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(Path(data_root).resolve() / LOCK_PATH, flags, 0o600)
    except OSError as exc:
        raise CredentialReferenceError(
            "credential vault lock cannot be opened"
        ) from exc
    if os.name == "posix":
        os.fchmod(descriptor, 0o600)
    return descriptor


@contextmanager
def credential_usage_lock(data_root: Path) -> Iterator[None]:
    """Fence reference validation/config persistence against Rust deletion."""

    with _ACCESS_LOCK:
        descriptor = _prepare_lock_file(data_root)
        try:
            if fcntl is not None:
                fcntl.flock(descriptor, fcntl.LOCK_SH)
            yield
        finally:
            if fcntl is not None:
                fcntl.flock(descriptor, fcntl.LOCK_UN)
            os.close(descriptor)


def resolve_credential(
    data_root: Path,
    credential_ref: str,
    expected_kind: str,
    *,
    usage_lock_held: bool = False,
) -> str:
    reference = credential_ref.strip()
    if not reference.startswith("cred_") or not _valid_shape(reference):
        raise CredentialReferenceError("credential_ref is invalid")
    lock = nullcontext() if usage_lock_held else credential_usage_lock(data_root)
    with lock:
        vault = _load_vault(data_root)
        stored = vault["credentials"].get(reference)
        if stored is None:
            raise CredentialReferenceError("credential reference not found")
        actual_kind = str(stored.get("kind") or "")
        if actual_kind != expected_kind:
            raise CredentialReferenceError(
                "credential kind does not match runtime field"
            )
        return str(stored["secret"])


def _load_vault(data_root: Path) -> dict[str, Any]:
    path = Path(data_root).resolve() / VAULT_PATH
    try:
        info = path.lstat()
    except FileNotFoundError as exc:
        raise CredentialReferenceError("credential reference not found") from exc
    if (
        stat.S_ISLNK(info.st_mode)
        or not stat.S_ISREG(info.st_mode)
        or info.st_size > MAX_VAULT_BYTES
    ):
        raise CredentialReferenceError("credential vault path is unsafe")
    if os.name == "posix" and stat.S_IMODE(info.st_mode) & 0o077:
        raise CredentialReferenceError("credential vault permissions must be 0600")
    try:
        value = json.loads(path.read_bytes())
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise CredentialReferenceError("credential vault is unreadable") from exc
    credentials = value.get("credentials") if isinstance(value, dict) else None
    revision = value.get("revision") if isinstance(value, dict) else None
    if (
        not isinstance(value, dict)
        or value.get("schema") != VAULT_SCHEMA
        or isinstance(revision, bool)
        or not isinstance(revision, int)
        or revision < 0
        or not isinstance(credentials, dict)
    ):
        raise CredentialReferenceError("credential vault is invalid")
    for reference, stored in credentials.items():
        if (
            not isinstance(reference, str)
            or not reference.startswith("cred_")
            or not _valid_shape(reference)
            or not isinstance(stored, dict)
            or not _valid_shape(str(stored.get("kind") or ""))
            or not isinstance(stored.get("secret"), str)
            or not stored["secret"]
            or len(stored["secret"]) > MAX_SECRET_BYTES
        ):
            raise CredentialReferenceError("credential vault is invalid")
    return value
