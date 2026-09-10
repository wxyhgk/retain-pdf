from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path


TRANSLATION_MANIFEST_FILE_NAME = "translation-manifest.json"
TRANSLATION_MANIFEST_SCHEMA = "translation_manifest_v1"
TRANSLATION_MANIFEST_SCHEMA_VERSION = 1


def translation_manifest_path(translations_dir: Path) -> Path:
    return translations_dir / TRANSLATION_MANIFEST_FILE_NAME


def _relative_payload_path(translations_dir: Path, translation_path: Path) -> str:
    try:
        return translation_path.resolve().relative_to(translations_dir.resolve()).as_posix()
    except ValueError:
        raise RuntimeError(
            f"Translation payload path must be under translations_dir: {translation_path}"
        )


def _atomic_write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
        text=True,
    )
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, path)
        _fsync_parent_dir(path)
    except Exception:
        try:
            tmp_path.unlink()
        except FileNotFoundError:
            pass
        raise


def _fsync_parent_dir(path: Path) -> None:
    try:
        dir_fd = os.open(path.parent, os.O_RDONLY)
    except OSError:
        return
    try:
        os.fsync(dir_fd)
    finally:
        os.close(dir_fd)


def write_translation_manifest(
    translations_dir: Path,
    translation_paths: dict[int, Path],
    *,
    glossary: dict | None = None,
    summary: dict | None = None,
) -> Path:
    translations_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = translation_manifest_path(translations_dir)
    pages = [
        {
            "page_index": page_idx,
            "page_number": page_idx + 1,
            "path": _relative_payload_path(translations_dir, translation_path),
        }
        for page_idx, translation_path in sorted(translation_paths.items())
    ]
    payload = {
        "schema": TRANSLATION_MANIFEST_SCHEMA,
        "schema_version": TRANSLATION_MANIFEST_SCHEMA_VERSION,
        "status": "complete",
        "pages": pages,
    }
    if glossary:
        payload["glossary"] = glossary
    if summary:
        payload.update(summary)
    _atomic_write_json(manifest_path, payload)
    # Prune overflow page payloads that are no longer in manifest (e.g., rerun with smaller page range)
    try:
        allowed = {p.resolve() for p in translation_paths.values()}
        for path in translations_dir.glob("page-*.json"):
            try:
                if path.resolve() not in allowed:
                    path.unlink()
            except Exception:
                pass
    except Exception:
        pass
    return manifest_path


def load_translation_manifest_file(manifest_path: Path, *, translations_dir: Path | None = None) -> dict[int, Path]:
    manifest_path = Path(manifest_path)
    base_dir = Path(translations_dir) if translations_dir is not None else manifest_path.parent
    resolved_base_dir = base_dir.resolve()

    with manifest_path.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    schema = str(payload.get("schema", "") or "")
    if schema != TRANSLATION_MANIFEST_SCHEMA:
        raise RuntimeError(f"Unsupported translation manifest schema: {schema or '<missing>'}")

    pages = payload.get("pages")
    if not isinstance(pages, list):
        raise RuntimeError(f"Invalid translation manifest pages: {manifest_path}")

    translation_paths: dict[int, Path] = {}
    for page in pages:
        if not isinstance(page, dict):
            raise RuntimeError(f"Invalid translation manifest page entry: {manifest_path}")
        page_index = int(page.get("page_index"))
        raw_path = str(page.get("path", "") or "").strip()
        if not raw_path:
            raise RuntimeError(f"Translation manifest page {page_index} is missing path")
        translation_path = Path(raw_path)
        if translation_path.is_absolute():
            raise RuntimeError(
                f"Translation manifest page {page_index} uses absolute payload path: {raw_path}"
            )
        translation_path = base_dir / translation_path
        try:
            translation_path.resolve().relative_to(resolved_base_dir)
        except ValueError as exc:
            raise RuntimeError(
                f"Translation manifest page {page_index} payload path escapes translations_dir: {raw_path}"
            ) from exc
        if page_index in translation_paths:
            raise RuntimeError(f"Duplicate translation manifest page index: {page_index}")
        translation_paths[page_index] = translation_path
    return translation_paths


def load_translation_manifest(translations_dir: Path) -> dict[int, Path]:
    manifest_path = translation_manifest_path(translations_dir)
    return load_translation_manifest_file(manifest_path, translations_dir=translations_dir)
