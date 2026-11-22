"""按需下载的运行时资源（字体、Typst）在本机缓存的哪里。

下载、校验由 Rust 后端做（retainpdf-platform 的 runtime_assets，清单是 ``backend/config/runtime_assets.json``）：
每份资源下完、逐个文件核对过 sha256，才写进 ``<数据目录>/runtime-assets/current.json``：

    {"schema": "runtime_assets.current.v1",
     "assets": {"fonts": {"version": "2.003R", "dir": "fonts/2.003R"},
                "typst": {"version": "0.15.1", "dir": "typst/0.15.1-darwin-arm64", "bin": "typst"}}}

这里只读这份记录（路径相对 runtime-assets 目录），不读清单、不下载。没有记录、记录里的东西不在，都当没有：
调用方照旧用包里带的、环境变量指定的，再不行用后备字体。
"""

from __future__ import annotations

import json
import os
from pathlib import Path

CURRENT_FILE_NAME = "current.json"
RUNTIME_ASSETS_DIR_NAME = "runtime-assets"


def runtime_assets_root() -> Path | None:
    for env_name in ("RETAIN_PDF_RUNTIME_ASSETS_DIR",):
        value = os.environ.get(env_name, "").strip()
        if value:
            return Path(value).expanduser()
    for env_name in ("RUST_API_DATA_ROOT", "RETAIN_PDF_DATA_ROOT"):
        value = os.environ.get(env_name, "").strip()
        if value:
            return Path(value).expanduser() / RUNTIME_ASSETS_DIR_NAME
    return None


def _current(root: Path) -> dict:
    try:
        payload = json.loads((root / CURRENT_FILE_NAME).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    assets = payload.get("assets") if isinstance(payload, dict) else None
    return assets if isinstance(assets, dict) else {}


def cached_asset_dir(name: str) -> Path | None:
    """这份资源下好的目录；没有就是 None。"""
    root = runtime_assets_root()
    if root is None:
        return None
    entry = _current(root).get(name)
    if not isinstance(entry, dict):
        return None
    relative = str(entry.get("dir") or "").strip()
    if not relative or Path(relative).is_absolute() or ".." in Path(relative).parts:
        return None
    directory = root / relative
    return directory if directory.is_dir() else None


def cached_typst_bin() -> Path | None:
    directory = cached_asset_dir("typst")
    if directory is None:
        return None
    root = runtime_assets_root()
    entry = _current(root).get("typst") if root is not None else None
    name = str((entry or {}).get("bin") or ("typst.exe" if os.name == "nt" else "typst"))
    if Path(name).name != name:
        return None
    candidate = directory / name
    return candidate if candidate.is_file() and os.access(candidate, os.X_OK) else None


__all__ = ["cached_asset_dir", "cached_typst_bin", "runtime_assets_root"]
