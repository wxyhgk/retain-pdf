from __future__ import annotations

import json
import shutil
import zipfile
from pathlib import Path

import requests


def save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def download_file(url: str, path: Path, headers: dict[str, str] | None = None) -> None:
    with requests.get(url, headers=headers, stream=True, timeout=300) as response:
        response.raise_for_status()
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as f:
            for chunk in response.iter_content(chunk_size=1024 * 256):
                if chunk:
                    f.write(chunk)


def unpack_zip(zip_path: Path, dest_dir: Path) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(dest_dir)


def download_and_unpack_bundle(
    *,
    full_zip_url: str,
    zip_path: Path,
    unpack_dir: Path,
    headers: dict[str, str],
) -> None:
    download_file(full_zip_url, zip_path, headers=headers)
    unpack_zip(zip_path, unpack_dir)


def ensure_source_pdf_from_bundle(
    *,
    unpack_dir: Path,
    origin_pdf_dir: Path,
    source_pdf_path: Path | None,
) -> Path:
    if source_pdf_path is not None:
        return source_pdf_path
    unpacked_origin = next(unpack_dir.glob("*_origin.pdf"), None)
    if unpacked_origin is None:
        raise RuntimeError("MinerU unpacked bundle does not contain *_origin.pdf for remote input.")
    resolved_source_pdf_path = origin_pdf_dir / unpacked_origin.name
    shutil.copy2(unpacked_origin, resolved_source_pdf_path)
    return resolved_source_pdf_path


def resolve_layout_json_path(unpack_dir: Path) -> Path:
    layout_json_path = unpack_dir / "layout.json"
    if not layout_json_path.exists():
        raise RuntimeError(f"layout.json not found after unpack: {layout_json_path}")
    return layout_json_path
