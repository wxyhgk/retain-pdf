from __future__ import annotations

import hashlib
import os
from pathlib import Path


# Stay below common 255-byte component limits and leave room for filesystem
# encoding or normalization differences.
_SAFE_FILENAME_BYTES = 240
# Windows MAX_PATH is 260; leave headroom for temp suffixes / drive letter quirks.
# (Issue #79: FileNotFoundError on pikepdf.save when full path ~266 chars.)
_SAFE_FULL_PATH_BYTES_WINDOWS = 240
_SAFE_FULL_PATH_BYTES_POSIX = 1000


def intermediate_pdf_path(
    *,
    work_root: Path,
    output_pdf_path: Path,
    suffix: str,
) -> Path:
    """Build an intermediate PDF path under work_root.

    Prefer ``{output_stem}{suffix}`` for debuggability, but fall back to a
    short hash when either the filename component or the full absolute path
    would exceed safe OS limits (common on Windows with long paper titles +
    deep AppData job trees).
    """
    work_root = Path(work_root)
    work_root.mkdir(parents=True, exist_ok=True)
    suffix = suffix if suffix.startswith(".") or not suffix else f".{suffix}"

    preferred_name = f"{output_pdf_path.stem}{suffix}"
    preferred = work_root / preferred_name
    if _is_safe_path(preferred, work_root=work_root):
        return preferred

    digest = hashlib.sha256(os.fsencode(output_pdf_path.name)).hexdigest()[:16]
    short = work_root / f"{digest}{suffix}"
    if _is_safe_path(short, work_root=work_root):
        return short

    # Last resort: very short fixed name (still unique via digest prefix).
    minimal = work_root / f"{digest[:12]}.pdf"
    return minimal


def _filename_byte_limit(work_root: Path) -> int:
    pathconf = getattr(os, "pathconf", None)
    if pathconf is None:
        return _SAFE_FILENAME_BYTES
    try:
        name_max = int(pathconf(work_root, "PC_NAME_MAX"))
    except (OSError, TypeError, ValueError):
        return _SAFE_FILENAME_BYTES
    if name_max <= 0:
        return _SAFE_FILENAME_BYTES
    return min(name_max, _SAFE_FILENAME_BYTES)


def _full_path_byte_limit() -> int:
    if os.name == "nt":
        return _SAFE_FULL_PATH_BYTES_WINDOWS
    return _SAFE_FULL_PATH_BYTES_POSIX


def _path_byte_len(path: Path) -> int:
    try:
        # Prefer absolute form — Windows MAX_PATH applies to the final path.
        text = str(path if path.is_absolute() else path.resolve(strict=False))
    except (OSError, RuntimeError, ValueError):
        text = str(path)
    try:
        return len(os.fsencode(text))
    except (UnicodeEncodeError, TypeError, ValueError):
        return len(text.encode("utf-8", errors="replace"))


def _is_safe_path(path: Path, *, work_root: Path) -> bool:
    try:
        name_bytes = len(os.fsencode(path.name))
    except (UnicodeEncodeError, TypeError, ValueError):
        name_bytes = len(path.name.encode("utf-8", errors="replace"))
    if name_bytes > _filename_byte_limit(work_root):
        return False
    if _path_byte_len(path) > _full_path_byte_limit():
        return False
    return True


__all__ = ["intermediate_pdf_path"]
