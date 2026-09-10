from __future__ import annotations

from pathlib import PurePosixPath


def normalize_mineru_image_path(value: object) -> str:
    """Return a safe path relative to MinerU's bundle ``images`` directory."""

    raw = str(value or "").strip().replace("\\", "/")
    while raw.startswith("./"):
        raw = raw[2:]
    if not raw or raw.startswith("/") or "://" in raw:
        return ""

    parts = list(PurePosixPath(raw).parts)
    if any(part in {"", ".", ".."} for part in parts):
        return ""
    if parts[:2] == ["md", "images"]:
        parts = parts[2:]
    elif parts[:1] == ["images"]:
        parts = parts[1:]
    if not parts:
        return ""
    return PurePosixPath(*parts).as_posix()


def build_mineru_asset_metadata(image_paths: list[str]) -> dict[str, object]:
    """Project provider paths onto RetainPDF's page-scoped Markdown assets."""

    relative_paths: list[str] = []
    for image_path in image_paths:
        relative = normalize_mineru_image_path(image_path)
        if relative and relative not in relative_paths:
            relative_paths.append(relative)
    if not relative_paths:
        return {}
    return {
        "asset_key": relative_paths[0],
        "asset_keys": relative_paths,
        "asset_kind": "markdown_image",
        "asset_path": relative_paths[0],
        "asset_paths": relative_paths,
        "asset_resolved": False,
        "asset_resolved_count": 0,
    }


__all__ = ["build_mineru_asset_metadata", "normalize_mineru_image_path"]
