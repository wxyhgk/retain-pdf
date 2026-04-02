from __future__ import annotations

import shutil
from pathlib import Path

from services.mineru.contracts import MINERU_CONTENT_LIST_V2_FILE_NAME
from services.mineru.contracts import MINERU_LAYOUT_JSON_FILE_NAME


def _safe_unlink(path: Path) -> None:
    try:
        if path.exists():
            path.unlink()
    except Exception:
        pass


def _safe_rmtree(path: Path) -> None:
    try:
        if path.exists():
            shutil.rmtree(path)
    except Exception:
        pass


def prune_trans_pdf_dir(trans_pdf_dir: Path, keep_output_pdf: Path | None) -> None:
    if not trans_pdf_dir.exists():
        return
    keep_name = keep_output_pdf.name if keep_output_pdf is not None else ""
    for path in list(trans_pdf_dir.iterdir()):
        if path.is_dir():
            _safe_rmtree(path)
            continue
        if path.name == keep_name:
            continue
        _safe_unlink(path)


def prune_origin_pdf_dir(origin_pdf_dir: Path, keep_pdf: Path | None) -> None:
    if not origin_pdf_dir.exists():
        return
    keep_name = keep_pdf.name if keep_pdf is not None else ""
    for path in list(origin_pdf_dir.iterdir()):
        if path.is_dir():
            _safe_rmtree(path)
            continue
        if path.name == keep_name:
            continue
        _safe_unlink(path)


def prune_mineru_json_dir(json_pdf_dir: Path) -> None:
    if not json_pdf_dir.exists():
        return

    unpacked_dir = json_pdf_dir / "unpacked"
    keep_unpacked = {"full.md", MINERU_CONTENT_LIST_V2_FILE_NAME, MINERU_LAYOUT_JSON_FILE_NAME}
    keep_unpacked_dirs = {"images"}

    for path in list(json_pdf_dir.iterdir()):
        if path.name == "unpacked":
            continue
        if path.is_dir():
            _safe_rmtree(path)
        else:
            _safe_unlink(path)

    if not unpacked_dir.exists():
        return
    for path in list(unpacked_dir.iterdir()):
        if path.is_dir():
            if path.name in keep_unpacked_dirs:
                continue
            _safe_rmtree(path)
            continue
        if path.name in keep_unpacked:
            continue
        _safe_unlink(path)
