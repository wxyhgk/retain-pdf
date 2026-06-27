from __future__ import annotations

import hashlib
import os
from pathlib import Path


# Stay below common 255-byte component limits and leave room for filesystem
# encoding or normalization differences.
_SAFE_FILENAME_BYTES = 240


def intermediate_pdf_path(
    *,
    work_root: Path,
    output_pdf_path: Path,
    suffix: str,
) -> Path:
    filename = f"{output_pdf_path.stem}{suffix}"
    if len(os.fsencode(filename)) <= _filename_byte_limit(work_root):
        return work_root / filename

    digest = hashlib.sha256(os.fsencode(output_pdf_path.name)).hexdigest()[:16]
    return work_root / f"{digest}{suffix}"


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


__all__ = ["intermediate_pdf_path"]
