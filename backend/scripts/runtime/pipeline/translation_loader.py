from __future__ import annotations

import re
from pathlib import Path

from services.translation.payload import load_translations
from services.translation.payload import load_translation_manifest
from services.translation.payload import load_translation_manifest_file
from services.translation.payload import translation_manifest_path


LEGACY_TRANSLATION_PAGE_RE = re.compile(r"^page-(\d+)-deepseek\.json$")


def _load_legacy_translation_pages(translations_dir: Path) -> dict[int, list[dict]]:
    translated_pages: dict[int, list[dict]] = {}
    for path in sorted(translations_dir.glob("page-*-deepseek.json")):
        match = LEGACY_TRANSLATION_PAGE_RE.match(path.name)
        if match is None:
            continue
        page_idx = int(match.group(1)) - 1
        translated_pages[page_idx] = load_translations(path)
    return translated_pages


def load_translated_pages(
    translations_dir: Path,
    *,
    manifest_path: Path | None = None,
) -> dict[int, list[dict]]:
    translated_pages: dict[int, list[dict]] = {}
    resolved_manifest_path = manifest_path if manifest_path is not None else translation_manifest_path(translations_dir)
    if not resolved_manifest_path.exists():
        if manifest_path is not None:
            raise RuntimeError(f"Translation manifest not found: {resolved_manifest_path}")
        translated_pages = _load_legacy_translation_pages(translations_dir)
        if translated_pages:
            return translated_pages
        raise RuntimeError(f"Translation manifest not found: {resolved_manifest_path}")
    translation_paths = (
        load_translation_manifest_file(resolved_manifest_path, translations_dir=translations_dir)
        if manifest_path is not None
        else load_translation_manifest(translations_dir)
    )
    for page_idx, path in sorted(translation_paths.items()):
        if not path.exists():
            raise RuntimeError(f"Translation manifest entry points to missing file: {path}")
        translated_pages[page_idx] = load_translations(path)
    if not translated_pages:
        raise RuntimeError(f"No translation pages listed in {resolved_manifest_path}")
    return translated_pages


def select_translated_pages(
    translated_pages: dict[int, list[dict]],
    *,
    start_page: int,
    end_page: int,
) -> dict[int, list[dict]]:
    start = max(0, start_page)
    stop = max(translated_pages) if end_page < 0 else end_page
    selected_pages = {
        page_idx: items
        for page_idx, items in translated_pages.items()
        if start <= page_idx <= stop
    }
    if not selected_pages:
        raise RuntimeError(f"No translated pages selected in range {start}..{stop}")
    return selected_pages
