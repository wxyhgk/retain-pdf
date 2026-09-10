"""Test-only process isolation; never installed by a live CLI implicitly."""
from contextlib import ExitStack
import os
from pathlib import Path
import socket
import sys
from unittest.mock import patch

from support.paths import HERE, PIPELINE, ROOT


def child_environment(root):
    allowed = {"PATH", "HOME", "USERPROFILE", "SYSTEMROOT", "WINDIR", "COMSPEC",
               "PATHEXT", "APPDATA", "LOCALAPPDATA", "TMP", "TEMP", "TMPDIR",
               "LANG", "LC_ALL", "TYPST_BIN"}
    env = {key: value for key, value in os.environ.items() if key.upper() in allowed}
    env.update(PYTHONPATH=str(PIPELINE), PYTHONNOUSERSITE="1",
               PYTHONIOENCODING="utf-8", PYTHONUNBUFFERED="1",
               OUTPUT_ROOT=str(Path(root).resolve() / "cache"))
    return env


def deny_network(*args, **kwargs):
    raise AssertionError("offline test attempted network access")


def network_guard(deny=deny_network):
    """Patch operations, not the socket type; callers own and close the stack."""
    stack = ExitStack()
    for name in ("getaddrinfo", "gethostbyname", "gethostbyname_ex", "gethostbyaddr", "create_connection"):
        stack.enter_context(patch.object(socket, name, deny))
    for name in ("connect", "connect_ex", "sendto"):
        stack.enter_context(patch.object(socket.socket, name, deny))
    # Install the lower-level barrier before importing HTTP libraries.
    import requests
    stack.enter_context(patch.object(requests.sessions.Session, "request", deny))
    return stack


def child_command(script, *args):
    return [sys.executable, str(HERE / "support/offline_child.py"), str(script), *map(str, args)]


def forbid_private_data(roots=None):
    """Irreversible audit hook for disposable children only, not a sandbox."""
    forbidden = tuple(Path(root).resolve() for root in (roots if roots is not None else [ROOT / "data"]))

    def audit(event, args):
        if event not in {"open", "os.listdir", "os.scandir", "sqlite3.connect"} or not args:
            return
        raw = args[0]
        if not isinstance(raw, (str, bytes, os.PathLike)):
            return  # File descriptors and in-memory DBs are not paths.
        raw = os.fsdecode(raw)
        if raw.startswith("file:"):
            from urllib.parse import unquote, urlsplit
            raw = unquote(urlsplit(raw).path)
        candidate = Path(raw).resolve()
        if any(candidate == root or root in candidate.parents for root in forbidden):
            raise AssertionError("offline child attempted private data access")

    sys.addaudithook(audit)
