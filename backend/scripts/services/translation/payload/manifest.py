from __future__ import annotations

import json
from pathlib import Path


TRANSLATION_MANIFEST_FILE_NAME = "translation-manifest.json"
TRANSLATION_MANIFEST_SCHEMA = "translation_manifest_v1"
TRANSLATION_MANIFEST_SCHEMA_VERSION = 1


def translation_manifest_path(translations_dir: Path) -> Path:
    return translations_dir / TRANSLATION_MANIFEST_FILE_NAME


def _relative_payload_path(translations_dir: Path, translation_path: Path) -> str:
    try:
        return translation_path.relative_to(translations_dir).as_posix()
    except ValueError:
        return translation_path.as_posix()


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
        "pages": pages,
    }
    if glossary:
        payload["glossary"] = glossary
    if summary:
        payload.update(summary)
    with manifest_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return manifest_path


def load_translation_manifest_file(manifest_path: Path, *, translations_dir: Path | None = None) -> dict[int, Path]:
    manifest_path = Path(manifest_path)
    base_dir = translations_dir if translations_dir is not None else manifest_path.parent

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
        if not translation_path.is_absolute():
            translation_path = base_dir / translation_path
        if page_index in translation_paths:
            raise RuntimeError(f"Duplicate translation manifest page index: {page_index}")
        translation_paths[page_index] = translation_path
    return translation_paths


def load_translation_manifest(translations_dir: Path) -> dict[int, Path]:
    manifest_path = translation_manifest_path(translations_dir)
    return load_translation_manifest_file(manifest_path, translations_dir=translations_dir)
