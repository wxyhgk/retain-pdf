from __future__ import annotations

import json
import os
from pathlib import Path
import tempfile
from typing import Any


def save_json(path: Path, payload: Any, *, compact: bool = False) -> None:
    """Write JSON without building a giant intermediate string.

    ``path.write_text(json.dumps(...))`` doubles peak memory (object graph +
    full serialized text). For ~100MB+ document.v1 payloads that triggers
    MemoryError on Windows desktop Python. Stream with ``json.dump`` instead.

    compact=True skips pretty-printing; use it for large machine-consumed
    documents (document.v1.json, provider payloads) where indent=2 inflates
    the file by 30-50% and slows every downstream parse.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    if compact:
        dump_kwargs: dict[str, Any] = {
            "ensure_ascii": False,
            "separators": (",", ":"),
        }
    else:
        dump_kwargs = {
            "ensure_ascii": False,
            "indent": 2,
        }
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, **dump_kwargs)


def save_json_atomic(path: Path, payload: Any, *, compact: bool = False) -> None:
    """Atomically replace a JSON artifact after fully writing it beside the target.

    Normalized document files are consumed concurrently by the API and AI
    service. Writing them in place exposes readers to truncated JSON when a
    worker is interrupted. A same-directory temporary file keeps ``os.replace``
    on the same filesystem and therefore atomic.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as handle:
            temporary_path = Path(handle.name)
            if compact:
                dump_kwargs: dict[str, Any] = {
                    "ensure_ascii": False,
                    "separators": (",", ":"),
                }
            else:
                dump_kwargs = {
                    "ensure_ascii": False,
                    "indent": 2,
                }
            json.dump(payload, handle, **dump_kwargs)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
        temporary_path = None
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def load_json(path: Path) -> Any:
    """Read JSON without ``read_text`` + ``json.loads`` (same memory concern)."""
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)
